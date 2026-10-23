package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Recommandations d'EDHREC pour un commandant : cartes les plus jouées et à plus forte synergie, par
 * catégorie, et combos les plus répandus. Lu dans les fichiers JSON publics du site (json.edhrec.com),
 * gardé un jour en cache sur l'appareil (et réutilisé hors connexion).
 */
final class Edhrec {

    private static final String BASE = System.getProperty("atclaude.edhrecApi", "https://json.edhrec.com/pages/");
    private static final long FRESH_MS = 24L * 3600_000;

    private static final Map<String, String> LIST_TITLES = map(new String[][]{
            {"newcards", "Nouveautés"},
            {"topcards", "Les plus jouées"},
            {"highliftcards", "Plus jouées ici qu'ailleurs"},
            {"highsynergycards", "Forte synergie"},
            {"gamechangers", "Game Changers"},
            {"creatures", "Créatures"},
            {"instants", "Éphémères"},
            {"sorceries", "Rituels"},
            {"utilityartifacts", "Artefacts utilitaires"},
            {"enchantments", "Enchantements"},
            {"planeswalkers", "Planeswalkers"},
            {"battles", "Batailles"},
            {"utilitylands", "Terrains utilitaires"},
            {"manaartifacts", "Artefacts de mana"},
            {"lands", "Terrains"}});

    private static final Map<String, String> RESULTS = map(new String[][]{
            {"Infinite creature ETB", "Arrivées de créatures infinies"},
            {"Infinite creature LTB", "Départs de créatures infinis"},
            {"Infinite death triggers", "Déclencheurs de mort infinis"},
            {"Infinite creature sacrifice triggers", "Sacrifices de créatures infinis"},
            {"Infinite colored mana", "Mana coloré infini"},
            {"Infinite colorless mana", "Mana incolore infini"},
            {"Infinite mana", "Mana infini"},
            {"Infinite red mana", "Mana rouge infini"},
            {"Infinite green mana", "Mana vert infini"},
            {"Infinite blue mana", "Mana bleu infini"},
            {"Infinite black mana", "Mana noir infini"},
            {"Infinite white mana", "Mana blanc infini"},
            {"Infinite +1/+1 counters on creatures you control", "Marqueurs +1/+1 infinis sur vos créatures"},
            {"Win the game at the beginning of your next upkeep", "Victoire à votre prochain entretien"},
            {"Win the game", "Victoire"},
            {"Lock", "Verrou (les adversaires ne peuvent plus jouer)"},
            {"Infinite creature tokens with haste", "Jetons de créature infinis avec la célérité"},
            {"Infinite creature tokens", "Jetons de créature infinis"},
            {"Infinite turns", "Tours supplémentaires infinis"},
            {"Infinite storm count", "Tempête infinie"},
            {"Infinite untap of creatures you control", "Dégagements infinis de vos créatures"},
            {"Infinite mana creatures you control can produce", "Mana infini (de vos créatures)"},
            {"Infinite commander casts", "Lancements de commandant infinis"},
            {"Infinite damage", "Blessures infinies"},
            {"Infinite combat phases", "Phases de combat infinies"},
            {"Infinite lifegain", "Gain de vie infini"},
            {"Infinite lifegain triggers", "Déclencheurs de gain de vie infinis"},
            {"Infinite combat damage", "Blessures de combat infinies"},
            {"Infinite card draw", "Pioche infinie"},
            {"Infinite draw triggers", "Déclencheurs de pioche infinis"},
            {"Infinite magecraft triggers", "Déclencheurs de magecraft infinis"},
            {"Infinite proliferate", "Prolifération infinie"},
            {"Infinite mill", "Meule infinie"},
            {"Infinite self-mill", "Meule infinie (soi-même)"},
            {"Infinite lifeloss", "Perte de vie infinie"},
            {"Infinite looting", "Pioche-défausse infinie"},
            {"Infinite Treasure tokens", "Trésors infinis"},
            {"Infinite ETB", "Arrivées infinies"},
            {"Infinite LTB", "Départs infinis"},
            {"Target opponent loses the game", "Un adversaire perd la partie"},
            {"Each opponent loses the game", "Chaque adversaire perd la partie"},
            {"Infinitely large creature until end of turn", "Créature infiniment grande jusqu'à la fin du tour"},
            {"Exile your library", "Exil de votre bibliothèque"}});

