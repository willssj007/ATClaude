package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.StaticData;
import forge.card.CardEdition;
import forge.gui.GuiBase;
import forge.localinstance.properties.ForgeConstants;
import forge.util.ScryfallRateLimiter;

import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Prix des cartes en euros : ceux de Cardmarket, tels que Scryfall les publie (« prices.eur »), avec le lien
 * vers la page Cardmarket de la carte. Une seule requête pour 75 cartes (/cards/collection), puis un cache d'un jour.
 * Sans prix pour l'impression du deck (promo, impression récente), on prend celui de l'impression usuelle de la carte.
 */
final class Prices {

    private static final String API = System.getProperty("atclaude.scryfallApi", "https://api.scryfall.com/");
    private static final long TTL_MS = 24L * 3600_000;
    private static final int BATCH = 75;

    /** Prix connu d'une impression (ou d'une carte, pour « approx ») ; eur vide quand Cardmarket n'en a pas. */
    private record Price(String eur, String eurFoil, String url, String set, String number, long at) { }

    private static final Map<String, Price> CACHE = new ConcurrentHashMap<>();
    private static volatile boolean loaded;

    private Prices() { }

    /**
     * Prix des cartes demandées : [{name, set (code Forge), number, count}].
     * Renvoie {currency, total, priced, missing, cards: {"nom|set|numéro": {eur, foil, url, approx, set, number}}, at}.
     */
    static JsonObject forCards(final JsonArray cards) throws IOException {
        load();
        final long now = System.currentTimeMillis();
        final Map<String, JsonObject> wanted = new LinkedHashMap<>();
        for (final JsonElement e : cards) {
            final JsonObject c = e.getAsJsonObject();
            wanted.putIfAbsent(lineKey(c), c);
        }
        // 1. Les impressions du deck.
        final List<JsonObject> exact = new ArrayList<>();
        for (final JsonObject c : wanted.values()) {
            final String key = printKey(c);
            if (key != null && !fresh(key, now)) {
                exact.add(c);
            }
        }
        fetch(exact, true);
        // 2. Sans prix (ou sans impression connue de Scryfall) : l'impression usuelle de la carte.
        final List<JsonObject> byName = new ArrayList<>();
        for (final JsonObject c : wanted.values()) {
            final Price p = priceOf(c);
            if ((p == null || p.eur().isEmpty()) && !fresh(nameKey(str(c, "name")), now)) {
                byName.add(c);
            }
        }
        fetch(byName, false);
        save();

        final JsonObject out = new JsonObject();
        final JsonObject list = new JsonObject();
        double total = 0;
        int priced = 0;
        int missing = 0;
        for (final Map.Entry<String, JsonObject> e : wanted.entrySet()) {
            final JsonObject c = e.getValue();
            Price p = priceOf(c);
            boolean approx = false;
            if (p == null || p.eur().isEmpty()) {
                final Price named = CACHE.get(nameKey(str(c, "name")));
                if (named != null && !named.eur().isEmpty()) {
                    p = named;
                    approx = true;
                }
            }
            final JsonObject o = new JsonObject();
            if (p != null) {
                o.addProperty("eur", p.eur());
                o.addProperty("foil", p.eurFoil());
                o.addProperty("url", p.url());
                o.addProperty("set", p.set());
                o.addProperty("number", p.number());
            }
            o.addProperty("approx", approx);
            list.add(e.getKey(), o);
            final int count = c.has("count") ? c.get("count").getAsInt() : 1;
            if (p != null && !p.eur().isEmpty()) {
                total += count * Double.parseDouble(p.eur());
                priced += count;
            } else {
                missing += count;
            }
        }
        out.addProperty("currency", "EUR");
        out.addProperty("total", Math.round(total * 100) / 100.0);
        out.addProperty("priced", priced);
        out.addProperty("missing", missing);
        out.add("cards", list);
        out.addProperty("at", now);
        return out;
    }

    private static Price priceOf(final JsonObject c) {
        final String key = printKey(c);
        return key == null ? null : CACHE.get(key);
    }

    private static boolean fresh(final String key, final long now) {
        final Price p = key == null ? null : CACHE.get(key);
        return p != null && now - p.at() < TTL_MS;
    }

    /** Clé d'une ligne pour l'interface : nom, édition et numéro de Forge. */
    static String lineKey(final JsonObject c) {
        return str(c, "name") + "|" + str(c, "set") + "|" + str(c, "number");
    }

    /** Impression chez Scryfall (code de set Scryfall, numéro), ou null si Forge ne sait pas la situer. */
    private static String printKey(final JsonObject c) {
        final String set = scryfallSet(str(c, "set"));
        final String number = str(c, "number");
        return set == null || number.isEmpty() || "N/A".equals(number) ? null : "p:" + set + ":" + number.toLowerCase(Locale.ROOT);
    }

    private static String nameKey(final String name) {
        return "n:" + name.toLowerCase(Locale.ROOT);
    }

    private static String scryfallSet(final String forgeCode) {
        if (forgeCode.isEmpty()) {
            return null;
        }
        final CardEdition ed = StaticData.instance().getEditions().get(forgeCode);
        final String code = ed == null ? null : ed.getScryfallCode();
        return code == null || code.isEmpty() ? null : code.toLowerCase(Locale.ROOT);
    }

