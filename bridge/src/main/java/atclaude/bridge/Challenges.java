package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;
import java.util.function.Function;
import java.util.function.ToIntFunction;

/**
 * Défis du jour et de la semaine du mode Planeswalker. Chaque jour, 3 défis tirés au hasard ; chaque semaine (du lundi
 * au dimanche), 3 défis plus longs. Le tirage ne dépend que de la date : le même sur tous les appareils, sans rien
 * enregistrer tant qu'on ne joue pas. Un défi du jour peut être changé une fois par jour.
 *
 * Chaque duel de carrière terminé fait avancer les défis en cours ; un défi accompli donne aussitôt son mana (et un
 * booster pour certains défis de la semaine), montré sur l'écran de fin. La progression est dans le fichier de la
 * carrière, rangée sous la date du jour et celle du lundi : à la période suivante, elle repart de zéro.
 */
final class Challenges {

    static final int DAILY = 3;
    static final int WEEKLY = 3;

    private enum Kind { SUM, MAX, SET }

    private static final class Def {
        final String id;
        final String text;
        final int goal;
        final int mana;
        final int boosters;
        final Kind kind;
        final ToIntFunction<JsonObject> gain;
        final Function<JsonObject, List<String>> keys;
        /** Défis du même groupe : pas deux le même jour (deux couleurs, par exemple). */
        final String group;

        Def(final String id, final String text, final int goal, final int mana, final int boosters, final Kind kind,
                final ToIntFunction<JsonObject> gain, final Function<JsonObject, List<String>> keys, final String group) {
            this.id = id;
            this.text = text;
            this.goal = goal;
            this.mana = mana;
            this.boosters = boosters;
            this.kind = kind;
            this.gain = gain;
            this.keys = keys;
            this.group = group;
        }
    }

    private static Def sum(final String id, final String text, final int goal, final int mana, final int boosters,
            final ToIntFunction<JsonObject> gain) {
        return new Def(id, text, goal, mana, boosters, Kind.SUM, gain, null, id);
    }

    // ------------------------------------------------------------------ lecture d'un duel terminé

    private static boolean won(final JsonObject g) {
        return "win".equals(str(g, "result"));
    }

    private static int stat(final JsonObject g, final String k) {
        return g.has(k) && g.get(k).isJsonPrimitive() ? g.get(k).getAsInt() : 0;
    }

    private static String identity(final JsonObject g) {
        return g.has("deck") && g.get("deck").isJsonObject() ? str(g.getAsJsonObject("deck"), "identity") : "";
    }

    private static int wonWith(final JsonObject g, final String color) {
        return won(g) && identity(g).contains(color) ? 1 : 0;
    }

    /** Avant ce tour (celui de la partie, tous joueurs compris), pour les victoires rapides. */
    static final int FAST_TURN = 16;

    private static final String[][] COLORS = {
        {"W", "blanc"}, {"U", "bleu"}, {"B", "noir"}, {"R", "rouge"}, {"G", "vert"},
    };

    private static final List<Def> DAILY_DEFS = new ArrayList<>();
    private static final List<Def> WEEKLY_DEFS = new ArrayList<>();