    /** Pages déjà lues pendant cette session : chemin → (date, contenu). */
    private static final Map<String, Object[]> MEMORY = new HashMap<>();

    private Edhrec() { }

    private static Map<String, String> map(final String[][] pairs) {
        final Map<String, String> m = new HashMap<>();
        for (final String[] p : pairs) {
            m.put(p[0], p[1]);
        }
        return java.util.Collections.unmodifiableMap(m);
    }

    /**
     * Identifiant EDHREC d'un ou deux commandants : « Atraxa, Praetors' Voice » → « atraxa-praetors-voice » ;
     * pour des partenaires, les deux noms dans l'ordre alphabétique.
     */
    static String slug(final List<String> commanders) {
        final List<String> parts = new ArrayList<>();
        for (final String name : commanders) {
            String front = name.contains(" // ") ? name.substring(0, name.indexOf(" // ")) : name;
            front = Normalizer.normalize(front, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
            front = front.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 \\-]", "").trim().replaceAll("[\\s\\-]+", "-");
            if (!front.isEmpty()) {
                parts.add(front);
            }
        }
        parts.sort(String::compareTo);
        return String.join("-", parts);
    }

    /** Lecture réseau (fil réseau du pont). Renvoie les deux pages brutes : commandant et combos. */
    static JsonObject fetch(final List<String> commanders) {
        final String slug = slug(commanders);
        if (slug.isEmpty()) {
            throw new IllegalArgumentException("Choisis d'abord un commandant.");
        }
        final JsonObject raw = new JsonObject();
        raw.addProperty("slug", slug);
        final Object[] page = page("commanders/" + slug);
        raw.add("page", (JsonElement) page[1]);
        raw.addProperty("fetchedAt", (Long) page[0]);
        raw.addProperty("offline", (Boolean) page[2]);
        try {
            raw.add("combos", (JsonElement) page("combos/" + slug)[1]);
        } catch (final RuntimeException e) {
            raw.add("combos", new JsonObject()); // pas de combos connus : la page reste utile
        }
        return raw;
    }

    /** Une page JSON d'EDHREC, en suivant ses redirections (ordre des partenaires) ; cache d'un jour. */
    private static Object[] page(final String path) {
        synchronized (MEMORY) {
            final Object[] hit = MEMORY.get(path);
            if (hit != null && System.currentTimeMillis() - (Long) hit[0] < FRESH_MS) {
                return hit;
            }
        }
        final File cache = new File(ForgeConstants.CACHE_DIR, "edhrec/" + path.replace('/', '_') + ".json");
        if (cache.isFile() && System.currentTimeMillis() - cache.lastModified() < FRESH_MS) {
            try {
                final Object[] hit = {cache.lastModified(), JsonParser.parseString(Io.read(cache)), false};
                remember(path, hit);
                return hit;
            } catch (final IOException | RuntimeException ignored) {
                // cache abîmé : on relit le site
            }
        }
        try {
            String current = path;
            JsonObject json = null;
            for (int hop = 0; hop < 3; hop++) {
                json = JsonParser.parseString(get(BASE + current + ".json")).getAsJsonObject();
                if (!json.has("redirect")) {
                    break;
                }
                current = json.get("redirect").getAsString().replaceFirst("^/", "");
            }
            if (json == null || json.has("redirect")) {
                throw new IllegalStateException("EDHREC : trop de redirections.");
            }
            cache.getParentFile().mkdirs();
            Io.write(cache, json.toString());
            final Object[] hit = {System.currentTimeMillis(), json, false};
            remember(path, hit);
            return hit;
        } catch (final NotFound e) {
            throw new IllegalStateException("EDHREC ne connaît pas ce commandant (ou ce duo de partenaires).");
        } catch (final IOException | RuntimeException e) {
            // Hors connexion : la dernière version gardée, même ancienne.
            if (cache.isFile()) {
                try {
                    return new Object[]{cache.lastModified(), JsonParser.parseString(Io.read(cache)), true};
                } catch (final IOException | RuntimeException ignored) {
                    // rien de mieux
                }
            }
            throw new IllegalStateException("EDHREC injoignable (" + e.getMessage() + "). Vérifie la connexion Internet.");
        }
    }