    private static void fetch(final List<JsonObject> cards, final boolean exact) throws IOException {
        for (int i = 0; i < cards.size(); i += BATCH) {
            final List<JsonObject> chunk = cards.subList(i, Math.min(cards.size(), i + BATCH));
            final JsonArray ids = new JsonArray();
            for (final JsonObject c : chunk) {
                final JsonObject id = new JsonObject();
                if (exact) {
                    final String key = printKey(c);
                    final String[] parts = key.split(":", 3);
                    id.addProperty("set", parts[1]);
                    id.addProperty("collector_number", parts[2]);
                } else {
                    id.addProperty("name", str(c, "name"));
                }
                ids.add(id);
            }
            final JsonObject body = new JsonObject();
            body.add("identifiers", ids);
            final JsonObject page = post(API + "cards/collection", body);
            final long now = System.currentTimeMillis();
            // On note aussi ce qui manque, pour ne pas le redemander pendant une journée.
            for (final JsonObject c : chunk) {
                final String key = exact ? printKey(c) : nameKey(str(c, "name"));
                CACHE.put(key, new Price("", "", "", "", "", now));
            }
            if (page == null || !page.has("data")) {
                continue;
            }
            for (final JsonElement el : page.getAsJsonArray("data")) {
                final JsonObject card = el.getAsJsonObject();
                final JsonObject prices = card.has("prices") && card.get("prices").isJsonObject() ? card.getAsJsonObject("prices") : new JsonObject();
                final JsonObject buy = card.has("purchase_uris") && card.get("purchase_uris").isJsonObject() ? card.getAsJsonObject("purchase_uris") : new JsonObject();
                final Price p = new Price(str(prices, "eur"), str(prices, "eur_foil"), str(buy, "cardmarket"),
                        str(card, "set").toUpperCase(Locale.ROOT), str(card, "collector_number"), now);
                CACHE.put("p:" + str(card, "set").toLowerCase(Locale.ROOT) + ":" + str(card, "collector_number").toLowerCase(Locale.ROOT), p);
                if (!exact) {
                    // Une carte demandée par son nom : Scryfall la renvoie sous son nom complet (« Recto // Verso »).
                    final String full = str(card, "name");
                    for (final JsonObject c : chunk) {
                        final String n = str(c, "name");
                        if (full.equalsIgnoreCase(n) || full.toLowerCase(Locale.ROOT).startsWith(n.toLowerCase(Locale.ROOT) + " // ")) {
                            CACHE.put(nameKey(n), p);
                        }
                    }
                }
            }
        }
    }

    private static JsonObject post(final String url, final JsonObject body) throws IOException {
        if (ScryfallRateLimiter.shouldSkip(url)) {
            throw new IOException("Scryfall en pause après trop de demandes, réessaie dans un instant.");
        }
        ScryfallRateLimiter.acquire(url);
        final HttpURLConnection c = (HttpURLConnection) URI.create(url).toURL().openConnection();
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("User-Agent", GuiBase.getInterface().getUserAgent());
        c.setRequestProperty("Accept", "application/json");
        c.setRequestProperty("Content-Type", "application/json");
        c.setConnectTimeout(10_000);
        c.setReadTimeout(20_000);
        try (OutputStream out = c.getOutputStream()) {
            out.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        final int code = c.getResponseCode();
        if (code == 404 || code == 400) {
            c.disconnect();
            return null;
        }
        if (code != 200) {
            ScryfallRateLimiter.noteIfRateLimited(code, url, c.getHeaderField("Retry-After"));
            c.disconnect();
            throw new IOException("Scryfall a répondu " + code);
        }
        try (Reader r = new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8)) {
            return JsonParser.parseReader(r).getAsJsonObject();
        }
    }

    // ------------------------------------------------------------------ cache sur disque

    private static File file() {
        return new File(ForgeConstants.CACHE_DIR, "prices-eur.json");
    }

    private static void load() {
        if (loaded) {
            return;
        }
        synchronized (Prices.class) {
            if (loaded) {
                return;
            }
            final File f = file();
            if (f.isFile()) {
                try {
                    final JsonObject o = JsonParser.parseString(Io.read(f)).getAsJsonObject();
                    for (final Map.Entry<String, JsonElement> e : o.entrySet()) {
                        final JsonObject p = e.getValue().getAsJsonObject();
                        CACHE.put(e.getKey(), new Price(str(p, "eur"), str(p, "foil"), str(p, "url"), str(p, "set"), str(p, "number"),
                                p.has("at") ? p.get("at").getAsLong() : 0));
                    }
                } catch (final IOException | RuntimeException e) {
                    System.err.println("Cache des prix illisible : " + e.getMessage());
                }
            }
            loaded = true;
        }
    }

    private static synchronized void save() {
        final JsonObject o = new JsonObject();
        final long now = System.currentTimeMillis();
        CACHE.forEach((k, p) -> {
            if (now - p.at() < 7 * TTL_MS) {
                final JsonObject j = new JsonObject();
                j.addProperty("eur", p.eur());
                j.addProperty("foil", p.eurFoil());
                j.addProperty("url", p.url());
                j.addProperty("set", p.set());
                j.addProperty("number", p.number());
                j.addProperty("at", p.at());
                o.add(k, j);
            }
        });
        try {
            final File f = file();
            f.getParentFile().mkdirs();
            final File tmp = new File(f.getPath() + ".tmp");
            Io.write(tmp, o.toString());
            Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (final IOException e) {
            System.err.println("Cache des prix non enregistré : " + e.getMessage());
        }
    }

    private static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : "";
    }
}
