package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.card.CardAiHints;
import forge.card.CardRules;
import forge.card.CardType;
import forge.card.DeckHints;
import forge.card.ICardFace;
import forge.item.PaperCard;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.BiPredicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Cartes en synergie avec un commandant, calculées par l'appli, façon EDHREC : pour les commandants perso (qu'EDHREC
 * ne connaît pas) et quand EDHREC ne répond pas.
 * <ol>
 * <li>Les thèmes du commandant sont lus dans son script Forge : ce qu'il fait (il crée des jetons, met des marqueurs
 * +1/+1…), ce dont il profite (il se déclenche quand une créature meurt, compte vos artefacts…) et les types de
 * créature dont il parle (tribal).</li>
 * <li>Chaque carte de son identité est lue de la même façon, avec les indices de construction que Forge donne à ses
 * cartes (DeckHas, DeckHints) : elle gagne des points pour chaque thème partagé (d'autant plus que le thème est rare)
 * et pour le type de créature. Sa popularité (préconstruits Commander) départage.</li>
 * <li>Les commandants officiels les plus semblables (mêmes couleurs, mêmes thèmes) : les cartes de leurs pages EDHREC
 * s'ajoutent au score, et leurs combos sont proposés.</li>
 * </ol>
 */
final class Synergy {

    private Synergy() { }

    // ------------------------------------------------------------------ thèmes

    /**
     * Un thème de deck. Dans le script de la carte (espaces retirés autour des « | » et après les « $ ») : ce qui le
     * fournit (has), ce qui en profite (wants) ; member : ce que la carte est (un artefact pour le thème Artefacts).
     */
    private static final class Theme {
        final String id;
        final String fr;
        final double weight;
        final String[] has;
        final String[] wants;
        final Pattern hasRe;
        final Pattern wantsRe;
        final BiPredicate<CardRules, String> member;
        final String[] forgeHas;
        final String[] forgeWants;
        final String[] forgeTypes;

        Theme(final String id, final String fr, final double weight, final String[] has, final String hasRe, final String[] wants,
              final String wantsRe, final BiPredicate<CardRules, String> member, final String[] forgeHas, final String[] forgeWants,
              final String[] forgeTypes) {
            this.id = id;
            this.fr = fr;
            this.weight = weight;
            this.has = has;
            this.hasRe = hasRe == null ? null : Pattern.compile(hasRe);
            this.wants = wants;
            this.wantsRe = wantsRe == null ? null : Pattern.compile(wantsRe);
            this.member = member;
            this.forgeHas = forgeHas;
            this.forgeWants = forgeWants;
            this.forgeTypes = forgeTypes;
        }
    }

    private static String[] w(final String... s) {
        return s;
    }

    private static final String[] NONE = {};

    private static final Theme[] THEMES = {
        new Theme("tokens", "Jetons", 1.0,
            w("B$Token", "P$Token", "TokenScript$", "$CopyPermanent", "Amass", "Fabricate", "Afterlife", "Populate", "Embalm",
                "Eternalize", "Encore", "Myriad", "Offspring", "Squad", "Incubate", "Investigate", "Mobilize"), null,
            w(".token", "Mode$TokenCreated", "Populate", "Convoke"),
            "Destination\\$Battlefield\\|ValidCard\\$(Creature|Permanent)\\.(Other|YouCtrl)", null,
            w("Token", "Amass", "Investigate", "Food"), w("Token"), NONE),
        new Theme("counters", "Marqueurs +1/+1", 1.0,
            w("P1P1", "Adapt", "Bolster", "Evolve", "Modular", "Graft", "Outlast", "Riot", "Training", "Mentor", "Support",
                "Proliferate", "Backup", "Reinforce", "Renown", "Monstrosity", "Undying"), null,
            w("_P1P1", "Mode$CounterAdded", "CounterAddedOnce", "HasCounters", "Proliferate", "Count$CardCounters"), null, null,
            w("Counters", "Proliferate"), w("Counters"), NONE),
        new Theme("minus", "Marqueurs -1/-1", 0.9,
            w("M1M1", "Wither", "Persist"), null, w("_M1M1", "Mode$CounterAdded|ValidCard$Creature|CounterType$M1M1"), null, null,
            NONE, NONE, NONE),
        new Theme("poison", "Infection et poison", 1.0,
            w("Infect", "Toxic", "Poisonous", "B$Poison"), null, w("Poison", "Infect", "Proliferate"), null, null,
            NONE, NONE, NONE),
        new Theme("sacrifice", "Sacrifice et morts", 1.0,
            w("B$Sacrifice", "P$Sacrifice", "Exploit", "Casualty", "Devour", "Emerge", "Bargain", "SacMe", "Afterlife", "Blitz",
                "Destination$Graveyard|ValidCard$Card.Self", "Undying", "Persist", "Decayed"),
            "Sac<[^>]*/(?!CARDNAME|NICKNAME)",
            w("Mode$Sacrificed", "Destination$Graveyard|ValidCard$Creature", "Destination$Graveyard|ValidCard$Permanent",
                "Destination$Graveyard|ValidCard$Card.Other", "Destination$Graveyard|ValidCard$Card.YouCtrl", "Morbid",
                "Count$ThisTurnEntered_Graveyard_from_Battlefield", "Mode$Exploited"), null, null,
            w("Sacrifice"), w("Sacrifice"), NONE),
        new Theme("graveyard", "Cimetière", 1.0,
            w("B$Mill", "P$Mill", "Surveil", "Dredge", "Entomb"), null,
            w("Origin$Graveyard", "InYourYard", "ValidGraveyard", "inZoneGraveyard", "Threshold", "Delirium", "Delve", "Flashback",
                "Escape", "Unearth", "Embalm", "Eternalize", "Disturb", "Retrace", "Jump-start", "Scavenge", "Aftermath",
                "TypesInYourYard"), null, null,
            w("Graveyard", "Mill", "Surveil", "Dredge", "Delirium"), w("Graveyard", "Delirium"), NONE),
        new Theme("discard", "Défausse", 0.8,
            w("B$Discard", "P$Discard", "Discard<", "Connive", "Cycling"), null,
            w("Mode$Discarded", "Madness", "Mode$Cycled"), null, null,
            w("Discard"), w("Discard"), NONE),
        new Theme("lifegain", "Gain de vie", 1.0,
            w("$GainLife", "Lifelink", "Extort", "_food", "Type$Food"), null,
            w("Mode$LifeGained", "LifeYouGainedThisTurn", "YouGainedLife", "LifeGainedThisTurn"), null, null,
            w("LifeGain", "Food"), w("LifeGain"), NONE),
        new Theme("drain", "Pertes de vie des adversaires", 0.8,
            w("Extort", "Afflict"), "\\$(LoseLife|DealDamage)[^\\n]*(Opponent|EachOpp)",
            w("Mode$LifeLost", "LifeOppsLostThisTurn", "OppLostLife"), null, null,
            NONE, NONE, NONE),
        new Theme("spells", "Éphémères et rituels", 1.0,
            w("B$CopySpellAbility", "P$CopySpellAbility"), null,
            w("Instant,Sorcery", "Instant,Card.Sorcery", "Card.Instant", "Card.Sorcery", "Magecraft", "Prowess", "Storm",
                "Mode$SpellCopy", "Card.nonCreature", "Instant.YouOwn", "Sorcery.YouOwn"),
            "Mode\\$SpellCast[^\\n]*(Instant|Sorcery|nonCreature)",
            (r, x) -> r.getType().isInstant() || r.getType().isSorcery(), NONE, NONE, w("Instant", "Sorcery")),
        new Theme("artifacts", "Artefacts", 1.0,
            w("TokenScript$c_a_", "Treasure", "Clue", "Powerstone", "Incubate", "Investigate", "Fabricate"), null,
            w("Artifact.YouCtrl", "Artifact.Other", "Artifact.nonCreature", "Artifact+YouCtrl", "ValidCard$Artifact",
                "Affinity:Artifact", "Metalcraft", "Improvise", "Artifact.token", "Valid Artifact"), null,
            (r, x) -> r.getType().isArtifact() && !r.getType().isLand(), w("Investigate", "Food"), NONE, w("Artifact")),
        new Theme("enchantments", "Enchantements", 1.0,
            w("Bestow"), null,
            w("Enchantment.YouCtrl", "Enchantment.Other", "ValidCard$Enchantment", "Constellation", "Valid Enchantment",
                "Enchantment+YouCtrl", "Eerie"), null,
            (r, x) -> r.getType().isEnchantment(), NONE, NONE, w("Enchantment")),
        new Theme("voltron", "Équipements et auras", 1.0,
            w("Equip", "Reconfigure", "Bestow", "B$Attach"), null,
            w("Equipment.YouCtrl", "Equipment.Other", "ValidCard$Equipment", "Aura.YouCtrl", "ValidCard$Aura", "Card.Aura",
                "Card.Equipment", "equipped", "Equipped", "EnchantedBy", "AttachedBy", "Mode$Attached", "Valid Equipment", "Valid Aura"),
            null, (r, x) -> r.getType().hasSubtype("Equipment") || r.getType().hasSubtype("Aura"), NONE, NONE, w("Equipment", "Aura")),
        new Theme("lands", "Terrains (landfall)", 1.0,
            w("AdjustLandPlays", "Mode$LandPlayed"),
            "ChangeType\\$[^|\\n]*Land[^\\n]*Destination\\$Battlefield|Destination\\$Battlefield[^\\n]*ChangeType\\$[^|\\n]*Land",
            w("Destination$Battlefield|ValidCard$Land", "Landfall", "Land.YouCtrl", "Mode$LandPlayed", "AdjustLandPlays"), null,
            null, NONE, NONE, w("Land")),
        new Theme("attack", "Attaque", 0.6,
            w("Haste", "Double Strike", "AddPhase", "Myriad", "Melee", "Battle cry", "Exalted", "Dethrone"), null,
            w("Mode$Attacks", "Mode$AttackersDeclared", "CombatDamage$True", "Mode$DamageDoneOnce", "AddPhase"), null, null,
            NONE, NONE, NONE),
        new Theme("blink", "Arrivées et clignotements", 1.0,
            w("Origin$Exile|Destination$Battlefield", "Mode$Panharmonicon"), null,
            NONE, "Destination\\$Battlefield\\|ValidCard\\$(Creature|Permanent|Card)\\.(Other|YouCtrl|nonToken)",
            (r, x) -> x.contains("Destination$Battlefield|ValidCard$Card.Self"), NONE, NONE, NONE),
        new Theme("draw", "Pioche", 0.5,
            w("B$Draw", "P$Draw"), null, w("Mode$Drawn", "YouDrewThisTurn", "CardsDrawn"), null, null,
            NONE, NONE, NONE),
        new Theme("big", "Grosses créatures", 0.8,
            NONE, null, w("powerGE4", "powerGE5", "powerGE6", "GreatestPower", "Ferocious", "Formidable", "SumPower"), null,
            (r, x) -> r.getType().isCreature() && r.getIntPower() >= 5, NONE, NONE, NONE),
        new Theme("legends", "Légendaires", 0.9,
            NONE, null,
            w("Legendary.YouCtrl", "Card.Legendary", "Creature.Legendary", "Permanent.Legendary", "Historic", "ValidCard$Legendary",
                "Legendary+YouCtrl"), null,
            (r, x) -> r.getType().isLegendary() && !r.getType().isLand(), NONE, NONE, w("Legendary")),
        new Theme("walkers", "Planeswalkers", 1.0,
            w("Proliferate"), null, w("Planeswalker.YouCtrl", "ValidCard$Planeswalker", "Planeswalker.Other", "Valid Planeswalker"),
            null, (r, x) -> r.getType().isPlaneswalker(), NONE, NONE, w("Planeswalker")),
        new Theme("vehicles", "Véhicules", 0.9,
            w("Crew"), null, w("Vehicle.YouCtrl", "ValidCard$Vehicle", "Mode$BecomesCrewed", "Card.Vehicle"), null,
            (r, x) -> r.getType().hasSubtype("Vehicle"), NONE, NONE, w("Vehicle")),
        new Theme("energy", "Énergie", 1.0,
            w("CounterType$ENERGY"), null, w("PayEnergy<"), null, null, NONE, NONE, NONE),
        new Theme("steal", "Vol et copie", 0.7,
            w("$GainControl", "B$Clone", "P$Clone"), null, w("YouDontOwn", "OwnedBy"), null, null, NONE, NONE, NONE),
    };

    private static final Pattern PIPE_SPACE = Pattern.compile("[ \\t]*\\|[ \\t]*");
    private static final Pattern DOLLAR_SPACE = Pattern.compile("\\$[ \\t]+");
    private static final Pattern DESCRIPTIONS = Pattern.compile("[A-Za-z]*(?:Description|Desc)\\$[^|\\n]*");
    private static final Pattern TOKEN_SCRIPT = Pattern.compile("TokenScript\\$([a-z0-9_,]+)");
    private static final Pattern WORD = Pattern.compile("(?<![A-Za-z])([A-Z][a-z]+)(?![a-z])");

    // ------------------------------------------------------------------ profil d'une carte

    /** Ce qu'une carte fait, ce dont elle profite, ce qu'elle est (thèmes), ses types de créature et ceux dont elle parle. */
    static final class Profile {
        int has;
        int wants;
        int member;
        Set<String> types = new HashSet<>();
        Set<String> refs = new HashSet<>();
        boolean changeling;
        boolean anyTribe;
        DeckHints deckHas;
        DeckHints deckHints;
    }

    /** Profils des cartes officielles (ils ne changent pas) ; les cartes perso sont relues à chaque fois. */
    private static final Map<String, Profile> PROFILES = new ConcurrentHashMap<>();
    private static volatile int[] themeCounts;
    private static volatile int counted;

    private static Set<String> creatureTypes;

    private static synchronized Set<String> creatureTypes() {
        if (creatureTypes == null) {
            creatureTypes = new HashSet<>(CardType.Constant.CREATURE_TYPES);
        }
        return creatureTypes;
    }

    /** Le script de la carte (toutes ses faces), sans les textes affichés. */
    private static String rawScript(final CardRules r) {
        final StringBuilder sb = new StringBuilder(512);
        for (final ICardFace f : new ICardFace[] {r.getMainPart(), r.getOtherPart()}) {
            if (f == null) {
                continue;
            }
            for (final String s : f.getKeywords()) {
                sb.append("K:").append(s).append('\n');
            }
            for (final String s : f.getAbilities()) {
                sb.append(s).append('\n');
            }
            for (final String s : f.getTriggers()) {
                sb.append(s).append('\n');
            }
            for (final String s : f.getStaticAbilities()) {
                sb.append(s).append('\n');
            }
            for (final String s : f.getReplacements()) {
                sb.append(s).append('\n');
            }
            for (final Map.Entry<String, String> v : f.getVariables()) {
                sb.append(v.getKey()).append(':').append(v.getValue()).append('\n');
            }
        }
        return DESCRIPTIONS.matcher(sb).replaceAll("");
    }

    /** Le script, espaces retirés autour des « | » et après les « $ » (« Mode$ChangesZone|Origin$Any… »). */
    private static String script(final CardRules r) {
        return DOLLAR_SPACE.matcher(PIPE_SPACE.matcher(rawScript(r)).replaceAll("|")).replaceAll("\\$");
    }

    private static boolean any(final String s, final String[] needles) {
        for (final String n : needles) {
            if (s.contains(n)) {
                return true;
            }
        }
        return false;
    }

    static Profile profile(final PaperCard pc) {
        final CardRules r = pc.getRules();
        if (r.isCustom()) {
            return read(r);
        }
        return PROFILES.computeIfAbsent(pc.getName(), n -> read(r));
    }

    private static Profile read(final CardRules r) {
        final Profile p = new Profile();
        final String s = script(r);
        final CardAiHints ai = r.getAiHints();
        p.deckHas = ai == null ? null : valid(ai.getDeckHas());
        p.deckHints = ai == null ? null : merge(valid(ai.getDeckHints()), valid(ai.getDeckNeeds()));
        for (int i = 0; i < THEMES.length; i++) {
            final Theme t = THEMES[i];
            final int bit = 1 << i;
            if (any(s, t.has) || (t.hasRe != null && t.hasRe.matcher(s).find()) || hintHas(p.deckHas, t.forgeHas)) {
                p.has |= bit;
            }
            if (any(s, t.wants) || (t.wantsRe != null && t.wantsRe.matcher(s).find()) || hintHas(p.deckHints, t.forgeWants)
                    || hintType(p.deckHints, t.forgeTypes)) {
                p.wants |= bit;
            }
            if (t.member != null && t.member.test(r, s)) {
                p.member |= bit;
            }
        }
        final CardType type = r.getType();
        p.types.addAll(type.getCreatureTypes());
        p.changeling = r.hasKeyword("Changeling");
        final Set<String> all = creatureTypes();
        // Les jetons créés comptent comme ses types (Krenko fait des Gobelins).
        final Matcher tm = TOKEN_SCRIPT.matcher(s);
        while (tm.find()) {
            for (final String script : tm.group(1).split(",")) {
                for (final String part : script.split("_")) {
                    if (part.length() > 1) {
                        final String cap = Character.toUpperCase(part.charAt(0)) + part.substring(1);
                        if (all.contains(cap)) {
                            p.types.add(cap);
                        }
                    }
                }
            }
        }
        final Matcher wm = WORD.matcher(s);
        while (wm.find()) {
            final String word = wm.group(1);
            if (all.contains(word)) {
                p.refs.add(word);
            }
        }
        p.anyTribe = s.contains("ChosenType") || s.contains("sharesCreatureTypeWith");
        // Gardé pour toute la session (des dizaines de milliers de cartes) : des ensembles aussi petits que possible.
        p.types = compact(p.types);
        p.refs = compact(p.refs);
        return p;
    }

    private static Set<String> compact(final Set<String> set) {
        if (set.isEmpty()) {
            return java.util.Collections.emptySet();
        }
        return set.size() == 1 ? java.util.Collections.singleton(set.iterator().next()) : set;
    }

    private static DeckHints valid(final DeckHints h) {
        return h != null && h.isValid() ? h : null;
    }

    /** DeckHints et DeckNeeds : ce dont la carte profite, lu dans l'un ou l'autre. */
    private static DeckHints merge(final DeckHints a, final DeckHints b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return new MergedHints(a, b);
    }

    /** Deux séries d'indices lues comme une seule. */
    private static final class MergedHints extends DeckHints {
        private final DeckHints a;
        private final DeckHints b;

        MergedHints(final DeckHints a, final DeckHints b) {
            super("");
            this.a = a;
            this.b = b;
        }

        @Override
        public boolean isValid() {
            return true;
        }

        @Override
        public boolean contains(final DeckHints.Type type, final String hint) {
            return a.contains(type, hint) || b.contains(type, hint);
        }
    }

    private static boolean hintHas(final DeckHints h, final String[] abilities) {
        if (h == null) {
            return false;
        }
        for (final String a : abilities) {
            if (h.contains(DeckHints.Type.ABILITY, a)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hintType(final DeckHints h, final String[] types) {
        if (h == null) {
            return false;
        }
        for (final String t : types) {
            if (h.contains(DeckHints.Type.TYPE, t)) {
                return true;
            }
        }
        return false;
    }

    /** Combien de cartes touchent chaque thème (pour sa rareté) : compté une fois sur tout le catalogue. */
    private static int[] themeCounts(final List<Catalog.Entry> all) {
        int[] counts = themeCounts;
        if (counts != null && Math.abs(counted - all.size()) < 200) {
            return counts;
        }
        counts = new int[THEMES.length];
        for (final Catalog.Entry e : all) {
            final Profile p = profile(e.card());
            final int bits = p.has | p.wants | p.member;
            for (int i = 0; i < THEMES.length; i++) {
                if ((bits & (1 << i)) != 0) {
                    counts[i]++;
                }
            }
        }
        themeCounts = counts;
        counted = all.size();
        return counts;
    }

    // ------------------------------------------------------------------ calcul

    /** Ce que veut le commandant (ou le duo) : force de chaque thème (fait, profite, est) et types de créature. */
    private static final class Wish {
        final double[] wants = new double[THEMES.length];
        final double[] has = new double[THEMES.length];
        final double[] member = new double[THEMES.length];
        /** Types dont il parle ou qu'il crée : tribal fort. Ses propres types : tribal léger. */
        final Set<String> strong = new LinkedHashSet<>();
        final Set<String> weak = new LinkedHashSet<>();
    }

    private static Wish wish(final List<PaperCard> commanders) {
        final Wish w = new Wish();
        for (final PaperCard pc : commanders) {
            final Profile p = profile(pc);
            for (int i = 0; i < THEMES.length; i++) {
                final int bit = 1 << i;
                w.wants[i] += (p.wants & bit) != 0 ? 1 : 0;
                w.has[i] += (p.has & bit) != 0 ? 1 : 0;
                w.member[i] += (p.member & bit) != 0 ? 1 : 0;
            }
            w.strong.addAll(p.refs);
            for (final String t : p.types) {
                // Les jetons qu'il crée comptent comme un thème fort ; ses propres types, léger.
                if (!pc.getRules().getType().getCreatureTypes().contains(t)) {
                    w.strong.add(t);
                }
            }
            w.weak.addAll(pc.getRules().getType().getCreatureTypes());
        }
        w.weak.removeAll(w.strong);
        return w;
    }

    /** Points d'une carte pour un thème : ce qu'elle apporte à ce que veut le commandant (et l'inverse). */
    private static double themePoints(final Wish w, final int i, final Profile c) {
        final int bit = 1 << i;
        final boolean cHas = (c.has & bit) != 0;
        final boolean cWants = (c.wants & bit) != 0;
        final boolean cMember = (c.member & bit) != 0;
        double best = 0;
        if (w.wants[i] > 0) {
            best = Math.max(best, w.wants[i] * (cHas ? 1.0 : cMember ? 0.6 : cWants ? 0.5 : 0));
        }
        if (w.has[i] > 0) {
            best = Math.max(best, w.has[i] * (cWants ? 1.0 : cHas ? 0.3 : 0));
        }
        if (w.member[i] > 0) {
            best = Math.max(best, w.member[i] * (cWants ? 0.5 : 0));
        }
        return best;
    }

    private static boolean isType(final Profile c, final String t) {
        return c.types.contains(t);
    }

    private static boolean refersTo(final Profile c, final String t) {
        return c.refs.contains(t) || (c.deckHints != null && c.deckHints.contains(DeckHints.Type.TYPE, t));
    }

    private static boolean makesType(final Profile c, final String t) {
        return c.deckHas != null && c.deckHas.contains(DeckHints.Type.TYPE, t);
    }

    /** Le nom français d'un type de créature (« Goblin » → « Gobelin »), sinon le type tel quel. */
    private static String typeFr(final String t) {
        String fr = French.creatureType(t);
        if (fr == null || fr.isEmpty()) {
            fr = French.creatureTypeFr(t);
        }
        return fr == null || fr.isEmpty() ? t : fr;
    }

    private static final class Scored {
        final PaperCard card;
        final Catalog.Entry entry;
        double local;
        double edh;
        /** Part moyenne des decks EDHREC des commandants semblables qui jouent la carte (0 à 1). */
        double incl;
        double total;
        final Map<String, Double> reasons = new LinkedHashMap<>();
        final Set<String> playedWith = new LinkedHashSet<>();

        Scored(final Catalog.Entry e) {
            this.entry = e;
            this.card = e.card();
        }
    }

    /**
     * Les cartes conseillées pour ces commandants (perso, ou officiels inconnus d'EDHREC). {@code note} : pourquoi le
     * calcul de l'appli remplace EDHREC (affiché en tête).
     */
    static JsonObject compute(final Catalog catalog, final List<String> names, final String note) {
        final long t0 = System.nanoTime();
        final List<PaperCard> commanders = new ArrayList<>();
        for (final String n : names) {
            final PaperCard pc = catalog.resolve(n);
            if (pc != null) {
                commanders.add(pc);
            }
        }
        if (commanders.isEmpty()) {
            throw new IllegalArgumentException("Choisis d'abord un commandant.");
        }
        final Set<String> commanderNames = new HashSet<>();
        final StringBuilder idb = new StringBuilder();
        for (final PaperCard pc : commanders) {
            commanderNames.add(pc.getName());
            idb.append(GameSerializer.colors(pc.getRules().getColorIdentity()));
        }
        final String identity = orderColors(idb.toString());
        final List<Catalog.Entry> all = catalog.entries();
        final int[] counts = themeCounts(all);
        final int n = Math.max(1, all.size());
        final double[] idf = new double[THEMES.length];
        for (int i = 0; i < THEMES.length; i++) {
            idf[i] = Math.log((n + 1.0) / (counts[i] + 1.0));
        }
        final Wish w = wish(commanders);
        final Map<String, Integer> pop = Precons.popularity();

        // Les cartes jouables avec ce commandant.
        final List<Scored> pool = new ArrayList<>();
        for (final Catalog.Entry e : all) {
            if (!e.commanderLegal() || commanderNames.contains(e.nameEn()) || Career.isBasic(e.card())
                    || !Catalog.inIdentity(e.identity(), identity)) {
                continue;
            }
            pool.add(new Scored(e));
        }
        // Rareté de chaque type de créature voulu, dans les cartes de ces couleurs.
        final Set<String> tribes = new LinkedHashSet<>(w.strong);
        tribes.addAll(w.weak);
        final Map<String, Double> tribeIdf = new HashMap<>();
        for (final String t : tribes) {
            int c = 0;
            for (final Scored s : pool) {
                final Profile p = profile(s.card);
                if (isType(p, t) || refersTo(p, t)) {
                    c++;
                }
            }
            tribeIdf.put(t, Math.log((pool.size() + 1.0) / (c + 1.0)));
        }

        // 1. Thèmes et types partagés.
        for (final Scored s : pool) {
            final Profile c = profile(s.card);
            double score = 0;
            for (int i = 0; i < THEMES.length; i++) {
                final double pts = themePoints(w, i, c) * idf[i] * THEMES[i].weight;
                if (pts > 0) {
                    score += pts;
                    s.reasons.merge(THEMES[i].fr, pts, Double::sum);
                }
            }
            for (final String t : tribes) {
                final boolean strong = w.strong.contains(t);
                final double tIdf = tribeIdf.getOrDefault(t, 1.0);
                double pts = 0;
                if (refersTo(c, t)) {
                    pts = Math.max(pts, (strong ? 2.6 : 0.8) * tIdf);
                }
                if (isType(c, t) || makesType(c, t)) {
                    pts = Math.max(pts, (strong ? 2.2 : 0.25) * tIdf);
                } else if (c.changeling && s.card.getRules().getType().isCreature()) {
                    pts = Math.max(pts, (strong ? 1.6 : 0.2) * tIdf);
                }
                if (pts > 0) {
                    score += pts;
                    // Un type que le commandant a sans en parler (Guerrier de Krenko) ne sert pas d'explication.
                    if (strong || pts >= 2) {
                        s.reasons.merge(typeFr(t), pts, Double::sum);
                    }
                }
            }
            if (c.anyTribe && !w.strong.isEmpty() && score > 0) {
                score += 1.2;
                s.reasons.merge("Types de créature", 1.2, Double::sum);
            }
            s.local = score;
        }

        // 2. Commandants officiels semblables et leurs pages EDHREC.
        final List<Object[]> similar = similarCommanders(all, commanders, w, idf, identity, commanderNames);
        final JsonArray similarJson = new JsonArray();
        final List<JsonObject> pages = fetchPages(catalog, similar);
        boolean offline = false;
        double weights = 0;
        final Map<String, Scored> byName = new HashMap<>();
        for (final Scored s : pool) {
            byName.put(s.card.getName(), s);
        }
        final JsonArray combos = new JsonArray();
        final Set<String> comboKeys = new HashSet<>();
        for (int k = 0; k < similar.size(); k++) {
            final PaperCard pc = (PaperCard) similar.get(k)[0];
            final double sim = (Double) similar.get(k)[1];
            final JsonObject page = pages.get(k);
            final JsonObject o = new JsonObject();
            o.addProperty("name", pc.getName());
            o.add("card", Catalog.paperJson(pc));
            o.addProperty("url", "https://edhrec.com/commanders/" + Edhrec.slug(List.of(pc.getName())));
            o.addProperty("found", page != null && !page.has("error"));
            similarJson.add(o);
            if (page == null || page.has("error")) {
                offline |= page != null && page.get("error").getAsString().startsWith("EDHREC injoignable");
                continue;
            }
            o.addProperty("decks", page.get("decks").getAsLong());
            weights += sim;
            final Set<String> seen = new HashSet<>();
            for (final JsonElement le : page.getAsJsonArray("lists")) {
                for (final JsonElement ce : le.getAsJsonObject().getAsJsonArray("cards")) {
                    final JsonObject c = ce.getAsJsonObject();
                    final String name = c.get("name").getAsString();
                    final Scored s = byName.get(name);
                    if (s == null || !seen.add(name)) {
                        continue;
                    }
                    final double incl = c.get("inclusion").getAsDouble() / 100;
                    s.edh += sim * (incl + Math.max(0, c.get("synergy").getAsDouble()) / 100);
                    s.incl += sim * incl;
                    if (s.playedWith.size() < 2) {
                        s.playedWith.add(pc.getName());
                    }
                }
            }
            // Combos de ce commandant qui se jouent sans lui, dans ces couleurs.
            for (final JsonElement ce : page.getAsJsonArray("combos")) {
                final JsonObject combo = ce.getAsJsonObject();
                boolean ok = true;
                final List<String> key = new ArrayList<>();
                for (final JsonElement x : combo.getAsJsonArray("cards")) {
                    final String name = x.getAsJsonObject().get("name").getAsString();
                    key.add(name);
                    if (!byName.containsKey(name) && !commanderNames.contains(name)) {
                        ok = false;
                    }
                }
                key.sort(String::compareTo);
                if (ok && comboKeys.add(String.join("|", key)) && combos.size() < 40) {
                    combo.addProperty("with", pc.getName());
                    combo.add("withFr", o.getAsJsonObject("card").get("nameFr"));
                    // Les combos qui se passent du commandant semblable d'abord (lui, il faudrait le mettre dans le deck).
                    combo.addProperty("needsOther", key.contains(pc.getName()));
                    combos.add(combo);
                }
            }
        }
        final double norm = weights > 0 ? weights : 1;
        double best = 0;
        for (final Scored s : pool) {
            s.edh /= norm;
            s.incl /= norm;
            final int precons = pop.getOrDefault(s.card.getName(), 0);
            final double quality = 1 + 0.3 * Math.log(1 + precons);
            s.total = s.local * quality + 9 * s.edh + 0.15 * Math.log(1 + precons);
            best = Math.max(best, s.total);
        }

        // 3. Mise en forme : meilleures synergies, puis par catégorie.
        final List<Scored> bySynergy = new ArrayList<>();
        for (final Scored s : pool) {
            if (s.local > 0) {
                bySynergy.add(s);
            }
        }
        bySynergy.sort((a, b) -> Double.compare(b.local * (1 + 0.6 * b.edh) + 2 * b.edh, a.local * (1 + 0.6 * a.edh) + 2 * a.edh));
        final List<Scored> byTotal = new ArrayList<>(pool);
        byTotal.removeIf(s -> s.total <= 0.2);
        byTotal.sort((a, b) -> Double.compare(b.total, a.total));

        final JsonObject out = new JsonObject();
        out.addProperty("source", "local");
        out.addProperty("custom", commanders.stream().anyMatch(pc -> pc.getRules().isCustom()));
        out.addProperty("note", note == null ? "" : note);
        out.addProperty("slug", "");
        out.addProperty("url", "");
        out.addProperty("fetchedAt", System.currentTimeMillis());
        out.addProperty("offline", offline);
        out.addProperty("decks", 0);
        out.addProperty("identity", identity);
        final double top = best > 0 ? best : 1;
        final Map<String, JsonObject> cardJson = new HashMap<>();
        final JsonArray synergy = new JsonArray();
        for (int i = 0; i < Math.min(60, bySynergy.size()); i++) {
            synergy.add(cardJson(cardJson, bySynergy.get(i), top));
        }
        out.add("synergy", synergy);
        final JsonArray lists = new JsonArray();
        final String[][] cats = {{"top", "Les plus conseillées"}, {"creatures", "Créatures"}, {"instants", "Éphémères"},
            {"sorceries", "Rituels"}, {"artifacts", "Artefacts"}, {"enchantments", "Enchantements"}, {"planeswalkers", "Planeswalkers"},
            {"lands", "Terrains"}};
        for (final String[] cat : cats) {
            final JsonArray cards = new JsonArray();
            for (final Scored s : byTotal) {
                if (cards.size() >= (cat[0].equals("top") ? 40 : 30)) {
                    break;
                }
                if (inCategory(s.card.getRules().getType(), cat[0])) {
                    cards.add(cardJson(cardJson, s, top));
                }
            }
            if (cards.size() > 0) {
                final JsonObject l = new JsonObject();
                l.addProperty("tag", cat[0]);
                l.addProperty("title", cat[1]);
                l.add("cards", cards);
                lists.add(l);
            }
        }
        out.add("lists", lists);
        final List<JsonObject> sortedCombos = new ArrayList<>();
        combos.forEach(c -> sortedCombos.add(c.getAsJsonObject()));
        sortedCombos.sort((a, b) -> {
            final int x = Boolean.compare(a.get("needsOther").getAsBoolean(), b.get("needsOther").getAsBoolean());
            return x != 0 ? x : Long.compare(b.get("decks").getAsLong(), a.get("decks").getAsLong());
        });
        final JsonArray comboOut = new JsonArray();
        sortedCombos.forEach(comboOut::add);
        out.add("combos", comboOut);
        // Thèmes repérés chez le commandant, du plus marqué au moins marqué.
        final List<Object[]> themes = new ArrayList<>();
        for (int i = 0; i < THEMES.length; i++) {
            final double v = (w.wants[i] + 0.6 * w.has[i] + 0.25 * w.member[i]) * idf[i] * THEMES[i].weight;
            if (w.wants[i] + w.has[i] > 0) {
                themes.add(new Object[] {THEMES[i].fr, v});
            }
        }
        for (final String t : w.strong) {
            themes.add(new Object[] {typeFr(t), 2.4 * tribeIdf.getOrDefault(t, 1.0)});
        }
        themes.sort((a, b) -> Double.compare((Double) b[1], (Double) a[1]));
        final JsonArray th = new JsonArray();
        for (int i = 0; i < Math.min(8, themes.size()); i++) {
            final JsonObject o = new JsonObject();
            o.addProperty("name", (String) themes.get(i)[0]);
            th.add(o);
        }
        out.add("themes", th);
        out.add("similar", similarJson);
        out.add("brackets", new JsonObject());
        // Pour le tri de la recherche : toutes les cartes qui ont un score.
        final JsonObject scores = new JsonObject();
        for (final Scored s : byTotal) {
            if (scores.size() >= 800) {
                break;
            }
            final JsonArray v = new JsonArray();
            v.add(Math.round(1000 * s.total / top) / 10.0);
            v.add(reasonText(s, 2));
            scores.add(s.card.getName(), v);
        }
        out.add("scores", scores);
        out.addProperty("ms", (System.nanoTime() - t0) / 1_000_000);
        return out;
    }

    private static boolean inCategory(final CardType t, final String cat) {
        switch (cat) {
            case "top":
                return true;
            case "creatures":
                return t.isCreature() && !t.isLand();
            case "instants":
                return t.isInstant();
            case "sorceries":
                return t.isSorcery();
            case "artifacts":
                return t.isArtifact() && !t.isCreature() && !t.isLand();
            case "enchantments":
                return t.isEnchantment() && !t.isCreature() && !t.isLand();
            case "planeswalkers":
                return t.isPlaneswalker();
            case "lands":
                return t.isLand();
            default:
                return false;
        }
    }

    private static String reasonText(final Scored s, final int max) {
        final List<Map.Entry<String, Double>> r = new ArrayList<>(s.reasons.entrySet());
        r.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));
        final List<String> parts = new ArrayList<>();
        for (int i = 0; i < Math.min(max, r.size()); i++) {
            parts.add(r.get(i).getKey());
        }
        if (parts.isEmpty() && !s.playedWith.isEmpty()) {
            parts.add("EDHREC");
        }
        return String.join(" · ", parts);
    }

    private static JsonObject cardJson(final Map<String, JsonObject> cache, final Scored s, final double top) {
        final JsonObject base = cache.computeIfAbsent(s.card.getName(), k -> Catalog.paperJson(s.card));
        final JsonObject c = base.deepCopy();
        c.addProperty("score", Math.round(100 * s.total / top));
        c.addProperty("why", reasonText(s, 3));
        c.addProperty("synergy", Math.round(100 * s.total / top));
        c.addProperty("inclusion", Math.round(1000 * Math.min(1, s.incl)) / 10.0);
        final JsonArray with = new JsonArray();
        s.playedWith.forEach(with::add);
        c.add("playedWith", with);
        return c;
    }

    private static String orderColors(final String s) {
        final StringBuilder b = new StringBuilder();
        for (final char c : "WUBRG".toCharArray()) {
            if (s.indexOf(c) >= 0) {
                b.append(c);
            }
        }
        return b.toString();
    }

    /**
     * Les commandants officiels les plus proches : couleurs comprises dans celles du deck (les mêmes de préférence),
     * mêmes thèmes, mêmes types de créature. Un partenaire officiel du duo passe en premier. [carte, poids].
     */
    private static List<Object[]> similarCommanders(final List<Catalog.Entry> all, final List<PaperCard> commanders, final Wish w,
                                                    final double[] idf, final String identity, final Set<String> exclude) {
        final List<Object[]> scored = new ArrayList<>();
        double partner = 0;
        for (final Catalog.Entry e : all) {
            if (!e.canBeCommander() || e.card().getRules().isCustom() || exclude.contains(e.nameEn())
                    || !Catalog.inIdentity(e.identity(), identity)) {
                continue;
            }
            final Profile c = profile(e.card());
            double sim = 0;
            for (int i = 0; i < THEMES.length; i++) {
                final int bit = 1 << i;
                final double mine = Math.min(1, w.wants[i]) + 0.6 * Math.min(1, w.has[i]);
                final double theirs = ((c.wants & bit) != 0 ? 1 : 0) + ((c.has & bit) != 0 ? 0.6 : 0);
                sim += Math.min(mine, theirs) * idf[i] * THEMES[i].weight;
            }
            for (final String t : w.strong) {
                if (refersTo(c, t) || isType(c, t)) {
                    sim += 3.0;
                }
            }
            for (final String t : w.weak) {
                if (isType(c, t)) {
                    sim += 0.4;
                }
            }
            if (sim <= 0) {
                continue;
            }
            final int colors = e.identity().length();
            sim *= colors == identity.length() ? 1.25 : 0.55 + 0.45 * colors / Math.max(1, identity.length());
            scored.add(new Object[] {e.card(), sim});
            partner = Math.max(partner, sim);
        }
        scored.sort((a, b) -> Double.compare((Double) b[1], (Double) a[1]));
        final List<Object[]> out = new ArrayList<>();
        // Un commandant officiel du duo (partenaire d'un commandant perso) : sa page compte le plus.
        for (final PaperCard pc : commanders) {
            if (!pc.getRules().isCustom() && commanders.size() > 1) {
                out.add(new Object[] {pc, Math.max(1, partner * 1.2)});
            }
        }
        final double best = scored.isEmpty() ? 0 : (Double) scored.get(0)[1];
        for (final Object[] o : scored) {
            if (out.size() >= 4) {
                break;
            }
            if ((Double) o[1] >= best * 0.35) {
                out.add(o);
            }
        }
        return out;
    }

    /**
     * Les pages EDHREC des commandants semblables, lues ensemble (gardées un jour). Une page absente devient
     * {"error": message} ; hors connexion, on n'insiste pas.
     */
    private static List<JsonObject> fetchPages(final Catalog catalog, final List<Object[]> similar) {
        final List<JsonObject> out = new ArrayList<>();
        if (similar.isEmpty()) {
            return out;
        }
        final ExecutorService pool = Executors.newFixedThreadPool(Math.min(4, similar.size()), r -> {
            final Thread t = new Thread(r, "atclaude-edhrec");
            t.setDaemon(true);
            return t;
        });
        try {
            final List<Future<JsonObject>> jobs = new ArrayList<>();
            for (int k = 0; k < similar.size(); k++) {
                final String name = ((PaperCard) similar.get(k)[0]).getName();
                final boolean withCombos = k < 2;
                jobs.add(pool.submit(() -> Edhrec.fetch(List.of(name), withCombos)));
            }
            for (final Future<JsonObject> f : jobs) {
                JsonObject page;
                try {
                    page = Edhrec.present(catalog, f.get(60, TimeUnit.SECONDS));
                } catch (final Exception e) {
                    page = new JsonObject();
                    final Throwable cause = e.getCause() != null ? e.getCause() : e;
                    page.addProperty("error", String.valueOf(cause.getMessage()));
                }
                out.add(page);
            }
        } finally {
            pool.shutdownNow();
        }
        return out;
    }

    /** Empreinte d'une carte perso (script, types, couleurs) : modifiée dans l'Atelier, ses conseils sont recalculés. */
    static int signature(final PaperCard pc) {
        final CardRules r = pc.getRules();
        return (rawScript(r) + "|" + r.getType() + "|" + r.getColorIdentity()).hashCode();
    }

    /** Pour les tests et le relevé : combien de profils sont gardés. */
    static int cachedProfiles() {
        return PROFILES.size();
    }

    static Collection<String> themeNames() {
        final List<String> out = new ArrayList<>();
        for (final Theme t : THEMES) {
            out.add(t.id + "=" + t.fr);
        }
        return out;
    }

    static String describe(final PaperCard pc) {
        final Profile p = profile(pc);
        final StringBuilder b = new StringBuilder();
        for (int i = 0; i < THEMES.length; i++) {
            final int bit = 1 << i;
            final String f = ((p.has & bit) != 0 ? "F" : "") + ((p.wants & bit) != 0 ? "P" : "") + ((p.member & bit) != 0 ? "E" : "");
            if (!f.isEmpty()) {
                b.append(THEMES[i].id).append('(').append(f).append(") ");
            }
        }
        b.append("types=").append(p.types).append(" refs=").append(p.refs);
        return b.toString();
    }
}