    private static void remember(final String path, final Object[] hit) {
        synchronized (MEMORY) {
            MEMORY.put(path, hit);
        }
    }

    private static final class NotFound extends IOException {
        NotFound() {
            super("introuvable");
        }
    }

    private static String get(final String url) throws IOException {
        final HttpURLConnection c = Net.open(url);
        c.setRequestProperty("User-Agent", "ArcaneTable/0.1 (+https://github.com/willssj007/ATClaude)");
        c.setRequestProperty("Accept", "application/json");
        c.setConnectTimeout(15_000);
        c.setReadTimeout(30_000);
        final int code = c.getResponseCode();
        // Commandant inconnu : le site répond 403 (ou 404).
        if (code == 403 || code == 404) {
            throw new NotFound();
        }
        if (code >= 300) {
            throw new IOException("réponse " + code);
        }
        try (InputStream in = c.getInputStream()) {
            return Io.readAll(in);
        }
    }

    /**
     * Mise en forme pour l'interface (fil principal du pont : utilise le catalogue). Les cartes inconnues de
     * Forge sont écartées ; chaque carte garde son taux d'inclusion et sa synergie.
     */
    static JsonObject present(final Catalog catalog, final JsonObject raw) {
        final JsonObject out = new JsonObject();
        final String slug = raw.get("slug").getAsString();
        out.addProperty("slug", slug);
        out.addProperty("url", "https://edhrec.com/commanders/" + slug);
        out.addProperty("fetchedAt", raw.get("fetchedAt").getAsLong());
        out.addProperty("offline", raw.get("offline").getAsBoolean());
        final JsonObject page = raw.getAsJsonObject("page");
        final JsonObject dict = obj(obj(page, "container"), "json_dict");
        final JsonObject card = obj(dict, "card");
        out.addProperty("decks", num(card, "num_decks"));
        out.addProperty("salt", card.has("salt") && card.get("salt").isJsonPrimitive() ? card.get("salt").getAsDouble() : 0);

        final Map<String, JsonObject> resolved = new HashMap<>();
        final JsonArray lists = new JsonArray();
        final Map<String, JsonObject> all = new LinkedHashMap<>();
        for (final JsonElement e : arr(dict, "cardlists")) {
            final JsonObject list = e.getAsJsonObject();
            final String tag = str(list, "tag");
            final JsonArray cards = new JsonArray();
            for (final JsonElement ce : arr(list, "cardviews")) {
                final JsonObject cv = ce.getAsJsonObject();
                final JsonObject c = cardEntry(catalog, resolved, str(cv, "name"));
                if (c == null) {
                    continue;
                }
                final long decks = num(cv, "num_decks");
                final long potential = num(cv, "potential_decks");
                c.addProperty("inclusion", potential > 0 ? Math.round(1000.0 * decks / potential) / 10.0 : 0);
                c.addProperty("synergy", cv.has("synergy") && cv.get("synergy").isJsonPrimitive() ? Math.round(cv.get("synergy").getAsDouble() * 1000) / 10.0 : 0);
                c.addProperty("decks", decks);
                cards.add(c);
                all.putIfAbsent(str(cv, "name"), c);
            }
            if (cards.size() == 0) {
                continue;
            }
            final JsonObject l = new JsonObject();
            l.addProperty("tag", tag);
            l.addProperty("title", LIST_TITLES.getOrDefault(tag, str(list, "header")));
            l.add("cards", cards);
            lists.add(l);
        }
        // Les plus fortes synergies, toutes catégories confondues (hors terrains de base).
        final List<JsonObject> bySynergy = new ArrayList<>(all.values());
        bySynergy.removeIf(c -> c.get("basic").getAsBoolean() || c.get("synergy").getAsDouble() <= 0);
        bySynergy.sort((a, b) -> Double.compare(b.get("synergy").getAsDouble(), a.get("synergy").getAsDouble()));
        final JsonArray top = new JsonArray();
        for (int i = 0; i < Math.min(40, bySynergy.size()); i++) {
            top.add(bySynergy.get(i));
        }
        out.add("synergy", top);
        out.add("lists", lists);

        final JsonArray combos = new JsonArray();
        for (final JsonElement e : arr(obj(obj(raw.getAsJsonObject("combos"), "container"), "json_dict"), "cardlists")) {
            final JsonObject list = e.getAsJsonObject();
            final JsonObject combo = obj(list, "combo");
            if (combo.size() == 0) {
                continue;
            }
            final JsonArray cards = new JsonArray();
            boolean complete = true;
            for (final JsonElement ce : arr(list, "cardviews")) {
                final JsonObject c = cardEntry(catalog, resolved, str(ce.getAsJsonObject(), "name"));
                if (c == null) {
                    complete = false;
                    break;
                }
                cards.add(c);
            }
            if (!complete || cards.size() == 0) {
                continue;
            }
            final JsonObject o = new JsonObject();
            o.add("cards", cards);
            final JsonArray results = new JsonArray();
            for (final JsonElement r : arr(combo, "results")) {
                results.add(RESULTS.getOrDefault(r.getAsString(), r.getAsString()));
            }
            o.add("results", results);
            o.addProperty("decks", num(combo, "count"));
            o.addProperty("percent", combo.has("percentage") && combo.get("percentage").isJsonPrimitive() ? combo.get("percentage").getAsDouble() : 0);
            final JsonObject vote = obj(combo, "comboVote");
            o.addProperty("bracket", str(vote, "bracket"));
            o.addProperty("url", "https://edhrec.com" + str(list, "href"));
            combos.add(o);
            if (combos.size() >= 60) {
                break;
            }
        }
        out.add("combos", combos);

        final JsonArray themes = new JsonArray();
        for (final JsonElement e : arr(obj(page, "panels"), "taglinks")) {
            final JsonObject t = e.getAsJsonObject();
            final JsonObject o = new JsonObject();
            o.addProperty("name", str(t, "value"));
            o.addProperty("decks", num(t, "count"));
            themes.add(o);
            if (themes.size() >= 8) {
                break;
            }
        }
        out.add("themes", themes);
        out.add("brackets", page.has("bracket_counts") && page.get("bracket_counts").isJsonObject() ? page.getAsJsonObject("bracket_counts") : new JsonObject());
        return out;
    }

    private static JsonObject cardEntry(final Catalog catalog, final Map<String, JsonObject> resolved, final String name) {
        if (name.isEmpty()) {
            return null;
        }
        if (!resolved.containsKey(name)) {
            final PaperCard pc = catalog.resolve(name);
            resolved.put(name, pc == null ? null : Catalog.paperJson(pc));
        }
        final JsonObject c = resolved.get(name);
        return c == null ? null : c.deepCopy();
    }

    private static JsonObject obj(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonObject() ? o.getAsJsonObject(key) : new JsonObject();
    }

    private static JsonArray arr(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonArray() ? o.getAsJsonArray(key) : new JsonArray();
    }

    private static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsString() : "";
    }

    private static long num(final JsonObject o, final String key) {
        try {
            return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsLong() : 0;
        } catch (final RuntimeException e) {
            return 0;
        }
    }
}
