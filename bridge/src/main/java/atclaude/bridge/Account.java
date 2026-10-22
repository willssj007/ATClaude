package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.deck.Deck;
import forge.deck.io.DeckSerializer;
import forge.game.GameType;
import forge.localinstance.achievements.AltWinAchievements;
import forge.localinstance.achievements.CardActivationAchievements;
import forge.localinstance.achievements.ChallengeAchievements;
import forge.localinstance.achievements.PlaneswalkerAchievements;
import forge.localinstance.properties.ForgeConstants;
import forge.model.FModel;
import forge.util.storage.IStorage;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Compte du joueur : pseudo et avatar, et synchronisation entre appareils (téléphone, ordinateur).
 *
 * <p>Sans serveur à nous, la synchronisation passe par un Gist privé sur le compte GitHub du joueur :
 * il donne un jeton GitHub limité aux Gists, et chaque appareil y dépose puis y relit un fichier avec
 * ses decks, ses trophées, ses réglages et la partie en cours. Les deux versions sont fusionnées : pour
 * chaque deck la plus récente gagne, un deck supprimé reste supprimé, les trophées gardent le meilleur.</p>
 */
final class Account {

    private static final String GIST_DESC = "Arcane Table — compte (synchronisation, ne pas modifier)";
    private static final String GIST_FILE = "arcane-table.json";
    private static final String API = System.getProperty("atclaude.githubApi", "https://api.github.com/");

    private final Catalog catalog;

    Account(final Catalog catalog) {
        this.catalog = catalog;
    }

    private static File file() {
        return new File(ForgeConstants.USER_DIR, "atclaude-compte.json");
    }

    private static synchronized JsonObject load() {
        try {
            final File f = file();
            if (f.isFile()) {
                return JsonParser.parseString(Io.read(f)).getAsJsonObject();
            }
        } catch (final IOException | RuntimeException e) {
            System.err.println("Compte illisible, on repart d'un compte vide : " + e.getMessage());
        }
        final JsonObject o = new JsonObject();
        o.addProperty("name", "Joueur");
        o.addProperty("avatar", 0);
        o.addProperty("createdAt", System.currentTimeMillis());
        o.addProperty("profileAt", 0L);
        o.add("deleted", new JsonArray());
        return o;
    }

