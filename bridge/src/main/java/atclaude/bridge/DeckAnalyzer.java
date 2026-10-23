package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.card.CardRules;
import forge.card.CardType;
import forge.card.ICardFace;
import forge.card.mana.ManaCost;
import forge.card.mana.ManaCostShard;
import forge.deck.Deck;
import forge.deck.DeckSection;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;
import forge.util.FileUtil;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Analyse d'un deck : courbe de mana, couleurs, rôles des cartes (accélération, pioche, suppression...),
 * bracket Commander selon les règles officielles et niveau de puissance estimé.
 *
 * <p>Le bracket suit les critères publiés par Wizards (Game Changers, destruction massive de terrains,
 * tours supplémentaires, combos à deux cartes), avec les listes que Forge tient à jour. La puissance est
 * une estimation à part, sur 10, qui ne dépend pas du bracket : vitesse (mana rapide, coût moyen),
 * régularité (tuteurs, pioche), interaction et combos.</p>
 */
final class DeckAnalyzer {

    private static final String[] BRACKET_NAMES = {"", "Exhibition", "Core", "Upgraded", "Optimized", "cEDH"};
    private static final String[] BRACKET_FR = {"", "Exposition", "Classique", "Amélioré", "Optimisé", "Compétitif"};

    /** Mana très rapide : sa présence accélère nettement le deck. */
    private static final Set<String> FAST_MANA = Set.of("Sol Ring", "Mana Crypt", "Mana Vault", "Grim Monolith", "Chrome Mox",
            "Mox Diamond", "Mox Opal", "Mox Amber", "Lotus Petal", "Jeweled Lotus", "Lion's Eye Diamond", "Ancient Tomb",
            "Dark Ritual", "Cabal Ritual", "Culling the Weak", "Elvish Spirit Guide", "Simian Spirit Guide", "Rite of Flame",
            "Pyretic Ritual", "Desperate Ritual", "Mana Drain", "Gemstone Caverns", "Mox of Opulence", "Springleaf Drum",
            "Mishra's Workshop", "Gaea's Cradle", "Serra's Sanctum", "Agadeem's Awakening // Agadeem, the Undercrypt");
    /** Interaction gratuite ou presque : protège les combos et freine les adversaires sans perdre de tempo. */
    private static final Set<String> FREE_INTERACTION = Set.of("Force of Will", "Force of Negation", "Fierce Guardianship",
            "Deflecting Swat", "Deadly Rollick", "Flawless Maneuver", "Pact of Negation", "Mindbreak Trap", "Snuff Out",
            "Misdirection", "Commandeer", "Solitude", "Mental Misstep", "Subtlety", "Daze", "Foil", "Gush",
            "Mana Drain", "An Offer You Can't Refuse", "Swan Song", "Silence", "Grand Abolisher", "Veil of Summer");

