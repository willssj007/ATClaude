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
 * <p>Sans serveur à nous, la synchronisation passe par un Gist secret (non listé) sur le compte GitHub du joueur :
 * il donne un jeton GitHub limité aux Gists, et chaque appareil y dépose puis y relit un fichier avec
 * ses decks, ses trophées, ses réglages et la partie en cours. Les deux versions sont fusionnées : pour
 * chaque deck la plus récente gagne, un deck supprimé reste supprimé, les trophées gardent le meilleur.</p>
 */
final class Account {

    private static final String GIST_DESC = "Arcane Table — compte (synchronisation, ne pas modifier)";
    private static final String GIST_FILE = "arcane-table.json";
    private static final String API = System.getProperty("atclaude.githubApi", "https://api.github.com/");

    private final Bridge bridge;
    private final Catalog catalog;

    Account(final Bridge bridge, final Catalog catalog) {
        this.bridge = bridge;
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
        o.addProperty("photo", photo(a));
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
        if (m.has("photo")) {
            final String photo = m.get("photo").isJsonNull() ? "" : m.get("photo").getAsString();
            if (!photo.isEmpty() && !validPhoto(photo)) {
                throw new IllegalArgumentException("Photo refusée : il faut une image JPEG, PNG ou WebP de moins de 200 Ko.");
            }
            setPhoto(a, photo);
        }
        a.addProperty("profileAt", System.currentTimeMillis());
        store(a);
        return profile();
    }

    /** Photo de profil : petite image carrée (data URL), choisie dans la galerie et réduite par l'interface. */
    private static final int PHOTO_MAX = 280_000;

    static boolean validPhoto(final String s) {
        final int comma = s.indexOf(',');
        if (s.length() > PHOTO_MAX || comma < 0) {
            return false;
        }
        final String head = s.substring(0, comma);
        if (!head.equals("data:image/jpeg;base64") && !head.equals("data:image/png;base64") && !head.equals("data:image/webp;base64")) {
            return false;
        }
        for (int i = comma + 1; i < s.length(); i++) {
            final char c = s.charAt(i);
            if (!(c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '+' || c == '/' || c == '=')) {
                return false;
            }
        }
        return comma + 1 < s.length();
    }

    private static String photo(final JsonObject o) {
        final String photo = str(o, "photo", "");
        return validPhoto(photo) ? photo : "";
    }