    static {
        DAILY_DEFS.add(sum("d-win2", "Gagne 2 duels", 2, 150, 0, g -> won(g) ? 1 : 0));
        DAILY_DEFS.add(sum("d-play3", "Joue 3 duels jusqu'au bout", 3, 100, 0, g -> g.has("conceded") && g.get("conceded").getAsBoolean() ? 0 : 1));
        DAILY_DEFS.add(sum("d-dmg60", "Inflige 60 blessures à tes adversaires", 60, 100, 0, g -> stat(g, "dealt")));
        DAILY_DEFS.add(sum("d-spells15", "Lance 15 sorts", 15, 100, 0, g -> stat(g, "spells")));
        DAILY_DEFS.add(sum("d-lands12", "Joue 12 terrains", 12, 75, 0, g -> stat(g, "lands")));
        DAILY_DEFS.add(sum("d-fast", "Gagne un duel avant le tour " + FAST_TURN, 1, 150, 0,
                g -> won(g) && stat(g, "turns") < FAST_TURN ? 1 : 0));
        DAILY_DEFS.add(sum("d-healthy", "Gagne un duel en gardant 30 points de vie ou plus", 1, 150, 0,
                g -> won(g) && stat(g, "life") >= 30 ? 1 : 0));
        DAILY_DEFS.add(sum("d-nomull", "Gagne un duel sans mulligan", 1, 100, 0,
                g -> won(g) && stat(g, "mulligans") == 0 ? 1 : 0));
        DAILY_DEFS.add(sum("d-burst", "Inflige 40 blessures en un seul duel", 1, 125, 0,
                g -> stat(g, "dealt") >= 40 ? 1 : 0));
        for (final String[] c : COLORS) {
            DAILY_DEFS.add(new Def("d-color-" + c[0], "Gagne un duel avec un deck " + c[1], 1, 125, 0, Kind.SUM,
                    g -> wonWith(g, c[0]), null, "color"));
        }

        WEEKLY_DEFS.add(sum("w-win7", "Gagne 7 duels", 7, 500, 1, g -> won(g) ? 1 : 0));
        WEEKLY_DEFS.add(sum("w-play12", "Joue 12 duels jusqu'au bout", 12, 400, 0,
                g -> g.has("conceded") && g.get("conceded").getAsBoolean() ? 0 : 1));
        WEEKLY_DEFS.add(sum("w-dmg400", "Inflige 400 blessures à tes adversaires", 400, 400, 1, g -> stat(g, "dealt")));
        WEEKLY_DEFS.add(sum("w-spells80", "Lance 80 sorts", 80, 400, 0, g -> stat(g, "spells")));
        WEEKLY_DEFS.add(sum("w-fast3", "Gagne 3 duels avant le tour " + FAST_TURN, 3, 500, 1,
                g -> won(g) && stat(g, "turns") < FAST_TURN ? 1 : 0));
        WEEKLY_DEFS.add(new Def("w-streak3", "Gagne 3 duels d'affilée", 3, 500, 1, Kind.MAX,
                g -> stat(g, "streak"), null, "w-streak3"));
        WEEKLY_DEFS.add(new Def("w-decks3", "Gagne avec 3 decks différents", 3, 500, 1, Kind.SET, null,
                g -> won(g) && g.has("deck") ? List.of(str(g.getAsJsonObject("deck"), "name")) : List.of(), "w-decks3"));
        WEEKLY_DEFS.add(new Def("w-colors5", "Gagne avec un deck de chaque couleur (blanc, bleu, noir, rouge, vert)", 5, 700, 1,
                Kind.SET, null, g -> {
                    final List<String> out = new ArrayList<>();
                    if (won(g)) {
                        for (final String[] c : COLORS) {
                            if (identity(g).contains(c[0])) {
                                out.add(c[0]);
                            }
                        }
                    }
                    return out;
                }, "w-colors5"));
    }

    private Challenges() { }

    // ------------------------------------------------------------------ dates

    /** Pour les essais : une date fixe (aaaa-mm-jj) au lieu de celle de l'appareil. */
    private static Calendar now() {
        final Calendar cal = Calendar.getInstance();
        final String fixed = System.getProperty("atclaude.today");
        if (fixed != null && fixed.matches("\\d{4}-\\d{2}-\\d{2}")) {
            cal.set(Integer.parseInt(fixed.substring(0, 4)), Integer.parseInt(fixed.substring(5, 7)) - 1,
                    Integer.parseInt(fixed.substring(8, 10)), 12, 0, 0);
        }
        return cal;
    }

    private static Calendar midnight(final Calendar day) {
        final Calendar c = (Calendar) day.clone();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c;
    }

