package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.item.PaperCard;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Explorateur des decks publics de Moxfield : recherche (texte, commandant, format, bracket), tri, pages. Moxfield n'a
 * pas d'API publique officielle : ce sont les adresses qu'utilise son propre site (api2.moxfield.com), qui peuvent
 * changer ou refuser une demande ; les champs lus sont donc tous facultatifs. Les réponses restent 10 minutes en cache.
 *
 * -Datclaude.moxfieldApi=http://127.0.0.1:.../ : une imitation locale de Moxfield (essais).
 */
final class Moxfield {

    static final String API = System.getProperty("atclaude.moxfieldApi", "https://api2.moxfield.com/");
    private static final long CACHE_MS = 10 * 60_000;
    /** Formats proposés par l'explorateur (identifiants de Moxfield). */
    static final Set<String> FORMATS = Set.of("commander", "duelCommander", "brawl", "standardBrawl", "oathbreaker", "standard",
            "pioneer", "modern", "legacy", "vintage", "pauper", "historic", "timeless", "explorer", "alchemy", "premodern");
    private static final Set<String> SORTS = Set.of("views", "likes", "updated", "created", "comments");

    private static final Map<String, Object[]> CACHE = new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(final Map.Entry<String, Object[]> eldest) {
            return size() > 120;
        }
    };
    private static final Map<String, String> CARD_IDS = new java.util.concurrent.ConcurrentHashMap<>();

    private Moxfield() { }

    /** Une page de résultats : decks (nom, auteur, commandants, couleurs, vues, mentions « j'aime »...), total. */
    static JsonObject search(final Catalog catalog, final JsonObject q) {
        final StringBuilder url = new StringBuilder(API).append("v2/decks/search?");
        final int page = Math.max(1, num(q, "page", 1));
        final int size = Math.max(6, Math.min(64, num(q, "pageSize", 30)));
        param(url, "pageNumber", String.valueOf(page));
        param(url, "pageSize", String.valueOf(size));
        final String text = str(q, "text").trim();
        if (!text.isEmpty()) {
            param(url, "q", text);
        }
        final String fmt = str(q, "format");
        if (FORMATS.contains(fmt)) {
            param(url, "fmt", fmt);
        }
        final String sort = str(q, "sort");
        param(url, "sortType", SORTS.contains(sort) ? sort : "views");
        param(url, "sortDirection", "Descending");
        final int minBracket = num(q, "minBracket", 0);
        final int maxBracket = num(q, "maxBracket", 0);
        if (minBracket >= 1 && minBracket <= 5) {
            param(url, "minBracket", String.valueOf(minBracket));
        }
        if (maxBracket >= 1 && maxBracket <= 5) {
            param(url, "maxBracket", String.valueOf(maxBracket));
        }
        final String commander = str(q, "commander").trim();
        if (!commander.isEmpty()) {
            final String id = cardId(commander);
            if (id == null) {
                throw new IllegalStateException("Moxfield ne connaît pas « " + commander + " » comme commandant.");
            }
            param(url, "commanderCardId", id);
        }
        final JsonObject root = getJson(url.toString());
        final JsonObject out = new JsonObject();
        final JsonArray decks = new JsonArray();
        final JsonArray data = root.has("data") && root.get("data").isJsonArray() ? root.getAsJsonArray("data") : new JsonArray();
        for (final JsonElement e : data) {
            if (e.isJsonObject()) {
                final JsonObject d = deck(catalog, e.getAsJsonObject());
                if (d != null) {
                    decks.add(d);
                }
            }
        }
        out.add("decks", decks);
        out.addProperty("page", page);
        final int total = num(root, "totalResults", -1);
        out.addProperty("total", total);
        final int pages = num(root, "totalPages", total >= 0 ? (total + size - 1) / size : (data.size() < size ? page : page + 1));
        out.addProperty("more", page < pages && !data.isEmpty());
        return out;
    }

    /** Un deck de la recherche, au format des tuiles de l'interface (key : son adresse Moxfield). */
    private static JsonObject deck(final Catalog catalog, final JsonObject d) {
        final String id = first(d, "publicId", "publicID", "id");
        if (id.isEmpty()) {
            return null;
        }
        final JsonObject o = new JsonObject();
        final String url = first(d, "publicUrl");
        o.addProperty("key", "moxfield:" + id);
        o.addProperty("url", url.isEmpty() ? "https://www.moxfield.com/decks/" + id : url);
        o.addProperty("name", Texts.clean(first(d, "name")));
        o.addProperty("format", first(d, "format"));
        final JsonObject user = obj(d, "createdByUser");
        o.addProperty("author", user == null ? "" : first(user, "displayName", "userName"));
        o.addProperty("likes", num(d, "likeCount", 0));
        o.addProperty("views", num(d, "viewCount", 0));
        o.addProperty("comments", num(d, "commentCount", 0));
        o.addProperty("updated", first(d, "lastUpdatedAtUtc", "updatedAtUtc", "createdAtUtc"));
        final int bracket = num(d, "bracket", num(d, "userBracket", num(d, "autoBracket", 0)));
        if (bracket > 0) {
            o.addProperty("bracket", bracket);
        }
        // Commandant(s) : « mainCard » (carte mise en avant), sinon la liste des commandants si elle est fournie.
        final JsonArray commanders = new JsonArray();
        final JsonObject main = obj(d, "mainCard");
        if (main != null && !first(main, "name").isEmpty()) {
            commanders.add(first(main, "name"));
        }
        if (d.has("commanders") && d.get("commanders").isJsonArray()) {
            for (final JsonElement c : d.getAsJsonArray("commanders")) {
                final String name = c.isJsonObject() ? first(c.getAsJsonObject(), "name") : c.isJsonPrimitive() ? c.getAsString() : "";
                if (!name.isEmpty() && !contains(commanders, name)) {
                    commanders.add(name);
                }
            }
        }
        final JsonArray namesFr = new JsonArray();
        String image = null;
        String identity = colors(d);
        for (final JsonElement c : commanders) {
            final PaperCard pc = catalog.resolve(c.getAsString());
            if (pc != null) {
                namesFr.add(Catalog.translated(pc.getName()));
                if (image == null) {
                    image = pc.getImageKey(false);
                }
                if (identity == null) {
                    identity = GameSerializer.colors(pc.getRules().getColorIdentity());
                }
            } else {
                namesFr.add(c.getAsString());
            }
        }
        o.add("commanders", namesFr);
        if (image != null) {
            o.addProperty("image", image);
        }
        o.addProperty("identity", identity == null ? "" : identity);
        o.addProperty("hasColors", identity != null);
        return o;
    }

    /** Couleurs du deck (« WUBRG »), si Moxfield les donne : liste de lettres ou texte. */
    private static String colors(final JsonObject d) {
        for (final String k : new String[] {"colorIdentity", "colors"}) {
            if (!d.has(k)) {
                continue;
            }
            final StringBuilder sb = new StringBuilder();
            final JsonElement v = d.get(k);
            if (v.isJsonArray()) {
                v.getAsJsonArray().forEach(x -> sb.append(x.isJsonPrimitive() ? x.getAsString() : ""));
            } else if (v.isJsonPrimitive()) {
                sb.append(v.getAsString());
            } else {
                continue;
            }
            final StringBuilder ordered = new StringBuilder();
            final String up = sb.toString().toUpperCase(Locale.ROOT);
            for (final char c : "WUBRG".toCharArray()) {
                if (up.indexOf(c) >= 0) {
                    ordered.append(c);
                }
            }
            return ordered.toString();
        }
        return null;
    }

    /** Identifiant Moxfield d'une carte (pour chercher les decks d'un commandant), d'après son nom anglais. */
    static String cardId(final String name) {
        final String key = name.toLowerCase(Locale.ROOT);
        final String known = CARD_IDS.get(key);
        if (known != null) {
            return known;
        }
        final JsonObject root = getJson(API + "v2/cards/search?q=" + enc("!\"" + name + "\"") + "&pageSize=10");
        String found = null;
        if (root.has("data") && root.get("data").isJsonArray()) {
            for (final JsonElement e : root.getAsJsonArray("data")) {
                if (!e.isJsonObject()) {
                    continue;
                }
                final JsonObject c = e.getAsJsonObject();
                final String n = first(c, "name");
                final String id = first(c, "id");
                if (!id.isEmpty() && (found == null || n.equalsIgnoreCase(name) || n.toLowerCase(Locale.ROOT).startsWith(key + " //"))) {
                    found = id;
                    if (n.equalsIgnoreCase(name)) {
                        break;
                    }
                }
            }
        }
        if (found != null) {
            CARD_IDS.put(key, found);
        }
        return found;
    }

    // ------------------------------------------------------------------ HTTP

    private static JsonObject getJson(final String url) {
        synchronized (CACHE) {
            final Object[] hit = CACHE.get(url);
            if (hit != null && System.currentTimeMillis() - (long) hit[0] < CACHE_MS) {
                return ((JsonObject) hit[1]).deepCopy();
            }
        }
        final String body;
        try {
            body = get(url);
        } catch (final IOException e) {
            throw new IllegalStateException("Moxfield ne répond pas (" + e.getMessage() + "). Réessaie dans un moment.");
        }
        final JsonElement parsed;
        try {
            parsed = JsonParser.parseString(body);
        } catch (final RuntimeException e) {
            throw new IllegalStateException("Réponse de Moxfield illisible : le site a peut-être changé.");
        }
        if (!parsed.isJsonObject()) {
            throw new IllegalStateException("Réponse de Moxfield inattendue.");
        }
        synchronized (CACHE) {
            CACHE.put(url, new Object[] {System.currentTimeMillis(), parsed.getAsJsonObject().deepCopy()});
        }
        return parsed.getAsJsonObject();
    }

    /** GET avec les en-têtes d'un navigateur (Moxfield est derrière Cloudflare). */
    static String get(final String url) throws IOException {
        final HttpURLConnection c = Net.open(url);
        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36");
        c.setRequestProperty("Accept", "application/json, text/plain, */*");
        c.setRequestProperty("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.8");
        c.setRequestProperty("Origin", "https://www.moxfield.com");
        c.setRequestProperty("Referer", "https://www.moxfield.com/");
        c.setConnectTimeout(10_000);
        c.setReadTimeout(20_000);
        final int code = c.getResponseCode();
        if (code == 429) {
            throw new IOException("trop de demandes, Moxfield fait une pause");
        }
        if (code == 403 || code == 503) {
            throw new IOException("accès refusé par Moxfield, HTTP " + code);
        }
        if (code != 200) {
            throw new IOException("HTTP " + code);
        }
        try (InputStream in = c.getInputStream()) {
            final ByteArrayOutputStream out = new ByteArrayOutputStream();
            final byte[] buffer = new byte[16 * 1024];
            for (int n; (n = in.read(buffer)) > 0; ) {
                out.write(buffer, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    // ------------------------------------------------------------------ outils

    private static void param(final StringBuilder url, final String key, final String value) {
        if (url.charAt(url.length() - 1) != '?') {
            url.append('&');
        }
        url.append(key).append('=').append(enc(value));
    }

    private static String enc(final String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static boolean contains(final JsonArray a, final String s) {
        for (final JsonElement e : a) {
            if (e.getAsString().equalsIgnoreCase(s)) {
                return true;
            }
        }
        return false;
    }

    private static JsonObject obj(final JsonObject o, final String key) {
        return o.has(key) && o.get(key).isJsonObject() ? o.getAsJsonObject(key) : null;
    }

    private static String first(final JsonObject o, final String... keys) {
        for (final String k : keys) {
            if (o.has(k) && o.get(k).isJsonPrimitive()) {
                final String v = o.get(k).getAsString();
                if (!v.isEmpty()) {
                    return v;
                }
            }
        }
        return "";
    }

    private static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsString() : "";
    }

    private static int num(final JsonObject o, final String key, final int fallback) {
        try {
            return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsInt() : fallback;
        } catch (final RuntimeException e) {
            return fallback;
        }
    }
}
