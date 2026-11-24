package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.deck.Deck;
import forge.deck.DeckFormat;
import forge.deck.DeckProxy;
import forge.deck.DeckSection;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Les préconstruits Commander de Forge, chacun avec son bracket et sa puissance (même analyse que le deck builder),
 * calculés une fois. Le bracket suit les règles officielles (Game Changers, destruction massive de terrains, tours
 * supplémentaires, combos à deux cartes, listes tenues à jour par Forge) ; un préconstruit sans carte restreinte
 * est au bracket 2 (« Core ») : Wizards range les préconstruits dans ce bracket, le bracket 1 étant affaire d'intention.
 */
final class Precons {

    /** Un préconstruit analysé. */
    record Info(String key, String name, String fullName, JsonArray commanders, JsonArray commandersEn, String image,
                String identity, int bracket, double power) {

        JsonObject json() {
            final JsonObject o = new JsonObject();
            o.addProperty("key", key);
            o.addProperty("name", name);
            o.addProperty("fullName", fullName);
            o.add("commanders", commanders);
            if (image != null) {
                o.addProperty("image", image);
            }
            o.addProperty("identity", identity);
            o.addProperty("bracket", bracket);
            o.addProperty("power", power);
            return o;
        }
    }

    private static volatile List<Info> all;
    private static volatile Map<String, Integer> popularity;

    /**
     * L'analyse des préconstruits (plus d'une minute sur iPhone) et la popularité des cartes, gardées sur l'appareil :
     * refaites seulement quand la liste des préconstruits de Forge, la version de l'appli ou cette version de l'analyse
     * change (à augmenter quand DeckAnalyzer change sa façon de compter).
     */
    private static final int ANALYSIS_VERSION = 1;
    private static final String CACHE_NAME = "precons-analysis.json";
    /** Le contenu gardé, lu une fois (null : rien de valable). */
    private static JsonObject cached;
    private static boolean cacheRead;

    private Precons() { }

    private static File cacheFile() {
        return new File(ForgeConstants.CACHE_DIR, CACHE_NAME);
    }

    private static String signature() {
        final List<String> names = new ArrayList<>();
        for (final DeckProxy p : DeckProxy.getAllCommanderPreconDecks()) {
            names.add(p.getName());
        }
        java.util.Collections.sort(names);
        return ANALYSIS_VERSION + "|" + Bridge.version() + "|" + DataUpdates.id() + "|" + names.size() + "|" + String.join("\n", names).hashCode();
    }

    /** Ce qui est gardé sur l'appareil, s'il correspond aux préconstruits et à la version de maintenant. */
    private static JsonObject cache() {
        if (!cacheRead) {
            cacheRead = true;
            try {
                final File f = cacheFile();
                if (f.isFile()) {
                    final JsonObject o = com.google.gson.JsonParser.parseString(Io.read(f)).getAsJsonObject();
                    if (o.has("sig") && signature().equals(o.get("sig").getAsString())) {
                        cached = o;
                    }
                }
            } catch (final Exception e) {
                cached = null; // abîmé : refait
            }
        }
        return cached;
    }

    /** Garde l'analyse et la popularité calculées (en plus de ce qui l'était déjà). */
    private static void save() {
        try {
            final JsonObject o = cached != null ? cached : new JsonObject();
            o.addProperty("sig", signature());
            if (all != null) {
                final JsonArray list = new JsonArray();
                for (final Info i : all) {
                    final JsonObject j = new JsonObject();
                    j.addProperty("key", i.key());
                    j.addProperty("name", i.name());
                    j.addProperty("fullName", i.fullName());
                    j.add("commandersEn", i.commandersEn());
                    if (i.image() != null) {
                        j.addProperty("image", i.image());
                    }
                    j.addProperty("identity", i.identity());
                    j.addProperty("bracket", i.bracket());
                    j.addProperty("power", i.power());
                    list.add(j);
                }
                o.add("precons", list);
            }
            if (popularity != null) {
                final JsonObject pop = new JsonObject();
                popularity.forEach(pop::addProperty);
                o.add("popularity", pop);
            }
            cached = o;
            final File f = cacheFile();
            f.getParentFile().mkdirs();
            Io.write(f, o.toString());
        } catch (final Exception e) {
            // pas de cache : ce sera recalculé au prochain lancement
        }
    }