    private static final Pattern ADD_MANA = Pattern.compile("\\badd (\\{[wubrgcx0-9/]+\\}|one mana|two mana|three mana|x mana|an amount of|mana of any|that much mana|\\w+ mana)");
    private static final Pattern LAND_SEARCH = Pattern.compile("search your library for (up to (one|two|three|\\w+) )?(a |an |x )?(basic )?(\\w+ )?(land|plains|island|swamp|mountain|forest)[^.]*onto the battlefield");
    private static final Pattern EXTRA_LAND = Pattern.compile("(play (an|two) additional lands?|put a land card from your hand onto the battlefield)");
    private static final Pattern DRAW = Pattern.compile("\\bdraws? (a|an|one|two|three|four|five|six|seven|x|that many|\\d+|cards equal|additional) ?(cards?|card)?|\\binvestigate\\b|exile the top [^.]*(you may (play|cast)|until end of turn you may)");
    private static final Pattern TUTOR = Pattern.compile("search your library for ([^.]*?)\\bcards?\\b");
    private static final Pattern COUNTER = Pattern.compile("\\bcounter target\\b");
    private static final Pattern REMOVAL = Pattern.compile("(destroy|exile) (up to (one|two|three) )?(another )?target (nonland |nontoken |attacking |tapped |creature or |artifact or |enchantment or |noncreature )*(permanent|creature|artifact|enchantment|planeswalker|battle|nonland)"
            + "|deals? (\\d+|x|that much) damage to (any target|target creature|target planeswalker|up to)"
            + "|return (up to (one|two) )?target (nonland )?(permanent|creature|artifact|enchantment)s? to (its|their) owner'?s?'? hands?"
            + "|target creature (gets|an opponent controls gets) -\\d+/-\\d+|fights? (target|up to one target|another target)|target (player|opponent) sacrifices"
            + "|gain control of target");
    private static final Pattern WIPE = Pattern.compile("(destroy|exile) (all|each) (other )?(nonland |nontoken |creatures|creature|permanents|nonland permanents|artifacts|enchantments|planeswalkers|attacking)"
            + "|deals? (\\d+|x) damage to each (creature|other creature|creature and each planeswalker)|all (other )?creatures get -|each (player|opponent) sacrifices (all|a creature|two|three)"
            + "|return (all|each) (nonland )?(permanents|creatures|nonland permanents)");
    private static final Pattern PROTECTION = Pattern.compile("(you control|you own) (gain|have|get)[^.]*(hexproof|indestructible|shroud|protection)|phase out|(target|each) (creature|permanent) you control gains? (hexproof|indestructible|shroud|protection)|you have hexproof");
    private static final Pattern RECURSION = Pattern.compile("return (up to \\w+ )?(target |another target )?[^.]*cards? from your graveyard to (your hand|the battlefield)|from your graveyard to the battlefield|cast [^.]* from your graveyard");

    private static Data data;

    private DeckAnalyzer() { }

    private static final class Data {
        final Map<String, String> gameChangers = list(ForgeConstants.COMMANDER_BRACKET_GAMECHANGERS_FILE);
        final Map<String, String> massLandDenial = list(ForgeConstants.COMMANDER_BRACKET_MASS_LAND_DENIAL_FILE);
        final Map<String, String> extraTurns = list(ForgeConstants.COMMANDER_BRACKET_EXTRA_TURNS_FILE);
        final Map<String, String> chainedExtraTurns = list(ForgeConstants.COMMANDER_BRACKET_CHAINED_EXTRA_TURNS_FILE);
        final List<String[]> combos = new ArrayList<>();

        Data() {
            for (final String line : FileUtil.readFile(ForgeConstants.COMMANDER_BRACKET_COMBOS_FILE)) {
                final String l = strip(line);
                final String[] parts = l.split("\\s*\\|\\s*");
                if (parts.length >= 3) {
                    combos.add(new String[]{parts[0].trim().toLowerCase(Locale.ROOT), parts[1].trim(), parts[2].trim()});
                }
            }
        }

        private static Map<String, String> list(final String file) {
            final Map<String, String> m = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
            for (final String line : FileUtil.readFile(file)) {
                final String name = strip(line);
                if (!name.isEmpty()) {
                    m.put(name, name);
                }
            }
            return m;
        }

        private static String strip(final String line) {
            final int i = line.indexOf('#');
            return (i < 0 ? line : line.substring(0, i)).trim();
        }
    }

    private static synchronized Data data() {
        if (data == null) {
            data = new Data();
        }
        return data;
    }

    /** Rôles d'une carte, d'après son texte de règles (anglais). */
    private record Roles(boolean ramp, boolean draw, boolean tutor, boolean removal, boolean wipe, boolean counter,
                         boolean protection, boolean recursion) { }

    private static String oracle(final CardRules rules) {
        final StringBuilder sb = new StringBuilder();
        for (final ICardFace face : new ICardFace[]{rules.getMainPart(), rules.getOtherPart()}) {
            if (face != null && face.getOracleText() != null) {
                sb.append(face.getOracleText()).append('\n');
            }
        }
        return sb.toString().replace("\\n", "\n").toLowerCase(Locale.ROOT);
    }

