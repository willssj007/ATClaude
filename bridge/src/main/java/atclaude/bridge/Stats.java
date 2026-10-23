package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.localinstance.properties.ForgeConstants;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Historique des parties terminées : une ligne par partie (résultat, deck, adversaires, durée, terrains,
 * blessures...). Les totaux et records sont calculés par l'interface à partir de cette liste.
 * Le fichier suit le compte : il est fusionné partie par partie lors de la synchronisation.
 */
final class Stats {

    /** Au-delà, les parties les plus anciennes sont oubliées. */
    private static final int MAX_GAMES = 3000;

    private Stats() { }

    static File file() {
        return new File(ForgeConstants.USER_DIR, "atclaude-stats.json");
    }

    static synchronized JsonObject load() {
        final File f = file();
        if (f.isFile()) {
            try {
                final JsonObject o = JsonParser.parseString(Io.read(f)).getAsJsonObject();
                if (o.has("games") && o.get("games").isJsonArray()) {
                    return o;
                }
            } catch (final IOException | RuntimeException e) {
                System.err.println("Statistiques illisibles, on repart de zéro : " + e.getMessage());
            }
        }
        final JsonObject o = new JsonObject();
        o.addProperty("version", 1);
        o.add("games", new JsonArray());
        o.addProperty("clearedAt", 0);
        return o;
    }

    static synchronized void store(final JsonObject stats) {
        try {
            final File f = file();
            f.getParentFile().mkdirs();
            final File tmp = new File(f.getPath() + ".tmp");
            Io.write(tmp, stats.toString());
            Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (final IOException e) {
            System.err.println("Statistiques non enregistrées : " + e.getMessage());
        }
    }

    /** Ajoute une partie (ou remplace celle de même identifiant). */
    static synchronized void add(final JsonObject game) {
        final JsonObject stats = load();
        final JsonArray games = stats.getAsJsonArray("games");
        final String id = game.get("id").getAsString();
        for (int i = 0; i < games.size(); i++) {
            if (id.equals(str(games.get(i).getAsJsonObject(), "id"))) {
                games.remove(i);
                break;
            }
        }
        games.add(game);
        while (games.size() > MAX_GAMES) {
            games.remove(0);
        }
        store(stats);
    }

    /** Ajoute à l'historique de l'appareil les parties d'un autre ; renvoie le nombre de parties en plus. */
    static synchronized int mergeIn(final JsonObject other) {
        final JsonObject before = load();
        final JsonObject merged = merge(before, other);
        store(merged);
        return merged.getAsJsonArray("games").size() - before.getAsJsonArray("games").size();
    }

    /**
     * Efface l'historique d'un mode (carrière Planeswalker ou Sandbox ; null : les deux). Les parties effacées ne
     * reviennent pas par la synchronisation.
     */
    static synchronized void clear(final Boolean career) {
        final JsonObject stats = load();
        final long now = System.currentTimeMillis();
        if (career == null) {
            stats.add("games", new JsonArray());
            stats.addProperty("clearedAt", now);
        } else {
            final JsonArray kept = new JsonArray();
            for (final JsonElement e : stats.getAsJsonArray("games")) {
                if (e.isJsonObject() && isCareer(e.getAsJsonObject()) != career) {
                    kept.add(e);
                }
            }
            stats.add("games", kept);
            stats.addProperty(career ? CLEARED_CAREER : CLEARED_SANDBOX, now);
        }
        store(stats);
    }

    private static final String CLEARED_CAREER = "clearedAtCareer";
    private static final String CLEARED_SANDBOX = "clearedAtSandbox";

    private static boolean isCareer(final JsonObject g) {
        return g.has("career") && g.get("career").isJsonPrimitive() && g.get("career").getAsBoolean();
    }

    /** Un deck renommé garde son historique. */
    static synchronized void renameDeck(final String oldKey, final String newKey, final String newName) {
        if (oldKey.equals(newKey)) {
            return;
        }
        final JsonObject stats = load();
        boolean changed = false;
        for (final JsonElement e : stats.getAsJsonArray("games")) {
            final JsonObject deck = e.getAsJsonObject().getAsJsonObject("deck");
            if (deck != null && oldKey.equals(str(deck, "key"))) {
                deck.addProperty("key", newKey);
                deck.addProperty("name", newName);
                changed = true;
            }
        }
        if (changed) {
            store(stats);
        }
    }

    /**
     * Fusion de deux historiques : toutes les parties des deux (une seule fois chacune), sauf celles d'avant
     * le dernier effacement. Le contenu distant n'est pas digne de confiance : on ne garde que des objets
     * avec un identifiant et une date.
     */
    static JsonObject merge(final JsonObject a, final JsonObject b) {
        final long cleared = Math.max(num(a, "clearedAt"), num(b, "clearedAt"));
        final long clearedCareer = Math.max(cleared, Math.max(num(a, CLEARED_CAREER), num(b, CLEARED_CAREER)));
        final long clearedSandbox = Math.max(cleared, Math.max(num(a, CLEARED_SANDBOX), num(b, CLEARED_SANDBOX)));
        final Map<String, JsonObject> byId = new LinkedHashMap<>();
        for (final JsonObject src : new JsonObject[]{a, b}) {
            if (src == null || !src.has("games") || !src.get("games").isJsonArray()) {
                continue;
            }
            for (final JsonElement e : src.getAsJsonArray("games")) {
                if (!e.isJsonObject()) {
                    continue;
                }
                final JsonObject g = e.getAsJsonObject();
                final String id = str(g, "id");
                if (id.isEmpty() || num(g, "at") <= (isCareer(g) ? clearedCareer : clearedSandbox)) {
                    continue;
                }
                byId.putIfAbsent(id, g);
            }
        }
        final List<JsonObject> games = new ArrayList<>(byId.values());
        games.sort((x, y) -> Long.compare(num(x, "at"), num(y, "at")));
        final JsonArray out = new JsonArray();
        for (int i = Math.max(0, games.size() - MAX_GAMES); i < games.size(); i++) {
            out.add(games.get(i));
        }
        final JsonObject m = new JsonObject();
        m.addProperty("version", 1);
        m.add("games", out);
        m.addProperty("clearedAt", cleared);
        m.addProperty(CLEARED_CAREER, clearedCareer);
        m.addProperty(CLEARED_SANDBOX, clearedSandbox);
        return m;
    }

    private static long num(final JsonObject o, final String key) {
        try {
            return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsLong() : 0;
        } catch (final RuntimeException e) {
            return 0;
        }
    }

    private static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsString() : "";
    }
}