    private static synchronized void store(final JsonObject o) {
        try {
            final File f = file();
            f.getParentFile().mkdirs();
            final File tmp = new File(f.getPath() + ".tmp");
            Io.write(tmp, o.toString());
            Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (final IOException e) {
            throw new IllegalStateException("Compte non enregistré : " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------ profil

    /** Ce que l'interface voit du compte (jamais le jeton). */
    JsonObject profile() {
        final JsonObject a = load();
        final JsonObject o = new JsonObject();
        o.addProperty("name", str(a, "name", "Joueur"));
        o.addProperty("avatar", a.has("avatar") ? a.get("avatar").getAsInt() : 0);
        o.addProperty("createdAt", a.has("createdAt") ? a.get("createdAt").getAsLong() : 0);
        o.addProperty("linked", !str(a, "token", "").isEmpty());
        o.addProperty("login", str(a, "login", ""));
        o.addProperty("lastSync", a.has("lastSync") ? a.get("lastSync").getAsLong() : 0);
        int decks = 0;
        for (final String format : List.of("commander", "constructed")) {
            decks += storage(format).size();
        }
        o.addProperty("decks", decks);
        return o;
    }

    JsonObject updateProfile(final JsonObject m) {
        final JsonObject a = load();
        if (m.has("name")) {
            final String name = m.get("name").getAsString().trim();
            a.addProperty("name", name.isEmpty() ? "Joueur" : name.length() > 24 ? name.substring(0, 24) : name);
        }
        if (m.has("avatar")) {
            a.addProperty("avatar", m.get("avatar").getAsInt());
        }
        a.addProperty("profileAt", System.currentTimeMillis());
        store(a);
        return profile();
    }

    /** Un deck supprimé : la synchronisation le supprimera aussi sur les autres appareils. */
    void deckDeleted(final String format, final String name) {
        final JsonObject a = load();
        final JsonArray deleted = a.has("deleted") ? a.getAsJsonArray("deleted") : new JsonArray();
        final JsonObject t = new JsonObject();
        t.addProperty("format", format);
        t.addProperty("name", name);
        t.addProperty("at", System.currentTimeMillis());
        deleted.add(t);
        a.add("deleted", deleted);
        store(a);
    }

    // ------------------------------------------------------------------ GitHub

    JsonObject link(final String token) {
        final String t = token == null ? "" : token.trim();
        if (t.isEmpty()) {
            throw new IllegalArgumentException("Colle le jeton GitHub.");
        }
        final JsonObject user = request("GET", "user", t, null).getAsJsonObject();
        final JsonObject a = load();
        a.addProperty("token", t);
        a.addProperty("login", str(user, "login", ""));
        store(a);
        return profile();
    }

    JsonObject unlink() {
        final JsonObject a = load();
        a.remove("token");
        a.remove("login");
        a.remove("lastSync");
        store(a);
        return profile();
    }

    /**
     * Fusionne ce qui est sur l'appareil et ce qui est sur GitHub, applique le résultat ici et le renvoie là-bas.
     * Renvoie les réglages de l'interface à appliquer et un résumé.
     */
    JsonObject sync(final JsonObject uiPrefs, final long uiPrefsAt, final boolean inMatch) {
        final JsonObject a = load();
        final String token = str(a, "token", "");
        if (token.isEmpty()) {
            throw new IllegalStateException("Aucun compte GitHub relié.");
        }
        final JsonObject local = bundle(a, uiPrefs, uiPrefsAt);
        JsonObject remote = null;
        final List<String> oldGists = new java.util.ArrayList<>();
        String newest = null;
        String newestAt = "";
        for (final JsonElement e : request("GET", "gists?per_page=100", token, null).getAsJsonArray()) {
            final JsonObject g = e.getAsJsonObject();
            if (GIST_DESC.equals(str(g, "description", ""))) {
                oldGists.add(str(g, "id", ""));
                if (str(g, "updated_at", "").compareTo(newestAt) > 0) {
                    newestAt = str(g, "updated_at", "");
                    newest = str(g, "id", "");
                }
            }
        }
        if (newest != null) {
            final JsonObject gist = request("GET", "gists/" + newest, token, null).getAsJsonObject();
            final JsonObject files = gist.getAsJsonObject("files");
            if (files != null && files.has(GIST_FILE)) {
                final JsonObject f = files.getAsJsonObject(GIST_FILE);
                String content = str(f, "content", "");
                if (f.has("truncated") && f.get("truncated").getAsBoolean()) {
                    content = rawGet(str(f, "raw_url", ""), token);
                }
                try {
                    remote = JsonParser.parseString(content).getAsJsonObject();
                } catch (final RuntimeException ex) {
                    remote = null; // contenu abîmé : on repart de cet appareil
                }
            }
        }
        final JsonObject merged = remote == null ? local : merge(local, remote);
        final JsonObject report = applyLocally(a, merged, inMatch);

        // Dépôt : un nouveau Gist (l'API ne permet de le modifier qu'avec PATCH, que Java ne sait pas toujours
        // envoyer), puis suppression des anciens.
        final JsonObject body = new JsonObject();
        body.addProperty("description", GIST_DESC);
        body.addProperty("public", false);
        final JsonObject files = new JsonObject();
        final JsonObject f = new JsonObject();
        f.addProperty("content", merged.toString());
        files.add(GIST_FILE, f);
        body.add("files", files);
        request("POST", "gists", token, body);
        for (final String id : oldGists) {
            try {
                request("DELETE", "gists/" + id, token, null);
            } catch (final RuntimeException e) {
                System.err.println("Ancien Gist non supprimé : " + e.getMessage());
            }
        }
        final JsonObject after = load();
        after.addProperty("lastSync", System.currentTimeMillis());
        store(after);
        report.add("profile", profile());
        return report;
    }

    // ------------------------------------------------------------------ contenu synchronisé

    private JsonObject bundle(final JsonObject account, final JsonObject uiPrefs, final long uiPrefsAt) {
        final JsonObject b = new JsonObject();
        b.addProperty("version", 1);
        final JsonObject p = new JsonObject();
        p.addProperty("name", str(account, "name", "Joueur"));
        p.addProperty("avatar", account.has("avatar") ? account.get("avatar").getAsInt() : 0);
        p.addProperty("createdAt", account.has("createdAt") ? account.get("createdAt").getAsLong() : 0);
        p.addProperty("at", account.has("profileAt") ? account.get("profileAt").getAsLong() : 0);
        b.add("profile", p);
        final JsonObject prefs = new JsonObject();
        prefs.add("values", uiPrefs == null ? new JsonObject() : uiPrefs);
        prefs.addProperty("at", uiPrefsAt);
        b.add("prefs", prefs);
        final JsonArray decks = new JsonArray();
        for (final String format : List.of("commander", "constructed")) {
            for (final Map.Entry<String, File> e : deckFiles(format).entrySet()) {
                try {
                    final JsonObject d = new JsonObject();
                    d.addProperty("format", format);
                    d.addProperty("name", e.getKey());
                    d.addProperty("content", Io.read(e.getValue()));
                    d.addProperty("mtime", e.getValue().lastModified());
                    decks.add(d);
                } catch (final IOException ex) {
                    System.err.println("Deck illisible : " + e.getValue());
                }
            }
        }
        b.add("decks", decks);
        b.add("deleted", account.has("deleted") ? account.getAsJsonArray("deleted") : new JsonArray());
        final JsonObject ach = new JsonObject();
        final File[] xml = new File(ForgeConstants.ACHIEVEMENTS_DIR).listFiles((d, n) -> n.endsWith(".xml"));
        if (xml != null) {
            for (final File x : xml) {
                try {
                    ach.addProperty(x.getName(), Io.read(x));
                } catch (final IOException ex) {
                    System.err.println("Trophées illisibles : " + x);
                }
            }
        }
        b.add("achievements", ach);
        final JsonObject save = SaveGame.read();
        if (save != null) {
            b.add("save", save);
        }
        return b;
    }

    /** Fusion : profil et réglages les plus récents, chaque deck dans sa version la plus récente, meilleurs trophées. */
    static JsonObject merge(final JsonObject local, final JsonObject remote) {
        final JsonObject m = new JsonObject();
        m.addProperty("version", 1);
        m.add("profile", newer(local.getAsJsonObject("profile"), remote.getAsJsonObject("profile"), "at"));
        m.add("prefs", newer(local.getAsJsonObject("prefs"), remote.getAsJsonObject("prefs"), "at"));

        final Map<String, JsonObject> tombs = new HashMap<>();
        for (final JsonObject src : List.of(local, remote)) {
            for (final JsonElement e : array(src, "deleted")) {
                final JsonObject t = e.getAsJsonObject();
                final String k = str(t, "format", "") + ":" + str(t, "name", "");
                if (!tombs.containsKey(k) || tombs.get(k).get("at").getAsLong() < t.get("at").getAsLong()) {
                    tombs.put(k, t);
                }
            }
        }
        final Map<String, JsonObject> decks = new LinkedHashMap<>();
        for (final JsonObject src : List.of(local, remote)) {
            for (final JsonElement e : array(src, "decks")) {
                final JsonObject d = e.getAsJsonObject();
                final String k = str(d, "format", "") + ":" + str(d, "name", "");
                if (!decks.containsKey(k) || decks.get(k).get("mtime").getAsLong() < d.get("mtime").getAsLong()) {
                    decks.put(k, d);
                }
            }
        }
        final JsonArray outDecks = new JsonArray();
        final JsonArray outTombs = new JsonArray();
        for (final Map.Entry<String, JsonObject> e : decks.entrySet()) {
            final JsonObject t = tombs.get(e.getKey());
            if (t == null || t.get("at").getAsLong() < e.getValue().get("mtime").getAsLong()) {
                outDecks.add(e.getValue());
            }
        }
        // Les suppressions de plus de 90 jours sont oubliées.
        final long cutoff = System.currentTimeMillis() - 90L * 24 * 3600_000;
        for (final JsonObject t : tombs.values()) {
            if (t.get("at").getAsLong() > cutoff) {
                outTombs.add(t);
            }
        }
        m.add("decks", outDecks);
        m.add("deleted", outTombs);

        final JsonObject ach = new JsonObject();
        final JsonObject la = local.has("achievements") ? local.getAsJsonObject("achievements") : new JsonObject();
        final JsonObject ra = remote.has("achievements") ? remote.getAsJsonObject("achievements") : new JsonObject();
        for (final JsonObject src : List.of(la, ra)) {
            for (final String k : src.keySet()) {
                final String v = src.get(k).getAsString();
                if (!ach.has(k) || count(v, "<a ") > count(ach.get(k).getAsString(), "<a ")) {
                    ach.addProperty(k, v);
                }
            }
        }
        m.add("achievements", ach);

        final JsonObject ls = local.has("save") ? local.getAsJsonObject("save") : null;
        final JsonObject rs = remote.has("save") ? remote.getAsJsonObject("save") : null;
        final JsonObject save = ls == null ? rs : rs == null ? ls : newer(ls, rs, "savedAt");
        if (save != null) {
            m.add("save", save);
        }
        return m;
    }

    private JsonObject applyLocally(final JsonObject account, final JsonObject merged, final boolean inMatch) {
        final JsonObject report = new JsonObject();
        final JsonObject p = merged.getAsJsonObject("profile");
        if (p != null) {
            account.addProperty("name", str(p, "name", "Joueur"));
            account.addProperty("avatar", p.has("avatar") ? p.get("avatar").getAsInt() : 0);
            if (p.has("createdAt") && p.get("createdAt").getAsLong() > 0) {
                account.addProperty("createdAt", p.get("createdAt").getAsLong());
            }
            account.addProperty("profileAt", p.has("at") ? p.get("at").getAsLong() : 0);
        }
        account.add("deleted", array(merged, "deleted"));
        store(account);

        int added = 0;
        int removed = 0;
        final Map<String, JsonObject> wanted = new HashMap<>();
        for (final JsonElement e : array(merged, "decks")) {
            final JsonObject d = e.getAsJsonObject();
            wanted.put(str(d, "format", "") + ":" + str(d, "name", ""), d);
        }
        for (final String format : List.of("commander", "constructed")) {
            final IStorage<Deck> storage = storage(format);
            final Map<String, File> files = deckFiles(format);
            for (final Map.Entry<String, File> e : files.entrySet()) {
                final String k = format + ":" + e.getKey();
                if (!wanted.containsKey(k)) {
                    storage.delete(e.getKey());
                    removed++;
                }
            }
            for (final JsonObject d : wanted.values()) {
                if (!format.equals(str(d, "format", ""))) {
                    continue;
                }
                final File existing = files.get(str(d, "name", ""));
                final String content = str(d, "content", "");
                try {
                    if (existing != null && Io.read(existing).equals(content)) {
                        continue;
                    }
                    final File tmp = File.createTempFile("deck", ".dck");
                    Io.write(tmp, content);
                    final Deck deck = DeckSerializer.fromFile(tmp);
                    tmp.delete();
                    if (deck != null) {
                        storage.add(deck);
                        final File written = deckFiles(format).get(deck.getName());
                        if (written != null) {
                            written.setLastModified(d.get("mtime").getAsLong());
                        }
                        added++;
                    }
                } catch (final IOException | RuntimeException ex) {
                    System.err.println("Deck non importé : " + str(d, "name", "") + " : " + ex.getMessage());
                }
            }
        }
        report.addProperty("decksAdded", added);
        report.addProperty("decksRemoved", removed);

        final JsonObject ach = merged.has("achievements") ? merged.getAsJsonObject("achievements") : new JsonObject();
        boolean achChanged = false;
        for (final String k : ach.keySet()) {
            if (!k.matches("[A-Za-z0-9_\\-]+\\.xml")) {
                continue; // nom de fichier inattendu : ignoré
            }
            final File f = new File(ForgeConstants.ACHIEVEMENTS_DIR, k);
            try {
                final String v = ach.get(k).getAsString();
                if (!f.isFile() || !Io.read(f).equals(v)) {
                    f.getParentFile().mkdirs();
                    Io.write(f, v);
                    achChanged = true;
                }
            } catch (final IOException e) {
                System.err.println("Trophées non écrits : " + k);
            }
        }
        if (achChanged) {
            FModel.getAchievements(GameType.Constructed).load();
            ChallengeAchievements.instance.load();
            AltWinAchievements.instance.load();
            PlaneswalkerAchievements.instance.load();
            CardActivationAchievements.instance.load();
        }

        // Partie en cours venue d'un autre appareil : reprenable ici (pas pendant une partie).
        if (!inMatch && merged.has("save")) {
            final JsonObject mine = SaveGame.read();
            final JsonObject theirs = merged.getAsJsonObject("save");
            if (mine == null || mine.get("savedAt").getAsLong() < theirs.get("savedAt").getAsLong()) {
                SaveGame.write(theirs);
                report.addProperty("saveImported", true);
            }
        }
        final JsonObject prefs = merged.getAsJsonObject("prefs");
        report.add("prefs", prefs == null || !prefs.has("values") ? new JsonObject() : prefs.getAsJsonObject("values"));
        report.addProperty("prefsAt", prefs == null || !prefs.has("at") ? 0 : prefs.get("at").getAsLong());
        return report;
    }

    // ------------------------------------------------------------------ outils

    private static IStorage<Deck> storage(final String format) {
        return "constructed".equals(format) ? FModel.getDecks().getConstructed() : FModel.getDecks().getCommander();
    }

    /** Fichiers des decks d'un format, par nom de deck. */
    private static Map<String, File> deckFiles(final String format) {
        final Map<String, File> map = new LinkedHashMap<>();
        final File[] files = new File(storage(format).getFullPath()).listFiles((d, n) -> n.toLowerCase().endsWith(".dck"));
        if (files != null) {
            for (final File f : files) {
                try {
                    final Deck d = DeckSerializer.fromFile(f);
                    if (d != null) {
                        map.put(d.getName(), f);
                    }
                } catch (final RuntimeException e) {
                    System.err.println("Deck illisible : " + f);
                }
            }
        }
        return map;
    }

    private static JsonObject newer(final JsonObject a, final JsonObject b, final String field) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        final long ta = a.has(field) ? a.get(field).getAsLong() : 0;
        final long tb = b.has(field) ? b.get(field).getAsLong() : 0;
        return tb > ta ? b : a;
    }

    private static JsonArray array(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonArray() ? o.getAsJsonArray(key) : new JsonArray();
    }

    private static int count(final String s, final String part) {
        int n = 0;
        for (int i = s.indexOf(part); i >= 0; i = s.indexOf(part, i + 1)) {
            n++;
        }
        return n;
    }

    private static String str(final JsonObject o, final String key, final String fallback) {
        return o != null && o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : fallback;
    }

    private static JsonElement request(final String method, final String path, final String token, final JsonObject body) {
        try {
            final HttpURLConnection c = (HttpURLConnection) URI.create(API + path).toURL().openConnection();
            c.setRequestMethod(method);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Accept", "application/vnd.github+json");
            c.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
            c.setRequestProperty("User-Agent", "ArcaneTable");
            c.setConnectTimeout(15_000);
            c.setReadTimeout(30_000);
            if (body != null) {
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream out = c.getOutputStream()) {
                    out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            final int code = c.getResponseCode();
            if (code == 401) {
                throw new IllegalStateException("GitHub refuse le jeton (expiré ou mal copié ?).");
            }
            if (code == 403 || code == 404 && path.startsWith("gists")) {
                throw new IllegalStateException("Le jeton GitHub n'a pas le droit d'écrire des Gists (cocher « gist »).");
            }
            if (code >= 300) {
                throw new IllegalStateException("GitHub a répondu " + code + ".");
            }
            if (code == 204) {
                return new JsonObject();
            }
            try (InputStream in = c.getInputStream()) {
                return JsonParser.parseString(Io.readAll(in));
            }
        } catch (final IOException e) {
            throw new IllegalStateException("GitHub injoignable : " + e.getMessage());
        }
    }

    private static String rawGet(final String url, final String token) {
        try {
            final HttpURLConnection c = (HttpURLConnection) URI.create(url).toURL().openConnection();
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("User-Agent", "ArcaneTable");
            try (InputStream in = c.getInputStream()) {
                return Io.readAll(in);
            }
        } catch (final IOException e) {
            throw new IllegalStateException("GitHub injoignable : " + e.getMessage());
        }
    }
}