    private static Roles roles(final PaperCard pc) {
        final CardRules rules = pc.getRules();
        final String text = oracle(rules).replace(rules.getName().toLowerCase(Locale.ROOT), "cardname");
        final boolean land = rules.getType().isLand();
        boolean tutor = false;
        final Matcher t = TUTOR.matcher(text);
        while (t.find()) {
            final String what = t.group(1);
            if (!what.contains("land") && !what.contains("basic") && !what.contains("plains") && !what.contains("island")
                    && !what.contains("swamp") && !what.contains("mountain") && !what.contains("forest")) {
                tutor = true;
            }
        }
        final boolean ramp = !land && (ADD_MANA.matcher(text).find() || LAND_SEARCH.matcher(text).find() || EXTRA_LAND.matcher(text).find());
        final boolean wipe = WIPE.matcher(text).find();
        return new Roles(ramp, !land && DRAW.matcher(text).find(), tutor, !land && REMOVAL.matcher(text).find() && !wipe,
                wipe, COUNTER.matcher(text).find(), !land && PROTECTION.matcher(text).find(), RECURSION.matcher(text).find());
    }

    static JsonObject analyze(final Deck deck, final boolean commander) {
        final Data d = data();
        final JsonObject out = new JsonObject();
        final Map<PaperCard, Integer> cards = new LinkedHashMap<>();
        final List<PaperCard> commanders = new ArrayList<>();
        if (deck.has(DeckSection.Commander)) {
            for (final Map.Entry<PaperCard, Integer> e : deck.get(DeckSection.Commander)) {
                cards.merge(e.getKey(), e.getValue(), Integer::sum);
                commanders.add(e.getKey());
            }
        }
        for (final Map.Entry<PaperCard, Integer> e : deck.getMain()) {
            cards.merge(e.getKey(), e.getValue(), Integer::sum);
        }
        final Set<String> names = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        // Noms anglais seulement (les listes officielles sont en anglais ; un nom traduit pourrait coïncider avec une autre carte).
        for (final PaperCard pc : cards.keySet()) {
            final CardRules rules = pc.getRules();
            names.add(pc.getName());
            names.add(rules.getName());
            for (final ICardFace face : new ICardFace[]{rules.getMainPart(), rules.getOtherPart()}) {
                if (face != null) {
                    names.add(face.getName());
                }
            }
        }

        // Types, courbe, couleurs.
        int total = 0;
        int lands = 0;
        int nonlandCount = 0;
        int cmcSum = 0;
        final int[] curve = new int[8];
        final Map<String, Integer> types = new LinkedHashMap<>();
        for (final String k : List.of("creature", "instant", "sorcery", "artifact", "enchantment", "planeswalker", "battle", "land")) {
            types.put(k, 0);
        }
        final Map<Character, Integer> pips = new LinkedHashMap<>();
        final Map<Character, Integer> sources = new LinkedHashMap<>();
        for (final char c : "WUBRG".toCharArray()) {
            pips.put(c, 0);
            sources.put(c, 0);
        }
        final Map<String, JsonArray> roleCards = new LinkedHashMap<>();
        for (final String k : List.of("ramp", "draw", "removal", "wipe", "counter", "tutor", "protection", "recursion")) {
            roleCards.put(k, new JsonArray());
        }
        final List<String> fast = new ArrayList<>();
        final List<String> free = new ArrayList<>();
        for (final Map.Entry<PaperCard, Integer> e : cards.entrySet()) {
            final PaperCard pc = e.getKey();
            final int n = e.getValue();
            final CardRules rules = pc.getRules();
            final CardType type = rules.getType();
            total += n;
            if (type.isCreature()) types.merge("creature", n, Integer::sum);
            if (type.isInstant()) types.merge("instant", n, Integer::sum);
            if (type.isSorcery()) types.merge("sorcery", n, Integer::sum);
            if (type.isArtifact()) types.merge("artifact", n, Integer::sum);
            if (type.isEnchantment()) types.merge("enchantment", n, Integer::sum);
            if (type.isPlaneswalker()) types.merge("planeswalker", n, Integer::sum);
            if (type.isBattle()) types.merge("battle", n, Integer::sum);
            if (type.isLand()) {
                types.merge("land", n, Integer::sum);
                lands += n;
                for (final char c : landColors(pc)) {
                    sources.merge(c, n, Integer::sum);
                }
            } else if (!commanders.contains(pc)) {
                final ManaCost cost = rules.getManaCost();
                final int cmc = cost == null ? 0 : cost.getCMC();
                nonlandCount += n;
                cmcSum += cmc * n;
                curve[Math.min(7, cmc)] += n;
            }
            final ManaCost cost = rules.getManaCost();
            if (cost != null) {
                for (final ManaCostShard s : cost) {
                    for (final char c : "WUBRG".toCharArray()) {
                        if (s.isColor(forge.card.MagicColor.fromName(c))) {
                            pips.merge(c, n, Integer::sum);
                        }
                    }
                }
            }
            final Roles r = roles(pc);
            final String fr = Catalog.translated(pc.getName());
            if (r.ramp()) roleCards.get("ramp").add(fr);
            if (r.draw()) roleCards.get("draw").add(fr);
            if (r.removal()) roleCards.get("removal").add(fr);
            if (r.wipe()) roleCards.get("wipe").add(fr);
            if (r.counter()) roleCards.get("counter").add(fr);
            if (r.tutor()) roleCards.get("tutor").add(fr);
            if (r.protection()) roleCards.get("protection").add(fr);
            if (r.recursion()) roleCards.get("recursion").add(fr);
            if (FAST_MANA.contains(pc.getName())) fast.add(fr);
            if (FREE_INTERACTION.contains(pc.getName())) free.add(fr);
        }
        final double avgCmc = nonlandCount == 0 ? 0 : (double) cmcSum / nonlandCount;

        final JsonObject counts = new JsonObject();
        counts.addProperty("cards", total);
        counts.addProperty("lands", lands);
        counts.addProperty("nonlands", nonlandCount);
        types.forEach(counts::addProperty);
        out.add("counts", counts);
        final JsonArray curveJson = new JsonArray();
        for (final int c : curve) {
            curveJson.add(c);
        }
        out.add("curve", curveJson);
        out.addProperty("avgCmc", Math.round(avgCmc * 100) / 100.0);
        final JsonObject colors = new JsonObject();
        final JsonObject pipJson = new JsonObject();
        final JsonObject srcJson = new JsonObject();
        pips.forEach((k, v) -> pipJson.addProperty(String.valueOf(k), v));
        sources.forEach((k, v) -> srcJson.addProperty(String.valueOf(k), v));
        colors.add("pips", pipJson);
        colors.add("sources", srcJson);
        colors.addProperty("identity", Catalog.identity(deck));
        out.add("colors", colors);

        // Rôles : nombre, cartes, et fourchette conseillée (Commander à 100 cartes).
        final JsonArray roles = new JsonArray();
        final Object[][] targets = commander ? new Object[][]{
            {"ramp", "Accélération de mana", 10, 14}, {"draw", "Pioche", 10, 15}, {"removal", "Suppression ciblée", 8, 12},
            {"wipe", "Balayages", 2, 4}, {"counter", "Contresorts", 0, 99}, {"tutor", "Tuteurs", 0, 99},
            {"protection", "Protection", 2, 99}, {"recursion", "Récupération (cimetière)", 0, 99},
        } : new Object[][]{
            {"ramp", "Accélération de mana", 0, 99}, {"draw", "Pioche", 4, 99}, {"removal", "Suppression ciblée", 4, 99},
            {"wipe", "Balayages", 0, 99}, {"counter", "Contresorts", 0, 99}, {"tutor", "Tuteurs", 0, 99},
            {"protection", "Protection", 0, 99}, {"recursion", "Récupération (cimetière)", 0, 99},
        };
        final List<String> advice = new ArrayList<>();
        for (final Object[] t : targets) {
            final JsonArray list = roleCards.get((String) t[0]);
            final JsonObject o = new JsonObject();
            o.addProperty("key", (String) t[0]);
            o.addProperty("label", (String) t[1]);
            o.addProperty("count", list.size());
            o.addProperty("min", (Integer) t[2]);
            o.addProperty("max", (Integer) t[3]);
            o.add("cards", list);
            roles.add(o);
            if (list.size() < (Integer) t[2]) {
                advice.add(t[1] + " : " + list.size() + " carte(s), on en conseille au moins " + t[2] + ".");
            }
        }
        out.add("roles", roles);
        final int[] landRange = commander ? new int[]{34, 39} : new int[]{20, 26};
        final int landTarget = commander ? (int) Math.round(31 + avgCmc * 2) : (int) Math.round(17 + avgCmc * 2);
        out.addProperty("landsAdvised", Math.max(landRange[0], Math.min(landRange[1], landTarget)));
        if (lands < landRange[0] - (avgCmc < 2.5 ? 4 : 0)) {
            advice.add("Peu de terrains (" + lands + ") : on conseille environ " + Math.max(landRange[0], Math.min(landRange[1], landTarget)) + " pour ce coût moyen.");
        } else if (lands > landRange[1] + 1) {
            advice.add("Beaucoup de terrains (" + lands + ") : le deck risque de manquer de sorts.");
        }
        for (final char c : "WUBRG".toCharArray()) {
            if (pips.get(c) >= 10 && sources.get(c) < Math.max(8, pips.get(c) / 3)) {
                advice.add("Peu de sources de " + colorName(c) + " (" + sources.get(c) + " terrains) pour " + pips.get(c) + " symboles de mana.");
            }
        }
        if (commander && total < 100) {
            advice.add("Le deck ne compte que " + total + " cartes sur 100.");
        }

        // Bracket officiel.
        final List<String> gc = found(names, d.gameChangers);
        final List<String> mld = found(names, d.massLandDenial);
        final List<String> extra = found(names, d.extraTurns);
        final List<String> chained = found(names, d.chainedExtraTurns);
        final JsonArray early = new JsonArray();
        final JsonArray late = new JsonArray();
        for (final String[] combo : d.combos) {
            if (names.contains(combo[1]) && names.contains(combo[2])) {
                final JsonArray pair = new JsonArray();
                pair.add(Catalog.translated(combo[1]));
                pair.add(Catalog.translated(combo[2]));
                ("early_game".equals(combo[0]) ? early : late).add(pair);
            }
        }
        int bracket = 1;
        final JsonArray reasons = new JsonArray();
        if (!mld.isEmpty()) {
            bracket = Math.max(bracket, 4);
            reasons.add("Destruction massive de terrains (" + frList(mld) + ") : bracket 4 au minimum.");
        }
        if (!chained.isEmpty()) {
            bracket = Math.max(bracket, 4);
            reasons.add("Tours supplémentaires enchaînables (" + frList(chained) + ") : bracket 4 au minimum.");
        }
        if (extra.size() >= 4) {
            bracket = Math.max(bracket, 4);
            reasons.add(extra.size() + " cartes de tours supplémentaires : bracket 4 au minimum.");
        } else if (extra.size() == 3) {
            bracket = Math.max(bracket, 3);
            reasons.add("3 cartes de tours supplémentaires : bracket 3 au minimum.");
        } else if (!extra.isEmpty()) {
            bracket = Math.max(bracket, 2);
            reasons.add(extra.size() + " carte(s) de tours supplémentaires (le bracket 1 n'en a pas) : bracket 2 au minimum.");
        }
        if (gc.size() >= 4) {
            bracket = Math.max(bracket, 4);
            reasons.add(gc.size() + " Game Changers (plus de 3) : bracket 4 au minimum.");
        } else if (!gc.isEmpty()) {
            bracket = Math.max(bracket, 3);
            reasons.add(gc.size() + " Game Changer" + (gc.size() > 1 ? "s" : "") + " (3 au plus) : bracket 3 au minimum.");
        }
        if (!early.isEmpty()) {
            bracket = Math.max(bracket, 4);
            reasons.add("Combo à deux cartes possible tôt dans la partie : bracket 4 au minimum.");
        } else if (!late.isEmpty()) {
            bracket = Math.max(bracket, 3);
            reasons.add("Combo à deux cartes de fin de partie : bracket 3 au minimum.");
        }

        // Puissance, indépendante du bracket.
        final JsonArray factors = new JsonArray();
        double power = 3.8;
        power += factor(factors, "Game Changers", Math.min(2.1, gc.size() * 0.35), gc.size() + " carte(s)");
        power += factor(factors, "Mana rapide", Math.min(1.5, fast.size() * 0.3), fast.isEmpty() ? "aucun" : String.join(", ", fast));
        final int tutors = roleCards.get("tutor").size();
        power += factor(factors, "Tuteurs", Math.min(1.2, tutors * 0.15), tutors + " carte(s)");
        double comboBonus = 0;
        if (!early.isEmpty()) {
            comboBonus = Math.min(1.8, 1.2 + (early.size() - 1) * 0.3);
        } else if (!late.isEmpty()) {
            comboBonus = Math.min(1.0, 0.5 + (late.size() - 1) * 0.2);
        }
        power += factor(factors, "Combos", comboBonus, (early.size() + late.size()) + " combo(s) à deux cartes");
        power += factor(factors, "Interaction gratuite", Math.min(1.0, free.size() * 0.2), free.isEmpty() ? "aucune" : String.join(", ", free));
        final int interaction = roleCards.get("removal").size() + roleCards.get("wipe").size() + roleCards.get("counter").size();
        power += factor(factors, "Interaction", interaction >= 18 ? 0.7 : interaction >= 12 ? 0.4 : interaction < 6 && commander ? -0.3 : 0, interaction + " carte(s)");
        final int draw = roleCards.get("draw").size();
        power += factor(factors, "Pioche", draw >= 15 ? 0.5 : draw >= 10 ? 0.3 : draw < 5 && commander ? -0.3 : 0, draw + " carte(s)");
        final int ramp = roleCards.get("ramp").size();
        power += factor(factors, "Accélération", ramp >= 14 ? 0.5 : ramp >= 10 ? 0.3 : ramp < 5 && commander ? -0.3 : 0, ramp + " carte(s)");
        final double curveBonus = avgCmc == 0 ? 0 : avgCmc <= 2.0 ? 1.0 : avgCmc <= 2.6 ? 0.6 : avgCmc <= 3.1 ? 0.2 : avgCmc >= 4.3 ? -0.8 : avgCmc >= 3.8 ? -0.4 : 0;
        power += factor(factors, "Coût moyen", curveBonus, String.format(Locale.FRANCE, "%.2f", avgCmc));
        if (!mld.isEmpty()) {
            power += factor(factors, "Destruction de terrains", 0.4, frList(mld));
        }
        if (extra.size() >= 2) {
            power += factor(factors, "Tours supplémentaires", 0.3, extra.size() + " carte(s)");
        }
        power = Math.max(1, Math.min(10, power));
        power = Math.round(power * 10) / 10.0;
        final JsonObject powerJson = new JsonObject();
        powerJson.addProperty("score", power);
        powerJson.addProperty("label", power >= 8.5 ? "Compétitif" : power >= 7 ? "Optimisé" : power >= 5.2 ? "Amélioré" : power >= 3.5 ? "Préconstruit" : "Décontracté");
        powerJson.add("factors", factors);
        out.add("power", powerJson);

        // Sans carte restreinte, les règles laissent le choix entre 1 (thème avant tout) et 2 (niveau préconstruit) :
        // la puissance tranche.
        if (bracket == 1) {
            if (power >= 3.5) {
                bracket = 2;
                reasons.add("Aucune carte restreinte (Game Changers, destruction massive de terrains, tours supplémentaires, combos à deux cartes) "
                        + "et une puissance de préconstruit ou plus : bracket 2.");
            } else {
                reasons.add("Aucune carte restreinte et une puissance modeste : bracket 1 (deck à thème, sans recherche d'efficacité).");
            }
        } else if (bracket == 2 && reasons.size() == 1 && power < 3.5) {
            reasons.add("Puissance modeste, mais la carte de tour supplémentaire interdit le bracket 1.");
        }
        final JsonObject b = new JsonObject();
        final boolean maybeCedh = bracket == 4 && power >= 8.5;
        b.addProperty("value", bracket);
        b.addProperty("name", BRACKET_NAMES[bracket]);
        b.addProperty("nameFr", BRACKET_FR[bracket]);
        b.addProperty("maybeCedh", maybeCedh);
        b.add("reasons", reasons);
        b.add("gameChangers", frArray(gc));
        b.add("massLandDenial", frArray(mld));
        b.add("extraTurns", frArray(extra));
        b.add("chainedExtraTurns", frArray(chained));
        b.add("earlyCombos", early);
        b.add("lateCombos", late);
        // Écart notable entre règles et puissance : un conseil pour bien choisir sa table.
        if (power >= 7 && bracket <= 2) {
            advice.add("Le deck respecte les règles du bracket " + bracket + ", mais sa puissance (" + power + "/10) le destine plutôt à une table de bracket 3.");
        } else if (power < 4.5 && bracket >= 4) {
            advice.add("Bracket " + bracket + " à cause des cartes restreintes, mais la puissance reste modeste (" + power + "/10).");
        }
        if (maybeCedh) {
            advice.add("Puissance de niveau compétitif : ce deck peut viser une table cEDH (bracket 5).");
        }
        out.add("bracket", b);
        final JsonArray adviceJson = new JsonArray();
        advice.forEach(adviceJson::add);
        out.add("advice", adviceJson);
        out.addProperty("commander", commander);
        return out;
    }

