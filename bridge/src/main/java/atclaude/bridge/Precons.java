package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.deck.Deck;
import forge.deck.DeckFormat;
import forge.deck.DeckProxy;
import forge.deck.DeckSection;
import forge.item.PaperCard;

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

    private Precons() { }

    static List<Info> all() {
        List<Info> list = all;
        if (list != null) {
            return list;
        }
        synchronized (Precons.class) {
            if (all != null) {
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
