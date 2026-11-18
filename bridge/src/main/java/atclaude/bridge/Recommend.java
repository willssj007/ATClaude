package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.item.PaperCard;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Cartes conseillées pour les commandants d'un deck : la page EDHREC d'un commandant officiel, ou les synergies
 * calculées par l'appli (commandant perso, commandant inconnu d'EDHREC, pas de connexion). Le résultat sert à la
 * fenêtre « EDHREC / Synergies » et au tri « Conseillées » de la recherche du deck builder ; gardé quelques heures.
 */
final class Recommend {

    private Recommend() { }

    /** Une carte conseillée : son score (pour le tri), le badge court et l'explication. */
    static final class Rec {
        final double score;
        final String label;
        final String title;

        Rec(final double score, final String label, final String title) {
            this.score = score;
            this.label = label;
            this.title = title;
        }
    }

    private static final long FRESH_MS = 6L * 3600_000;

    /** Clé des commandants → {date, données complètes, scores}. Les huit derniers. */
    private static final Map<String, Object[]> CACHE = Collections.synchronizedMap(new LinkedHashMap<String, Object[]>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(final Map.Entry<String, Object[]> eldest) {
            return size() > 8;
        }
    });

    /** Les commandants, dans l'ordre alphabétique ; pour une carte perso, son script compte (modifiée : recalculée). */
    private static String key(final Catalog catalog, final List<String> names) {
        final List<String> parts = new ArrayList<>();
        for (final String n : names) {
            final PaperCard pc = catalog.resolve(n);
            parts.add(pc == null ? n.toLowerCase(Locale.ROOT)
                    : pc.getName() + (pc.getRules().isCustom() ? "#" + Synergy.signature(pc) : ""));
        }
        Collections.sort(parts);
        return String.join("|", parts);
    }

    private static boolean anyCustom(final Catalog catalog, final List<String> names) {
        for (final String n : names) {
            final PaperCard pc = catalog.resolve(n);
            if (pc != null && pc.getRules().isCustom()) {
                return true;
            }
        }
        return false;
    }

    /** Les données complètes (fil réseau du pont : peut lire EDHREC). */
    static JsonObject full(final Catalog catalog, final List<String> names) {
        if (names.isEmpty()) {
            throw new IllegalArgumentException("Choisis d'abord un commandant.");
        }
        final String key = key(catalog, names);
        final Object[] hit = CACHE.get(key);
        if (hit != null && System.currentTimeMillis() - (Long) hit[0] < FRESH_MS) {
            return (JsonObject) hit[1];
        }
        JsonObject data;
        if (anyCustom(catalog, names)) {
            data = Synergy.compute(catalog, names, "");
        } else {
            try {
                data = Edhrec.present(catalog, Edhrec.fetch(names));
                data.addProperty("source", "edhrec");
            } catch (final RuntimeException e) {
                // Inconnu d'EDHREC (trop récent) ou pas de connexion : le calcul de l'appli prend le relais.
                data = Synergy.compute(catalog, names, e.getMessage());
            }
        }
        final Map<String, Rec> scores = scoresOf(data);
        data.remove("scores");
        data.addProperty("count", scores.size());
        CACHE.put(key, new Object[] {System.currentTimeMillis(), data, scores});
        return data;
    }

    /** Ce que le deck builder a besoin de savoir : d'où viennent les conseils et combien de cartes. */
    static JsonObject summary(final Catalog catalog, final List<String> names) {
        final JsonObject data = full(catalog, names);
        final JsonObject o = new JsonObject();
        o.addProperty("source", data.get("source").getAsString());
        o.addProperty("count", data.get("count").getAsInt());
        o.addProperty("offline", data.has("offline") && data.get("offline").getAsBoolean());
        o.addProperty("note", data.has("note") ? data.get("note").getAsString() : "");
        return o;
    }

    /** Les scores déjà calculés pour ces commandants (null : pas encore demandés, rien n'est lu ici). */
    static Map<String, Rec> scores(final Catalog catalog, final List<String> names) {
        if (names.isEmpty()) {
            return null;
        }
        final Object[] hit = CACHE.get(key(catalog, names));
        @SuppressWarnings("unchecked")
        final Map<String, Rec> scores = hit == null ? null : (Map<String, Rec>) hit[2];
        return scores;
    }

    private static Map<String, Rec> scoresOf(final JsonObject data) {
        final Map<String, Rec> out = new HashMap<>();
        if ("local".equals(data.get("source").getAsString())) {
            final JsonObject scores = data.has("scores") ? data.getAsJsonObject("scores") : new JsonObject();
            for (final Map.Entry<String, JsonElement> e : scores.entrySet()) {
                final JsonArray v = e.getValue().getAsJsonArray();
                final String why = v.get(1).getAsString();
                final String label = why.isEmpty() ? "Synergie" : why.split(" · ")[0];
                out.put(e.getKey(), new Rec(v.get(0).getAsDouble(), label,
                        "Synergie avec ce commandant" + (why.isEmpty() ? "" : " : " + why) + " (calculée par l'appli)"));
            }
            return out;
        }
        for (final JsonElement le : data.getAsJsonArray("lists")) {
            for (final JsonElement ce : le.getAsJsonObject().getAsJsonArray("cards")) {
                final JsonObject c = ce.getAsJsonObject();
                final String name = c.get("name").getAsString();
                if (out.containsKey(name) || c.get("basic").getAsBoolean()) {
                    continue;
                }
                final double inclusion = c.get("inclusion").getAsDouble();
                final double synergy = c.get("synergy").getAsDouble();
                final long incl = Math.round(inclusion);
                final long syn = Math.round(synergy);
                out.put(name, new Rec(inclusion + 0.6 * Math.max(0, synergy), incl + " %",
                        "Dans " + incl + " % des decks de ce commandant sur EDHREC" + (syn > 0 ? ", synergie +" + syn + " %" : "")));
            }
        }
        return out;
    }
}