    /**
     * Les cartes les plus jouées : pour chaque carte, le nombre de préconstruits Commander de Forge qui la jouent
     * (terrains de base exceptés). Sol Ring, Cachet d'ésotérisme, Tour de commandement... sortent en tête. Calculé une
     * fois, sans réseau ; une réédition du même deck ne compte qu'une fois.
     */
    static Map<String, Integer> popularity() {
        Map<String, Integer> map = popularity;
        if (map != null) {
            return map;
        }
        synchronized (Precons.class) {
            if (popularity != null) {
                return popularity;
            }
            final JsonObject c = cache();
            if (c != null && c.has("popularity")) {
                final Map<String, Integer> fromCache = new java.util.HashMap<>();
                for (final Map.Entry<String, com.google.gson.JsonElement> e : c.getAsJsonObject("popularity").entrySet()) {
                    fromCache.put(e.getKey(), e.getValue().getAsInt());
                }
                popularity = fromCache;
                return fromCache;
            }
            final Map<String, Integer> counts = new java.util.HashMap<>();
            final java.util.Set<String> seen = new java.util.HashSet<>();
            for (final DeckProxy p : DeckProxy.getAllCommanderPreconDecks()) {
                try {
                    if (!seen.add(Career.cleanName(p.getName()))) {
                        continue;
                    }
                    final Deck d = p.getDeck();
                    if (d == null) {
                        continue;
                    }
                    final java.util.Set<String> names = new java.util.HashSet<>();
                    for (final DeckSection section : new DeckSection[] {DeckSection.Main, DeckSection.Commander}) {
                        if (d.has(section)) {
                            for (final Map.Entry<PaperCard, Integer> e : d.get(section)) {
                                if (!e.getKey().getRules().getType().isBasicLand()) {
                                    names.add(e.getKey().getName());
                                }
                            }
                        }
                    }
                    for (final String n : names) {
                        counts.merge(n, 1, Integer::sum);
                    }
                } catch (final RuntimeException e) {
                    // préconstruit illisible : ignoré
                }
            }
            popularity = counts;
            save();
            return counts;
        }
    }

    static List<Info> all() {
        List<Info> list = all;
        if (list != null) {
            return list;
        }
        synchronized (Precons.class) {
            if (all != null) {
                return all;
            }
            final JsonObject c = cache();
            if (c != null && c.has("precons")) {
                final List<Info> fromCache = new ArrayList<>();
                for (final com.google.gson.JsonElement e : c.getAsJsonArray("precons")) {
                    final JsonObject j = e.getAsJsonObject();
                    final JsonArray en = j.getAsJsonArray("commandersEn");
                    // Les noms français relus maintenant (les textes français des cartes récentes arrivent après coup).
                    final JsonArray fr = new JsonArray();
                    for (final com.google.gson.JsonElement n : en) {
                        fr.add(Catalog.translated(n.getAsString()));
                    }
                    fromCache.add(new Info(j.get("key").getAsString(), j.get("name").getAsString(), j.get("fullName").getAsString(), fr, en,
                            j.has("image") ? j.get("image").getAsString() : null, j.get("identity").getAsString(),
                            j.get("bracket").getAsInt(), j.get("power").getAsDouble()));
                }
                all = List.copyOf(fromCache);
                return all;
            }
            final List<Info> out = new ArrayList<>();
            for (final DeckProxy p : DeckProxy.getAllCommanderPreconDecks()) {
                try {
                    final Deck d = p.getDeck();
                    if (d == null || !d.has(DeckSection.Commander) || d.get(DeckSection.Commander).countAll() == 0
                            || DeckFormat.Commander.getDeckConformanceProblem(d) != null) {
                        continue;
                    }
                    final JsonObject a = DeckAnalyzer.analyze(d, true);
                    final int bracket = Math.max(2, a.getAsJsonObject("bracket").get("value").getAsInt());
                    final double power = a.getAsJsonObject("power").get("score").getAsDouble();
                    final JsonArray fr = new JsonArray();
                    final JsonArray en = new JsonArray();
                    for (final Map.Entry<PaperCard, Integer> e : d.get(DeckSection.Commander)) {
                        fr.add(Catalog.translated(e.getKey().getName()));
                        en.add(e.getKey().getName());
                    }
                    out.add(new Info("precon:" + p.getName(), Career.cleanName(p.getName()), p.getName(), fr, en,
                            d.get(DeckSection.Commander).toFlatList().get(0).getImageKey(false), Catalog.identity(d), bracket, power));
                } catch (final RuntimeException e) {
                    System.err.println("Préconstruit illisible : " + p.getName() + " (" + e.getMessage() + ")");
                }
            }
            // Les rééditions (Commander Anthology...) reprennent un deck sous le même nom : on garde l'original.
            final Map<String, Info> byDeck = new java.util.LinkedHashMap<>();
            for (final Info i : out) {
                byDeck.merge(i.name() + "|" + i.commandersEn(), i, (a, b) -> year(b) < year(a) ? b : a);
            }
            all = List.copyOf(byDeck.values());
            save();
            return all;
        }
    }