    private static double factor(final JsonArray factors, final String label, final double delta, final String detail) {
        final JsonObject o = new JsonObject();
        o.addProperty("label", label);
        o.addProperty("delta", Math.round(delta * 100) / 100.0);
        o.addProperty("detail", detail);
        factors.add(o);
        return delta;
    }

    private static List<String> found(final Set<String> names, final Map<String, String> list) {
        final Set<String> out = new TreeSet<>();
        for (final String n : names) {
            final String hit = list.get(n);
            if (hit != null) {
                out.add(hit);
            }
        }
        return new ArrayList<>(out);
    }

    private static JsonArray frArray(final List<String> names) {
        final JsonArray a = new JsonArray();
        for (final String n : names) {
            a.add(Catalog.translated(n.contains(" // ") ? n.substring(0, n.indexOf(" // ")) : n));
        }
        return a;
    }

    private static String frList(final List<String> names) {
        final List<String> fr = new ArrayList<>();
        frArray(names).forEach(e -> fr.add(e.getAsString()));
        return String.join(", ", fr);
    }

    private static String colorName(final char c) {
        return switch (c) {
            case 'W' -> "blanc";
            case 'U' -> "bleu";
            case 'B' -> "noir";
            case 'R' -> "rouge";
            default -> "vert";
        };
    }

    /** Couleurs qu'un terrain peut produire (texte « Add {G} », types de base, « any color », fetchs). */
    private static List<Character> landColors(final PaperCard pc) {
        final String text = oracle(pc.getRules());
        final String type = pc.getRules().getType().toString().toLowerCase(Locale.ROOT);
        final List<Character> out = new ArrayList<>();
        final boolean any = text.contains("mana of any color") || text.contains("mana of any one color") || text.contains("any type");
        final String[][] basics = {{"W", "plains"}, {"U", "island"}, {"B", "swamp"}, {"R", "mountain"}, {"G", "forest"}};
        for (final String[] b : basics) {
            final char c = b[0].charAt(0);
            final boolean adds = text.contains("{" + b[0].toLowerCase(Locale.ROOT) + "}") && text.contains("add");
            final boolean basicType = type.contains(b[1]);
            final boolean fetch = text.contains("search your library") && text.contains(b[1]);
            if (any || adds || basicType || fetch) {
                out.add(c);
            }
        }
        return out;
    }
}