    private static void setPhoto(final JsonObject o, final String photo) {
        if (photo.isEmpty() || !validPhoto(photo)) {
            o.remove("photo");
        } else {
            o.addProperty("photo", photo);
        }
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
    JsonObject sync(final JsonObject uiPrefs, final long uiPrefsAt, final java.util.function.BooleanSupplier inMatch) {
        // Ce qui touche aux fichiers de l'appareil (decks de Forge, compte) se fait sur le fil principal du pont,
        // comme le reste ; seuls les appels à GitHub ont lieu sur ce fil réseau.
        final JsonObject[] snapshot = new JsonObject[2];
        bridge.callOnEdt(() -> {
            snapshot[0] = load();
            snapshot[1] = bundle(snapshot[0], uiPrefs, uiPrefsAt);
        });
        final String token = str(snapshot[0], "token", "");
        if (token.isEmpty()) {
            throw new IllegalStateException("Aucun compte GitHub relié.");
        }
        final boolean firstSync = !snapshot[0].has("lastSync") || snapshot[0].get("lastSync").getAsLong() == 0;
        final JsonObject local = snapshot[1];
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
        final JsonObject merged = merge(local, remote == null ? new JsonObject() : remote, firstSync, directions());
        final JsonObject[] report = new JsonObject[1];
        bridge.callOnEdt(() -> report[0] = applyLocally(merged, inMatch.getAsBoolean()));

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
        bridge.callOnEdt(() -> {
            final JsonObject after = load();
            after.addProperty("lastSync", System.currentTimeMillis());
            store(after);
            report[0].add("profile", profile());
        });
        return report[0];
    }

    // ------------------------------------------------------------------ contenu synchronisé

    private JsonObject bundle(final JsonObject account, final JsonObject uiPrefs, final long uiPrefsAt) {
        final JsonObject b = new JsonObject();
        b.addProperty("version", 1);
        final JsonObject p = new JsonObject();
        p.addProperty("name", str(account, "name", "Joueur"));
        p.addProperty("avatar", account.has("avatar") ? account.get("avatar").getAsInt() : 0);
        p.addProperty("photo", photo(account));
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
        b.addProperty("saveClearedAt", SaveGame.clearedAt());
        b.add("stats", Stats.load());
        return b;
    }

    /**
     * Fusion : profil et réglages les plus récents, chaque deck dans sa version la plus récente (sauf s'il a été
     * supprimé depuis), chaque trophée à son meilleur niveau, la partie en cours la plus récente encore valable.
     * À la première synchronisation d'un appareil, ses decks ne sont jamais supprimés.
     */
    static JsonObject merge(final JsonObject local, final JsonObject remote, final boolean firstSync,
                            final Map<String, Map<String, Boolean>> directions) {
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
        final java.util.Set<String> localKeys = new java.util.HashSet<>();
        for (final JsonElement e : array(local, "decks")) {
            localKeys.add(str(e.getAsJsonObject(), "format", "") + ":" + str(e.getAsJsonObject(), "name", ""));
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
            final boolean protectedLocal = firstSync && localKeys.contains(e.getKey());
            if (t == null || protectedLocal || t.get("at").getAsLong() < e.getValue().get("mtime").getAsLong()) {
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
        final java.util.Set<String> names = new java.util.TreeSet<>(la.keySet());
        names.addAll(ra.keySet());
        for (final String file : names) {
            if (!file.matches("[A-Za-z0-9_\\-]+\\.xml")) {
                continue;
            }
            ach.addProperty(file, mergeAchievements(la.has(file) ? la.get(file).getAsString() : "",
                    ra.has(file) ? ra.get(file).getAsString() : "", directions.getOrDefault(file, Map.of())));
        }
        m.add("achievements", ach);

        final long cleared = Math.max(local.has("saveClearedAt") ? local.get("saveClearedAt").getAsLong() : 0,
                remote.has("saveClearedAt") ? remote.get("saveClearedAt").getAsLong() : 0);
        m.addProperty("saveClearedAt", cleared);
        final JsonObject ls = local.has("save") ? local.getAsJsonObject("save") : null;
        final JsonObject rs = remote.has("save") ? remote.getAsJsonObject("save") : null;
        JsonObject save = ls == null ? rs : rs == null ? ls : newer(ls, rs, "savedAt");
        if (save != null && save.has("savedAt") && save.get("savedAt").getAsLong() <= cleared) {
            save = null; // partie finie ou abandonnée depuis
        }
        if (save != null) {
            m.add("save", save);
        }
        m.add("stats", Stats.merge(local.has("stats") && local.get("stats").isJsonObject() ? local.getAsJsonObject("stats") : null,
                remote.has("stats") && remote.get("stats").isJsonObject() ? remote.getAsJsonObject("stats") : null));
        return m;
    }

    private static final java.util.regex.Pattern ENTRY = java.util.regex.Pattern.compile("<a\\s([^>]*?)/?>");
    private static final java.util.regex.Pattern ATTR = java.util.regex.Pattern.compile("(\\w+)=\"([^\"]*)\"");

    /**
     * Fusionne deux fichiers de trophées de Forge entrée par entrée, en gardant le meilleur résultat de chacune
     * (le plus grand ou le plus petit selon le trophée). Le fichier est réécrit à neuf : rien d'autre que des
     * entrées valides n'en sort (contenu venu du Gist, donc pas digne de confiance).
     */
    static String mergeAchievements(final String a, final String b, final Map<String, Boolean> greater) {
        final Map<String, long[]> best = new java.util.TreeMap<>();
        for (final String xml : List.of(a, b)) {
            final java.util.regex.Matcher m = ENTRY.matcher(xml);
            while (m.find()) {
                final Map<String, String> at = new HashMap<>();
                final java.util.regex.Matcher am = ATTR.matcher(m.group(1));
                while (am.find()) {
                    at.put(am.group(1), am.group(2));
                }
                final String name = at.get("name");
                if (name == null || !name.matches("[A-Za-z0-9 _'.,:\\-]{1,80}")) {
                    continue;
                }
                final long value;
                final long time;
                final long current;
                try {
                    value = Long.parseLong(at.getOrDefault("best", "0"));
                    time = Long.parseLong(at.getOrDefault("time", "0"));
                    current = at.containsKey("current") ? Long.parseLong(at.get("current")) : -1;
                } catch (final NumberFormatException e) {
                    continue;
                }
                final long[] cur = best.get(name);
                final boolean up = greater.getOrDefault(name, true);
                if (cur == null || (up ? value > cur[0] : value < cur[0]) || (value == cur[0] && time > cur[1])) {
                    // « current » : série en cours (trophées de séries de victoires), gardée avec le meilleur résultat.
                    best.put(name, new long[]{value, time, current >= 0 ? current : cur == null ? -1 : cur[2]});
                } else if (cur[2] < 0 && current >= 0) {
                    cur[2] = current;
                }
            }
        }
        final StringBuilder sb = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?><achievements>");
        for (final Map.Entry<String, long[]> e : best.entrySet()) {
            sb.append("<a best=\"").append(e.getValue()[0]).append('"');
            if (e.getValue()[2] >= 0) {
                sb.append(" current=\"").append(e.getValue()[2]).append('"');
            }
            sb.append(" name=\"").append(e.getKey().replace("'", "&apos;")).append("\" time=\"").append(e.getValue()[1]).append("\"/>");
        }
        return sb.append("</achievements>").toString();
    }

    /** Pour chaque fichier de trophées, si chaque trophée se gagne par le plus grand score (sinon le plus petit). */
    private static Map<String, Map<String, Boolean>> directions() {
        final Map<String, Map<String, Boolean>> out = new HashMap<>();
        try {
            final java.lang.reflect.Field file = forge.localinstance.achievements.AchievementCollection.class.getDeclaredField("filename");
            file.setAccessible(true);
            final java.lang.reflect.Field up = forge.localinstance.achievements.Achievement.class.getDeclaredField("checkGreaterThan");
            up.setAccessible(true);
            for (final forge.localinstance.achievements.AchievementCollection col : List.of(FModel.getAchievements(GameType.Constructed),
                    ChallengeAchievements.instance, AltWinAchievements.instance, PlaneswalkerAchievements.instance, CardActivationAchievements.instance)) {
                final Map<String, Boolean> map = new HashMap<>();
                for (final forge.localinstance.achievements.Achievement ach : col) {
                    map.put(ach.getKey(), up.getBoolean(ach));
                }
                out.put(new File((String) file.get(col)).getName(), map);
            }
        } catch (final ReflectiveOperationException | RuntimeException e) {
            System.err.println("Sens des trophées inconnu, on garde le plus grand score : " + e);
        }
        return out;
    }

    private JsonObject applyLocally(final JsonObject merged, final boolean inMatch) {
        final JsonObject report = new JsonObject();
        // Relu maintenant : un deck supprimé ou un pseudo changé pendant l'échange avec GitHub n'est pas perdu.
        final JsonObject account = load();
        final Map<String, Long> localTombs = new HashMap<>();
        for (final JsonElement e : array(account, "deleted")) {
            final JsonObject t = e.getAsJsonObject();
            localTombs.merge(str(t, "format", "") + ":" + str(t, "name", ""), t.get("at").getAsLong(), Math::max);
        }
        final JsonObject freshProfile = new JsonObject();
        freshProfile.addProperty("at", account.has("profileAt") ? account.get("profileAt").getAsLong() : 0);
        JsonObject p = merged.getAsJsonObject("profile");
        if (p != null && p.has("at") && freshProfile.get("at").getAsLong() > p.get("at").getAsLong()) {
            p = null; // modifié ici pendant la synchronisation : la version locale reste
        }
        if (p != null) {
            account.addProperty("name", str(p, "name", "Joueur"));
            account.addProperty("avatar", p.has("avatar") ? p.get("avatar").getAsInt() : 0);
            setPhoto(account, photo(p));
            if (p.has("createdAt") && p.get("createdAt").getAsLong() > 0) {
                account.addProperty("createdAt", p.get("createdAt").getAsLong());
            }
            account.addProperty("profileAt", p.has("at") ? p.get("at").getAsLong() : 0);
        }
        final JsonArray tombs = new JsonArray();
        final java.util.Set<String> seen = new java.util.HashSet<>();
        for (final JsonElement e : array(merged, "deleted")) {
            final JsonObject t = e.getAsJsonObject();
            seen.add(str(t, "format", "") + ":" + str(t, "name", ""));
            tombs.add(t);
        }
        for (final JsonElement e : array(account, "deleted")) {
            final JsonObject t = e.getAsJsonObject();
            if (seen.add(str(t, "format", "") + ":" + str(t, "name", ""))) {
                tombs.add(t);
            }
        }
        account.add("deleted", tombs);
        store(account);

        int added = 0;
        int removed = 0;
        final Map<String, JsonObject> wanted = new HashMap<>();
        for (final JsonElement e : array(merged, "decks")) {
            final JsonObject d = e.getAsJsonObject();
            final String k = str(d, "format", "") + ":" + str(d, "name", "");
            final Long deletedAt = localTombs.get(k);
            if (deletedAt != null && deletedAt >= d.get("mtime").getAsLong()) {
                continue; // supprimé ici pendant la synchronisation
            }
            wanted.put(k, d);
        }
        for (final String format : List.of("commander", "constructed")) {
            final IStorage<Deck> storage = storage(format);
            final Map<String, File> files = deckFiles(format);
            for (final Map.Entry<String, File> e : files.entrySet()) {
                final String k = format + ":" + e.getKey();
                // Absent de la fusion : supprimé ailleurs. Sauf s'il vient d'être créé ou modifié ici pendant la
                // synchronisation (plus récent que tout ce que la fusion connaît de lui).
                final JsonObject known = known(merged, k);
                if (!wanted.containsKey(k) && (known != null || deletedRemotely(merged, k, e.getValue().lastModified()))) {
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

        SaveGame.markCleared(merged.has("saveClearedAt") ? merged.get("saveClearedAt").getAsLong() : 0);
        final JsonObject current = SaveGame.read();
        if (current != null && current.has("savedAt") && current.get("savedAt").getAsLong() <= SaveGame.clearedAt() && !inMatch) {
            SaveGame.delete(null); // partie finie ou abandonnée sur un autre appareil
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
        // Historique des parties : celles jouées ici pendant la synchronisation sont gardées.
        if (merged.has("stats") && merged.get("stats").isJsonObject()) {
            final int newGames = Stats.mergeIn(merged.getAsJsonObject("stats"));
            if (newGames != 0) {
                report.addProperty("statsChange", newGames);
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

    /** La version d'un deck que connaît la fusion, ou null. */
    private static JsonObject known(final JsonObject merged, final String key) {
        for (final JsonElement e : array(merged, "decks")) {
            final JsonObject d = e.getAsJsonObject();
            if (key.equals(str(d, "format", "") + ":" + str(d, "name", ""))) {
                return d;
            }
        }
        return null;
    }

    /** Une suppression enregistrée ailleurs, postérieure à la dernière modification locale du deck. */
    private static boolean deletedRemotely(final JsonObject merged, final String key, final long localMtime) {
        for (final JsonElement e : array(merged, "deleted")) {
            final JsonObject t = e.getAsJsonObject();
            if (key.equals(str(t, "format", "") + ":" + str(t, "name", "")) && t.get("at").getAsLong() >= localMtime) {
                return true;
            }
        }
        return false;
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