    /** Année de parution, lue dans le nom complet (« Breed Lethality [C16] [2016] »). */
    private static int year(final Info i) {
        final java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\[(\\d{4})]").matcher(i.fullName());
        return m.find() ? Integer.parseInt(m.group(1)) : 9999;
    }

    static Info get(final String key) {
        for (final Info i : all()) {
            if (i.key().equals(key)) {
                return i;
            }
        }
        return null;
    }

    /** Bracket et puissance d'un deck, comptés comme pour les préconstruits (bracket 2 au minimum). */
    static double[] measure(final Deck deck) {
        final JsonObject a = DeckAnalyzer.analyze(deck, true);
        return new double[]{Math.max(2, a.getAsJsonObject("bracket").get("value").getAsInt()), a.getAsJsonObject("power").get("score").getAsDouble()};
    }

    /**
     * Adversaires à la mesure d'un deck : même bracket et puissance proche (écart de 0,4 au plus, élargi pas à pas
     * s'il n'y en a pas assez). Le préconstruit dont vient le deck, et ceux du même commandant, sont écartés.
     */
    static List<Info> matching(final int bracket, final double power, final List<String> commandersEn, final String fromName) {
        for (final double tolerance : new double[]{0.4, 0.6, 0.9, 1.3, 2.0}) {
            final List<Info> hits = new ArrayList<>();
            for (final Info i : all()) {
                if (i.bracket() == bracket && Math.abs(i.power() - power) <= tolerance + 1e-9 && !i.name().equals(fromName)
                        && !overlaps(i.commandersEn(), commandersEn)) {
                    hits.add(i);
                }
            }
            if (hits.size() >= 3 || tolerance >= 2.0 && !hits.isEmpty()) {
                return hits;
            }
        }
        // Aucun préconstruit de ce bracket : les plus proches en puissance, tous brackets confondus.
        final List<Info> sorted = new ArrayList<>(all());
        sorted.removeIf(i -> i.name().equals(fromName) || overlaps(i.commandersEn(), commandersEn));
        sorted.sort((x, y) -> Double.compare(Math.abs(x.power() - power) + Math.abs(x.bracket() - bracket),
                Math.abs(y.power() - power) + Math.abs(y.bracket() - bracket)));
        return sorted.subList(0, Math.min(5, sorted.size()));
    }

    private static boolean overlaps(final JsonArray a, final List<String> b) {
        for (int i = 0; i < a.size(); i++) {
            if (b.contains(a.get(i).getAsString())) {
                return true;
            }
        }
        return false;
    }
}