    private static String key(final Calendar c) {
        return String.format(Locale.ROOT, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** Le lundi de la semaine (minuit). */
    private static Calendar monday(final Calendar day) {
        final Calendar c = midnight(day);
        c.add(Calendar.DAY_OF_MONTH, -((c.get(Calendar.DAY_OF_WEEK) + 5) % 7));
        return c;
    }

    // ------------------------------------------------------------------ tirage

    /** Les défis d'une période : tirés d'après sa date, sans deux du même groupe. */
    private static List<Def> draw(final List<Def> pool, final int n, final String period) {
        final List<Def> left = new ArrayList<>(pool);
        final Random r = new Random(period.hashCode() * 31L + pool.size());
        final List<Def> out = new ArrayList<>();
        final Set<String> groups = new LinkedHashSet<>();
        while (out.size() < n && !left.isEmpty()) {
            final Def d = left.remove(r.nextInt(left.size()));
            if (groups.add(d.group)) {
                out.add(d);
            }
        }
        return out;
    }

    /** Le défi du jour qui remplace celui qu'on change : le premier du tirage de remplacement qui n'est pas déjà là. */
    private static Def replacement(final List<Def> current, final String day) {
        final Set<String> groups = new LinkedHashSet<>();
        current.forEach(d -> groups.add(d.group));
        for (final Def d : draw(DAILY_DEFS, DAILY_DEFS.size(), day + "/swap")) {
            if (!groups.contains(d.group)) {
                return d;
            }
        }
        return null;
    }

    private static Def def(final String id) {
        for (final List<Def> pool : List.of(DAILY_DEFS, WEEKLY_DEFS)) {
            for (final Def d : pool) {
                if (d.id.equals(id)) {
                    return d;
                }
            }
        }
        return null;
    }

    /** La progression de la période (vide si elle date d'une autre période). */
    private static JsonObject period(final JsonObject c, final String which, final String key) {
        final JsonObject all = c.has("challenges") && c.get("challenges").isJsonObject() ? c.getAsJsonObject("challenges") : new JsonObject();
        final JsonObject p = all.has(which) && all.get(which).isJsonObject() ? all.getAsJsonObject(which) : null;
        if (p != null && key.equals(str(p, "key"))) {
            return p;
        }
        final JsonObject fresh = new JsonObject();
        fresh.addProperty("key", key);
        fresh.add("progress", new JsonObject());
        fresh.add("sets", new JsonObject());
        fresh.add("done", new JsonArray());
        return fresh;
    }

    private static void store(final JsonObject c, final String which, final JsonObject p) {
        final JsonObject all = c.has("challenges") && c.get("challenges").isJsonObject() ? c.getAsJsonObject("challenges") : new JsonObject();
        all.add(which, p);
        c.add("challenges", all);
    }

    private static List<Def> dailies(final JsonObject p, final String day) {
        final List<Def> list = draw(DAILY_DEFS, DAILY, day);
        final Def from = def(str(p, "swapFrom"));
        final Def to = def(str(p, "swapTo"));
        if (from != null && to != null) {
            for (int i = 0; i < list.size(); i++) {
                if (list.get(i).id.equals(from.id)) {
                    list.set(i, to);
                }
            }
        }
        return list;
    }

    // ------------------------------------------------------------------ vue

    /** Les défis en cours, leur progression et la fin de chaque période (pour l'écran Duel). */
    static JsonObject view(final JsonObject c) {
        final Calendar today = now();
        final String day = key(today);
        final String week = key(monday(today));
        final JsonObject d = period(c, "daily", day);
        final JsonObject w = period(c, "weekly", week);
        final JsonObject o = new JsonObject();
        o.add("daily", list(dailies(d, day), d));
        o.add("weekly", list(draw(WEEKLY_DEFS, WEEKLY, week), w));
        o.addProperty("canSwap", !d.has("swapFrom"));
        final Calendar endDay = midnight(today);
        endDay.add(Calendar.DAY_OF_MONTH, 1);
        final Calendar endWeek = monday(today);
        endWeek.add(Calendar.DAY_OF_MONTH, 7);
        o.addProperty("dayEnds", endDay.getTimeInMillis());
        o.addProperty("weekEnds", endWeek.getTimeInMillis());
        o.addProperty("now", System.currentTimeMillis());
        return o;
    }

    private static JsonArray list(final List<Def> defs, final JsonObject p) {
        final JsonArray out = new JsonArray();
        for (final Def def : defs) {
            final JsonObject o = new JsonObject();
            o.addProperty("id", def.id);
            o.addProperty("text", def.text);
            o.addProperty("goal", def.goal);
            o.addProperty("progress", Math.min(def.goal, progress(p, def)));
            o.addProperty("mana", def.mana);
            o.addProperty("boosters", def.boosters);
            o.addProperty("done", contains(p.getAsJsonArray("done"), def.id));
            out.add(o);
        }
        return out;
    }

    private static int progress(final JsonObject p, final Def def) {
        if (def.kind == Kind.SET) {
            final JsonObject sets = p.getAsJsonObject("sets");
            return sets.has(def.id) ? sets.getAsJsonArray(def.id).size() : 0;
        }
        final JsonObject prog = p.getAsJsonObject("progress");
        return prog.has(def.id) ? prog.get(def.id).getAsInt() : 0;
    }

    private static boolean contains(final JsonArray a, final String s) {
        for (final JsonElement e : a) {
            if (e.getAsString().equals(s)) {
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------ changements

    /** Change un défi du jour pas encore accompli (une fois par jour). Renvoie le nouveau défi. */
    static String swap(final JsonObject c, final String id) {
        final Calendar today = now();
        final String day = key(today);
        final JsonObject p = period(c, "daily", day);
        if (p.has("swapFrom")) {
            throw new IllegalStateException("Tu as déjà changé un défi aujourd'hui. De nouveaux défis arrivent demain.");
        }
        final List<Def> current = dailies(p, day);
        if (current.stream().noneMatch(d -> d.id.equals(id))) {
            throw new IllegalArgumentException("Ce défi n'est plus en cours.");
        }
        if (contains(p.getAsJsonArray("done"), id)) {
            throw new IllegalStateException("Ce défi est déjà accompli.");
        }
        final Def to = replacement(current, day);
        if (to == null) {
            throw new IllegalStateException("Aucun autre défi disponible aujourd'hui.");
        }
        p.addProperty("swapFrom", id);
        p.addProperty("swapTo", to.id);
        store(c, "daily", p);
        return to.id;
    }

    /**
     * Un duel de carrière terminé : avance les défis du jour et de la semaine, et donne les récompenses de ceux qu'il
     * vient d'accomplir (mana ajouté à la carrière ; boosters créés par newBooster). Renvoie les défis accomplis.
     */
    static JsonArray record(final JsonObject c, final JsonObject game, final Function<Integer, JsonArray> newBoosters) {
        final Calendar today = now();
        final String day = key(today);
        final String week = key(monday(today));
        final JsonArray completed = new JsonArray();
        final JsonObject d = period(c, "daily", day);
        advance(c, d, dailies(d, day), game, completed, newBoosters, "Défi du jour");
        store(c, "daily", d);
        final JsonObject w = period(c, "weekly", week);
        advance(c, w, draw(WEEKLY_DEFS, WEEKLY, week), game, completed, newBoosters, "Défi de la semaine");
        store(c, "weekly", w);
        return completed;
    }

    private static void advance(final JsonObject c, final JsonObject p, final List<Def> defs, final JsonObject game,
            final JsonArray completed, final Function<Integer, JsonArray> newBoosters, final String label) {
        final JsonArray done = p.getAsJsonArray("done");
        for (final Def def : defs) {
            if (contains(done, def.id)) {
                continue;
            }
            switch (def.kind) {
                case SUM -> {
                    final int gain = Math.max(0, def.gain.applyAsInt(game));
                    if (gain > 0) {
                        p.getAsJsonObject("progress").addProperty(def.id, progress(p, def) + gain);
                    }
                }
                case MAX -> p.getAsJsonObject("progress").addProperty(def.id, Math.max(progress(p, def), def.gain.applyAsInt(game)));
                case SET -> {
                    final JsonObject sets = p.getAsJsonObject("sets");
                    final JsonArray have = sets.has(def.id) ? sets.getAsJsonArray(def.id) : new JsonArray();
                    for (final String k : def.keys.apply(game)) {
                        if (!k.isEmpty() && !contains(have, k)) {
                            have.add(k);
                        }
                    }
                    sets.add(def.id, have);
                }
            }
            if (progress(p, def) >= def.goal) {
                done.add(def.id);
                c.addProperty("mana", (c.has("mana") ? c.get("mana").getAsLong() : 0) + def.mana);
                final JsonObject o = new JsonObject();
                o.addProperty("label", label);
                o.addProperty("text", def.text);
                o.addProperty("mana", def.mana);
                if (def.boosters > 0) {
                    o.add("boosters", newBoosters.apply(def.boosters));
                }
                completed.add(o);
            }
        }
    }

    private static String str(final JsonObject o, final String k) {
        return o != null && o.has(k) && o.get(k).isJsonPrimitive() ? o.get(k).getAsString() : "";
    }
}
