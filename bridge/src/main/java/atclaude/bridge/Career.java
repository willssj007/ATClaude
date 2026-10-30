package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.card.CardEdition;
import forge.card.CardRarity;
import forge.deck.Deck;
import forge.deck.DeckSection;
import forge.item.BoosterPack;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;
import forge.model.FModel;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Mode Planeswalker : une carrière avec sa collection de cartes, ses decks, sa réserve de « mana » (la monnaie du jeu),
 * ses boosters et ses jetons de rareté. On commence avec un préconstruit Commander de bracket 2, choisi ; chaque duel
 * gagné rapporte du mana, quelques cartes du deck adverse (jamais une carte déjà possédée) et un booster ; 5 victoires
 * d'affilée (une série), 5 boosters et un nouveau préconstruit au choix ; d'autres s'achètent avec du mana. Les
 * préconstruits de bracket 3 et plus se débloquent au fil des séries : un bracket de plus toutes les 2 séries.
 * L'adversaire a le même bracket et une puissance proche du deck joué. Une carte reçue en double devient un jeton de sa
 * rareté, qui achète une carte manquante de même rareté.
 *
 * Tout est décidé ici, pas dans l'interface : récompenses, achats, contenu des boosters et cartes autorisées dans les decks.
 * Le fichier suit le compte (synchronisation) : la version la plus récente gagne.
 */
final class Career {

    static final int WIN_MANA = 200;
    static final int BOOSTER_PRICE = 750;
    static final int CARDS_PER_WIN = 3;
    static final int STREAK_BONUS_EVERY = 5;
    static final int STREAK_BONUS_BOOSTERS = 5;
    static final int PACK_SIZE = 14;
    /** Séries terminées pour débloquer chaque bracket au-dessus du 2 (bracket 3 après 2 séries, 4 après 4...). */
    static final int SERIES_PER_BRACKET = 2;
    /** Prix d'un préconstruit en mana, par bracket (1 à 5). */
    private static final int[] DECK_PRICES = {0, 2000, 2500, 3500, 5000, 7000};
    static final String KEY_PREFIX = "career:";
    static final List<String> RARITIES = List.of("common", "uncommon", "rare", "mythic");
    private static final List<String> COUNTERS = List.of("mana", "wins", "losses", "streak", "bestStreak", "opened", "mythics", "duels", "deckChoices", "series");

    private static final Random RANDOM = new Random();

    private Career() { }

    static File file() {
        return new File(ForgeConstants.USER_DIR, "atclaude-career.json");
    }

    // ------------------------------------------------------------------ fichier

    static synchronized JsonObject load() {
        final File f = file();
        if (f.isFile()) {
            try {
                final JsonObject o = JsonParser.parseString(Io.read(f)).getAsJsonObject();
                if (o.has("version")) {
                    return o;
                }
            } catch (final IOException | RuntimeException e) {
                System.err.println("Carrière illisible : " + e.getMessage());
            }
        }
        final JsonObject o = new JsonObject();
        o.addProperty("version", 1);
        o.addProperty("started", false);
        o.addProperty("at", 0);
        return o;
    }

    /** Enregistre une modification faite ici : elle devient la version la plus récente pour la synchronisation. */
    private static void save(final JsonObject o) {
        o.addProperty("at", Math.max(System.currentTimeMillis(), num(o, "at") + 1));
        write(o);
    }

    private static void write(final JsonObject o) {
        try {
            final File f = file();
            f.getParentFile().mkdirs();
            final File tmp = new File(f.getPath() + ".tmp");
            Io.write(tmp, o.toString());
            Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (final IOException e) {
            throw new IllegalStateException("Carrière non enregistrée : " + e.getMessage());
        }
    }

    /** Synchronisation : la carrière d'un autre appareil remplace celle-ci si elle est plus récente. */
    static synchronized boolean mergeIn(final JsonObject other) {
        if (other == null || !other.has("version") || num(other, "at") <= num(load(), "at")) {
            return false;
        }
        write(other);
        return true;
    }

    // ------------------------------------------------------------------ état

    static synchronized boolean started() {
        return bool(load(), "started");
    }

    /** Tout ce que l'interface affiche : mana, série, boosters, jetons, decks. */
    static synchronized JsonObject summary(final Catalog catalog) {
        final JsonObject c = load();
        final JsonObject o = new JsonObject();
        o.addProperty("started", bool(c, "started"));
        for (final String k : COUNTERS) {
            o.addProperty(k, num(c, k));
        }
        o.addProperty("series", series(c));
        o.addProperty("maxBracket", maxBracket(c));
        o.addProperty("seriesPerBracket", SERIES_PER_BRACKET);
        o.addProperty("price", BOOSTER_PRICE);
        o.addProperty("winMana", WIN_MANA);
        o.addProperty("cardsPerWin", CARDS_PER_WIN);
        o.addProperty("bonusEvery", STREAK_BONUS_EVERY);
        o.addProperty("bonusBoosters", STREAK_BONUS_BOOSTERS);
        final JsonObject coll = collection(c);
        int total = 0;
        for (final Map.Entry<String, JsonElement> e : coll.entrySet()) {
            total += e.getValue().getAsInt();
        }
        o.addProperty("unique", coll.size());
        o.addProperty("cards", total);
        o.add("wildcards", wildcards(c));
        final JsonArray boosters = new JsonArray();
        for (final JsonElement e : array(c, "boosters")) {
            final JsonObject b = e.getAsJsonObject().deepCopy();
            final CardEdition ed = FModel.getMagicDb().getEditions().get(str(b, "set"));
            b.addProperty("name", ed == null ? str(b, "set") : ed.getName());
            boosters.add(b);
        }
        o.add("boosters", boosters);
        o.add("decks", deckList(catalog, c));
        if (c.has("starter")) {
            o.addProperty("starter", str(c, "starter"));
        }
        o.add("cosmetics", array(c, "cosmetics").deepCopy());
        o.addProperty("cosmeticPrice", COSMETIC_PRICE);
        if (bool(c, "started")) {
            o.add("challenges", Challenges.view(c));
        }
        return o;
    }

    /** Change un défi du jour (une fois par jour) ; renvoie la carrière à jour. */
    static synchronized JsonObject swapChallenge(final Catalog catalog, final String id) {
        final JsonObject c = load();
        if (!bool(c, "started")) {
            throw new IllegalStateException("Commence d'abord ta carrière de Planeswalker.");
        }
        Challenges.swap(c, id);
        save(c);
        return summary(catalog);
    }

    /** Prix en mana d'une apparence mythique à acheter (fond, dos de cartes). */
    static final int COSMETIC_PRICE = 3000;

    /** Achète une apparence (« menu:nebula », « back:rune »...) avec du mana ; elle reste acquise. */
    static synchronized JsonObject buyCosmetic(final Catalog catalog, final String id) {
        final JsonObject c = load();
        if (!bool(c, "started")) {
            throw new IllegalStateException("Les apparences s'achètent avec le mana du mode Planeswalker : commence d'abord ta carrière.");
        }
        if (id == null || !id.matches("[a-z]+:[a-z0-9-]+")) {
            throw new IllegalArgumentException("Apparence inconnue.");
        }
        final JsonArray owned = array(c, "cosmetics");
        for (final JsonElement e : owned) {
            if (id.equals(e.getAsString())) {
                return summary(catalog);
            }
        }
        final long mana = num(c, "mana");
        if (mana < COSMETIC_PRICE) {
            throw new IllegalStateException("Il te faut " + COSMETIC_PRICE + " mana (tu en as " + mana + "). Chaque duel gagné en rapporte " + WIN_MANA + ".");
        }
        c.addProperty("mana", mana - COSMETIC_PRICE);
        owned.add(id);
        c.add("cosmetics", owned);
        save(c);
        return summary(catalog);
    }

    /** Préconstruits proposés pour commencer : ceux de bracket 2, du moins puissant au plus puissant. */
    static JsonArray startChoices() {
        final List<Precons.Info> list = new ArrayList<>();
        for (final Precons.Info i : Precons.all()) {
            if (i.bracket() == 2) {
                list.add(i);
            }
        }
        list.sort(Comparator.comparingDouble(Precons.Info::power).thenComparing(Precons.Info::name));
        final JsonArray a = new JsonArray();
        list.forEach(i -> a.add(i.json()));
        return a;
    }

    /** Début de carrière avec le préconstruit choisi (bracket 2) : ses cartes forment la collection. */
    static synchronized JsonObject start(final Catalog catalog, final String preconKey) {
        final JsonObject c = load();
        if (bool(c, "started")) {
            return summary(catalog);
        }
        final Precons.Info info = Precons.get(preconKey);
        if (info == null || info.bracket() != 2) {
            throw new IllegalArgumentException("Choisis un préconstruit de bracket 2 pour commencer.");
        }
        final JsonObject fresh = new JsonObject();
        fresh.addProperty("version", 1);
        fresh.addProperty("started", true);
        fresh.addProperty("startedAt", System.currentTimeMillis());
        fresh.addProperty("at", num(c, "at"));
        for (final String k : COUNTERS) {
            fresh.addProperty(k, 0);
        }
        fresh.add("collection", new JsonObject());
        fresh.add("boosters", new JsonArray());
        fresh.add("decks", new JsonArray());
        fresh.add("precons", new JsonArray());
        addPrecon(catalog, fresh, info);
        fresh.addProperty("starter", info.name());
        save(fresh);
        return summary(catalog);
    }

    /**
     * Préconstruits qu'on n'a pas encore, à prendre avec un choix gagné (série de victoires) ou à acheter : chacun avec
     * son prix, et « locked » si son bracket n'est pas encore débloqué (avec le nombre de séries qu'il faut).
     */
    static synchronized JsonArray deckChoices() {
        final JsonObject c = load();
        final int max = maxBracket(c);
        final Set<String> taken = new HashSet<>();
        for (final JsonElement e : array(c, "precons")) {
            taken.add(e.getAsString());
        }
        final List<Precons.Info> list = new ArrayList<>();
        for (final Precons.Info i : Precons.all()) {
            if (!taken.contains(i.key())) {
                list.add(i);
            }
        }
        list.sort(Comparator.comparingInt(Precons.Info::bracket).thenComparingDouble(Precons.Info::power).thenComparing(Precons.Info::name));
        final JsonArray a = new JsonArray();
        for (final Precons.Info i : list) {
            final JsonObject o = i.json();
            o.addProperty("price", deckPrice(i.bracket()));
            if (i.bracket() > max) {
                o.addProperty("locked", true);
                o.addProperty("unlockSeries", (i.bracket() - 2) * SERIES_PER_BRACKET);
            }
            a.add(o);
        }
        return a;
    }

    /** Bracket le plus haut qu'on peut prendre ou acheter : 2 au départ, un de plus toutes les 2 séries terminées. */
    static int maxBracket(final JsonObject c) {
        return (int) Math.min(5, 2 + series(c) / SERIES_PER_BRACKET);
    }

    /** Séries de 5 victoires terminées (déduites des decks gagnés pour une carrière d'avant ce compteur). */
    private static long series(final JsonObject c) {
        if (c.has("series")) {
            return num(c, "series");
        }
        return Math.max(0, array(c, "precons").size() - 1 + num(c, "deckChoices"));
    }

    static int deckPrice(final int bracket) {
        return DECK_PRICES[Math.max(1, Math.min(5, bracket))];
    }

    /** Achète un préconstruit avec du mana (bracket débloqué) : son deck et ses cartes, comme un deck gagné. */
    static synchronized JsonObject buyDeck(final Catalog catalog, final String preconKey) {
        final JsonObject c = load();
        if (!bool(c, "started")) {
            throw new IllegalStateException("Commence d'abord ta carrière de Planeswalker.");
        }
        final Precons.Info info = takeable(c, preconKey);
        final int price = deckPrice(info.bracket());
        if (num(c, "mana") < price) {
            throw new IllegalStateException("Il te faut " + price + " mana pour ce deck.");
        }
        c.addProperty("mana", num(c, "mana") - price);
        c.addProperty("series", series(c));
        final JsonObject dupes = addPrecon(catalog, c, info);
        save(c);
        final JsonObject o = summary(catalog);
        o.add("dupes", dupes);
        o.addProperty("chosen", KEY_PREFIX + uniqueDeckName(c, info.name(), true));
        return o;
    }

    /** Le préconstruit demandé, s'il existe, n'est pas déjà possédé et son bracket est débloqué. */
    private static Precons.Info takeable(final JsonObject c, final String preconKey) {
        final Precons.Info info = Precons.get(preconKey);
        if (info == null) {
            throw new IllegalArgumentException("Préconstruit introuvable.");
        }
        for (final JsonElement e : array(c, "precons")) {
            if (e.getAsString().equals(preconKey)) {
                throw new IllegalArgumentException("Tu as déjà ce deck.");
            }
        }
        final int max = maxBracket(c);
        if (info.bracket() > max) {
            final long need = (info.bracket() - 2L) * SERIES_PER_BRACKET - series(c);
            throw new IllegalStateException("Le bracket " + info.bracket() + " se débloque après " + need
                    + (need > 1 ? " séries" : " série") + " de 5 victoires de plus.");
        }
        return info;
    }

    /** Prend un préconstruit avec un choix gagné : son deck et ses cartes (les doublons deviennent des jetons). */
    static synchronized JsonObject chooseDeck(final Catalog catalog, final String preconKey) {
        final JsonObject c = load();
        if (!bool(c, "started") || num(c, "deckChoices") <= 0) {
            throw new IllegalStateException("Pas de nouveau deck à choisir : gagne 5 duels d'affilée pour en obtenir un.");
        }
        final Precons.Info info = takeable(c, preconKey);
        c.addProperty("series", series(c));
        final JsonObject dupes = addPrecon(catalog, c, info);
        c.addProperty("deckChoices", num(c, "deckChoices") - 1);
        save(c);
        final JsonObject o = summary(catalog);
        o.add("dupes", dupes);
        o.addProperty("chosen", KEY_PREFIX + uniqueDeckName(c, info.name(), true));
        return o;
    }

    /** Ajoute un préconstruit à la carrière : le deck, et ses cartes à la collection (doublons → jetons). */
    private static JsonObject addPrecon(final Catalog catalog, final JsonObject c, final Precons.Info info) {
        final Deck deck = catalog.deckFromKey(info.key());
        final JsonObject coll = collection(c);
        final JsonObject wc = wildcards(c);
        final JsonObject dupes = new JsonObject();
        for (final Map.Entry<PaperCard, Integer> e : deck.getAllCardsInASinglePool(true, false)) {
            final PaperCard pc = e.getKey();
            for (int i = 0; i < e.getValue(); i++) {
                if (!isBasic(pc) && coll.has(pc.getName())) {
                    final String r = rarityKey(pc);
                    wc.addProperty(r, wc.get(r).getAsInt() + 1);
                    dupes.addProperty(r, (dupes.has(r) ? dupes.get(r).getAsInt() : 0) + 1);
                } else {
                    add(coll, pc.getName(), 1);
                }
            }
        }
        c.add("collection", coll);
        c.add("wildcards", wc);
        deck.setName(uniqueDeckName(c, info.name(), false));
        final JsonArray decks = array(c, "decks");
        final JsonObject compact = compact(deck);
        compact.addProperty("from", info.key());
        decks.add(compact);
        c.add("decks", decks);
        final JsonArray precons = array(c, "precons");
        precons.add(info.key());
        c.add("precons", precons);
        return dupes;
    }

    private static String uniqueDeckName(final JsonObject c, final String base, final boolean existing) {
        if (existing || findDeck(c, base) == null) {
            return base;
        }
        for (int i = 2; ; i++) {
            if (findDeck(c, base + " " + i) == null) {
                return base + " " + i;
            }
        }
    }

    /** Efface la carrière (la remise à zéro se propage aux autres appareils par la synchronisation). */
    static synchronized void reset() {
        final JsonObject o = new JsonObject();
        o.addProperty("version", 1);
        o.addProperty("started", false);
        o.addProperty("at", num(load(), "at"));
        save(o);
    }

    // ------------------------------------------------------------------ collection et jetons

    private static JsonObject collection(final JsonObject c) {
        return c.has("collection") && c.get("collection").isJsonObject() ? c.getAsJsonObject("collection") : new JsonObject();
    }

    private static void add(final JsonObject coll, final String name, final int n) {
        coll.addProperty(name, (coll.has(name) ? coll.get(name).getAsInt() : 0) + n);
    }

    static boolean isBasic(final PaperCard pc) {
        return pc.getRules().getType().isBasicLand();
    }

    /** Rareté d'une impression, pour les jetons : commune, peu commune, rare (spéciales comprises) ou mythique. */
    static String rarityKey(final PaperCard pc) {
        final CardRarity r = pc.getRarity();
        if (r == CardRarity.MythicRare) {
            return "mythic";
        }
        if (r == CardRarity.Rare || r == CardRarity.Special) {
            return "rare";
        }
        if (r == CardRarity.Uncommon) {
            return "uncommon";
        }
        return "common";
    }

    private static JsonObject wildcards(final JsonObject c) {
        final JsonObject in = c.has("wildcards") && c.get("wildcards").isJsonObject() ? c.getAsJsonObject("wildcards") : new JsonObject();
        final JsonObject out = new JsonObject();
        for (final String r : RARITIES) {
            out.addProperty(r, in.has(r) ? Math.max(0, in.get(r).getAsInt()) : 0);
        }
        return out;
    }

    /** Exemplaires possédés de chaque carte (nom anglais) ; les terrains de base sont illimités. */
    static synchronized Map<String, Integer> owned() {
        final Map<String, Integer> m = new HashMap<>();
        for (final Map.Entry<String, JsonElement> e : collection(load()).entrySet()) {
            m.put(e.getKey(), e.getValue().getAsInt());
        }
        return m;
    }

    /** Cartes du deck qui manquent dans la collection (« 2 × Nom » : il en manque deux), vide si tout est possédé. */
    static List<String> missing(final Deck deck) {
        final Map<String, Integer> owned = owned();
        final Map<String, Integer> needed = new LinkedHashMap<>();
        for (final Map.Entry<PaperCard, Integer> e : deck.getAllCardsInASinglePool(true, true)) {
            if (!isBasic(e.getKey())) {
                needed.merge(e.getKey().getName(), e.getValue(), Integer::sum);
            }
        }
        final List<String> out = new ArrayList<>();
        for (final Map.Entry<String, Integer> e : needed.entrySet()) {
            final int lack = e.getValue() - owned.getOrDefault(e.getKey(), 0);
            if (lack > 0) {
                out.add((lack > 1 ? lack + " × " : "") + Catalog.translated(e.getKey()));
            }
        }
        return out;
    }

    /** Achète une carte manquante avec un jeton de sa rareté (celle de l'impression choisie). */
    static synchronized JsonObject buyCard(final Catalog catalog, final String name, final String set, final int art) {
        final JsonObject c = load();
        if (!bool(c, "started")) {
            throw new IllegalStateException("Commence d'abord ta carrière de Planeswalker.");
        }
        PaperCard pc = null;
        if (set != null && !set.isEmpty()) {
            pc = art > 0 ? FModel.getMagicDb().getCommonCards().getCard(name, set, art) : FModel.getMagicDb().getCommonCards().getCard(name, set);
        }
        if (pc == null) {
            pc = catalog.resolve(name);
        }
        if (pc == null) {
            throw new IllegalArgumentException("Carte inconnue : " + name);
        }
        if (isBasic(pc)) {
            throw new IllegalArgumentException("Les terrains de base sont illimités.");
        }
        final JsonObject coll = collection(c);
        if (coll.has(pc.getName())) {
            throw new IllegalArgumentException("Tu as déjà " + Catalog.translated(pc.getName()) + ".");
        }
        final String r = rarityKey(pc);
        final JsonObject wc = wildcards(c);
        if (wc.get(r).getAsInt() <= 0) {
            throw new IllegalStateException("Il te faut un jeton " + RARITY_FR.get(r) + " (les cartes en double en donnent).");
        }
        wc.addProperty(r, wc.get(r).getAsInt() - 1);
        add(coll, pc.getName(), 1);
        c.add("wildcards", wc);
        c.add("collection", coll);
        save(c);
        final JsonObject o = summary(catalog);
        final JsonObject card = Catalog.paperJson(pc);
        card.addProperty("owned", 1);
        o.add("card", card);
        o.addProperty("spent", r);
        return o;
    }

    static final Map<String, String> RARITY_FR = Map.of("common", "commun", "uncommon", "peu commun", "rare", "rare", "mythic", "mythique");

    // ------------------------------------------------------------------ decks

    /** Deck réduit à l'essentiel : chaque carte avec son impression (édition, illustration). */
    private static JsonObject compact(final Deck deck) {
        final JsonObject o = new JsonObject();
        o.addProperty("name", deck.getName());
        o.addProperty("format", "commander");
        o.addProperty("mtime", System.currentTimeMillis());
        final JsonObject sections = new JsonObject();
        sections.add("commander", compactSection(deck.has(DeckSection.Commander) ? deck.get(DeckSection.Commander) : null));
        sections.add("main", compactSection(deck.getMain()));
        sections.add("side", compactSection(deck.has(DeckSection.Sideboard) ? deck.get(DeckSection.Sideboard) : null));
        o.add("sections", sections);
        return o;
    }

    private static JsonArray compactSection(final forge.deck.CardPool pool) {
        final JsonArray a = new JsonArray();
        if (pool == null) {
            return a;
        }
        for (final Map.Entry<PaperCard, Integer> e : pool) {
            final JsonObject line = new JsonObject();
            line.addProperty("name", e.getKey().getName());
            line.addProperty("count", e.getValue());
            final JsonObject card = new JsonObject();
            card.addProperty("set", e.getKey().getEdition());
            card.addProperty("art", e.getKey().getArtIndex());
            line.add("card", card);
            a.add(line);
        }
        return a;
    }

    private static JsonObject findDeck(final JsonObject c, final String name) {
        for (final JsonElement e : array(c, "decks")) {
            if (name.equals(str(e.getAsJsonObject(), "name"))) {
                return e.getAsJsonObject();
            }
        }
        return null;
    }

    static synchronized Deck deck(final Catalog catalog, final String name) {
        final JsonObject d = findDeck(load(), name);
        if (d == null) {
            throw new IllegalArgumentException("Deck introuvable : " + name);
        }
        final Deck deck = catalog.deckFromJson(d, new ArrayList<>());
        deck.setName(name);
        return deck;
    }

    private static JsonArray deckList(final Catalog catalog, final JsonObject c) {
        final JsonArray out = new JsonArray();
        for (final JsonElement e : array(c, "decks")) {
            final String name = str(e.getAsJsonObject(), "name");
            try {
                final Deck d = catalog.deckFromJson(e.getAsJsonObject(), new ArrayList<>());
                final JsonObject o = new JsonObject();
                o.addProperty("key", KEY_PREFIX + name);
                o.addProperty("name", name);
                o.addProperty("format", "commander");
                o.addProperty("career", true);
                o.addProperty("count", d.getAllCardsInASinglePool(true, false).countAll());
                o.addProperty("identity", Catalog.identity(d));
                final JsonArray commanders = new JsonArray();
                if (d.has(DeckSection.Commander) && d.get(DeckSection.Commander).countAll() > 0) {
                    for (final Map.Entry<PaperCard, Integer> c2 : d.get(DeckSection.Commander)) {
                        commanders.add(Catalog.translated(c2.getKey().getName()));
                    }
                    o.addProperty("image", d.get(DeckSection.Commander).toFlatList().get(0).getImageKey(false));
                }
                o.add("commanders", commanders);
                o.addProperty("legal", forge.deck.DeckFormat.Commander.getDeckConformanceProblem(d) == null);
                out.add(o);
            } catch (final RuntimeException ex) {
                System.err.println("Deck de carrière illisible : " + name);
            }
        }
        return out;
    }

    /** Enregistre un deck de carrière : seulement avec des cartes possédées (en nombre suffisant). */
    static synchronized JsonObject saveDeck(final Catalog catalog, final JsonObject json) {
        final JsonObject c = load();
        if (!bool(c, "started")) {
            throw new IllegalStateException("Commence d'abord ta carrière de Planeswalker.");
        }
        final List<String> unknown = new ArrayList<>();
        final Deck deck = catalog.deckFromJson(json, unknown);
        if (!unknown.isEmpty()) {
            throw new IllegalArgumentException("Cartes inconnues : " + String.join(", ", unknown));
        }
        final List<String> lack = missing(deck);
        if (!lack.isEmpty()) {
            throw new IllegalArgumentException("Cartes absentes de ta collection : " + String.join(", ", lack.subList(0, Math.min(12, lack.size())))
                    + (lack.size() > 12 ? "…" : "") + ". Gagne des duels, ouvre des boosters ou utilise tes jetons pour les obtenir.");
        }
        final String previous = str(json, "previousName");
        final JsonObject before = findDeck(c, previous.isEmpty() ? deck.getName() : previous);
        final JsonArray out = new JsonArray();
        for (final JsonElement e : array(c, "decks")) {
            final String n = str(e.getAsJsonObject(), "name");
            if (!n.equals(deck.getName()) && !n.equals(previous)) {
                out.add(e);
            }
        }
        final JsonObject compact = compact(deck);
        if (before != null && before.has("from")) {
            compact.add("from", before.get("from"));
        }
        out.add(compact);
        c.add("decks", out);
        save(c);
        final JsonObject o = new JsonObject();
        o.addProperty("key", KEY_PREFIX + deck.getName());
        return o;
    }

    static synchronized void deleteDeck(final String name) {
        final JsonObject c = load();
        final JsonArray out = new JsonArray();
        for (final JsonElement e : array(c, "decks")) {
            if (!name.equals(str(e.getAsJsonObject(), "name"))) {
                out.add(e);
            }
        }
        if (out.size() == 0) {
            throw new IllegalArgumentException("Garde au moins un deck pour tes duels.");
        }
        c.add("decks", out);
        save(c);
    }

    // ------------------------------------------------------------------ adversaires

    /** Empreinte du contenu d'un deck : un deck modifié reçoit un adversaire à sa nouvelle mesure. */
    private static String signature(final Deck deck) {
        final List<String> lines = new ArrayList<>();
        for (final Map.Entry<PaperCard, Integer> e : deck.getAllCardsInASinglePool(true, false)) {
            lines.add(e.getKey().getName() + "×" + e.getValue());
        }
        Collections.sort(lines);
        return deck.getName() + "#" + Integer.toHexString(String.join("|", lines).hashCode());
    }

    /**
     * Adversaire du prochain duel avec ce deck : un préconstruit de même bracket et de puissance proche, tiré une fois
     * par deck et gardé jusqu'à la fin du duel (changer de deck puis revenir ne relance pas le tirage).
     */
    static synchronized String opponentFor(final Catalog catalog, final String deckName) {
        final JsonObject c = load();
        final Deck deck = deck(catalog, deckName);
        final String sig = signature(deck);
        final JsonObject opponents = c.has("opponents") && c.get("opponents").isJsonObject() ? c.getAsJsonObject("opponents") : new JsonObject();
        if (opponents.has(sig) && Precons.get(opponents.get(sig).getAsString()) != null) {
            return opponents.get(sig).getAsString();
        }
        final double[] m = Precons.measure(deck);
        final List<String> commanders = new ArrayList<>();
        if (deck.has(DeckSection.Commander)) {
            for (final PaperCard pc : deck.get(DeckSection.Commander).toFlatList()) {
                commanders.add(pc.getName());
            }
        }
        final JsonObject from = findDeck(c, deckName);
        final Precons.Info origin = from != null && from.has("from") ? Precons.get(str(from, "from")) : null;
        final List<Precons.Info> pool = Precons.matching((int) m[0], m[1], commanders, origin == null ? deckName : origin.name());
        final String key = pool.isEmpty() ? "random" : pool.get(RANDOM.nextInt(pool.size())).key();
        opponents.addProperty(sig, key);
        c.add("opponents", opponents);
        save(c);
        return key;
    }

    /** Le duel annoncé à l'écran : ton deck et son adversaire, avec leurs brackets et puissances. */
    static synchronized JsonObject duelInfo(final Catalog catalog, final String deckName) {
        final Deck deck = deck(catalog, deckName);
        final double[] m = Precons.measure(deck);
        final JsonObject o = new JsonObject();
        o.addProperty("bracket", (int) m[0]);
        o.addProperty("power", m[1]);
        final String key = opponentFor(catalog, deckName);
        final Precons.Info info = Precons.get(key);
        final JsonObject opp = info != null ? info.json() : new JsonObject();
        opp.addProperty("key", key);
        int unowned = 0;
        try {
            final Map<String, Integer> owned = owned();
            for (final PaperCard pc : catalog.deckFromKey(key).getAllCardsInASinglePool(true, false).toFlatList()) {
                if (!isBasic(pc) && owned.getOrDefault(pc.getName(), 0) == 0) {
                    unowned++;
                }
            }
        } catch (final RuntimeException e) {
            // deck adverse illisible : pas de décompte
        }
        opp.addProperty("unowned", unowned);
        o.add("opponent", opp);
        return o;
    }

    /** Le préconstruit que la carrière a tiré pour ce deck est-il bien celui-là ? (lancement d'un duel) */
    static synchronized boolean isOpponentFor(final Catalog catalog, final String deckName, final String key) {
        return opponentFor(catalog, deckName).equals(key);
    }

    // ------------------------------------------------------------------ duels

    /**
     * Fin d'un duel de carrière (une seule fois par partie). Victoire : mana, cartes du deck adverse pas encore
     * possédées, un booster d'une extension au hasard ; toutes les 5 victoires d'affilée, 5 boosters et un nouveau
     * préconstruit au choix. Défaite, égalité ou abandon : la série repart de zéro. Dans tous les cas, de nouveaux
     * adversaires attendent. La partie (record, comme dans les statistiques) fait aussi avancer les défis du jour et
     * de la semaine.
     */
    static synchronized JsonObject duelFinished(final String sessionId, final boolean won, final Deck opponentDeck,
            final JsonObject record) {
        final JsonObject c = load();
        if (!bool(c, "started") || sessionId.equals(str(c, "lastDuel"))) {
            return null;
        }
        c.addProperty("lastDuel", sessionId);
        c.addProperty("duels", num(c, "duels") + 1);
        final JsonObject reward = new JsonObject();
        reward.addProperty("won", won);
        if (won) {
            c.addProperty("wins", num(c, "wins") + 1);
            final long streak = num(c, "streak") + 1;
            c.addProperty("streak", streak);
            c.addProperty("bestStreak", Math.max(streak, num(c, "bestStreak")));
            c.addProperty("mana", num(c, "mana") + WIN_MANA);
            reward.addProperty("mana", WIN_MANA);
            // Cartes du deck adverse que le joueur n'a pas encore.
            final JsonObject coll = collection(c);
            final Map<String, PaperCard> candidates = new LinkedHashMap<>();
            if (opponentDeck != null) {
                for (final PaperCard pc : opponentDeck.getAllCardsInASinglePool(true, false).toFlatList()) {
                    if (!isBasic(pc) && !coll.has(pc.getName())) {
                        candidates.putIfAbsent(pc.getName(), pc);
                    }
                }
            }
            final List<PaperCard> pool = new ArrayList<>(candidates.values());
            Collections.shuffle(pool, RANDOM);
            final JsonArray cards = new JsonArray();
            for (final PaperCard pc : pool.subList(0, Math.min(CARDS_PER_WIN, pool.size()))) {
                add(coll, pc.getName(), 1);
                final JsonObject card = Catalog.paperJson(pc);
                card.addProperty("isNew", true);
                cards.add(card);
            }
            c.add("collection", coll);
            reward.add("cards", cards);
            final JsonArray boosters = array(c, "boosters");
            final JsonArray won1 = new JsonArray();
            won1.add(newBooster(boosters, randomSet()));
            reward.add("boosters", won1);
            if (streak % STREAK_BONUS_EVERY == 0) {
                final int before = maxBracket(c);
                c.addProperty("series", series(c) + 1);
                if (maxBracket(c) > before) {
                    reward.addProperty("newBracket", maxBracket(c));
                }
                final JsonArray bonus = new JsonArray();
                for (int i = 0; i < STREAK_BONUS_BOOSTERS; i++) {
                    bonus.add(newBooster(boosters, randomSet()));
                }
                reward.add("bonus", bonus);
                c.addProperty("deckChoices", num(c, "deckChoices") + 1);
                reward.addProperty("deckChoice", true);
            }
            c.add("boosters", boosters);
            reward.addProperty("streak", streak);
        } else {
            c.addProperty("losses", num(c, "losses") + 1);
            reward.addProperty("lostStreak", num(c, "streak"));
            c.addProperty("streak", 0);
            reward.addProperty("streak", 0);
        }
        if (record != null) {
            final JsonObject game = record.deepCopy();
            game.addProperty("streak", num(c, "streak"));
            final JsonArray boosters = array(c, "boosters");
            final JsonArray done = Challenges.record(c, game, n -> {
                final JsonArray got = new JsonArray();
                for (int i = 0; i < n; i++) {
                    got.add(newBooster(boosters, randomSet()));
                }
                return got;
            });
            c.add("boosters", boosters);
            if (!done.isEmpty()) {
                reward.add("challenges", done);
            }
        }
        c.add("opponents", new JsonObject());
        save(c);
        reward.addProperty("manaTotal", num(c, "mana"));
        // Noms des extensions, pour l'écran de fin.
        final List<JsonArray> named = new ArrayList<>();
        for (final String k : List.of("boosters", "bonus")) {
            if (reward.has(k)) {
                named.add(reward.getAsJsonArray(k));
            }
        }
        for (final JsonElement e : array(reward, "challenges")) {
            if (e.getAsJsonObject().has("boosters")) {
                named.add(e.getAsJsonObject().getAsJsonArray("boosters"));
            }
        }
        for (final JsonArray a : named) {
            for (final JsonElement e : a) {
                final CardEdition ed = FModel.getMagicDb().getEditions().get(str(e.getAsJsonObject(), "set"));
                e.getAsJsonObject().addProperty("name", ed == null ? str(e.getAsJsonObject(), "set") : ed.getName());
            }
        }
        return reward;
    }

    // ------------------------------------------------------------------ boosters

    private static JsonObject newBooster(final JsonArray boosters, final String set) {
        final JsonObject b = new JsonObject();
        b.addProperty("id", java.util.UUID.randomUUID().toString());
        b.addProperty("set", set);
        boosters.add(b);
        return b.deepCopy();
    }

    private static volatile List<CardEdition> boosterEditions;

    /** Extensions dont Forge connaît le contenu des boosters, de la plus récente à la plus ancienne. */
    static List<CardEdition> boosterEditions() {
        List<CardEdition> list = boosterEditions;
        if (list != null) {
            return list;
        }
        final List<CardEdition> eds = new ArrayList<>();
        final Date now = new Date();
        for (final CardEdition ed : FModel.getMagicDb().getEditions()) {
            if (ed.getType() == CardEdition.Type.CUSTOM_SET || !ed.hasBoosterTemplate() || ed.getAllCardsInSet().isEmpty()
                    || ed.getDate() != null && ed.getDate().after(now)) {
                continue;
            }
            eds.add(ed);
        }
        eds.sort(Comparator.comparing((CardEdition ed) -> ed.getDate() == null ? new Date(0) : ed.getDate()).reversed());
        list = Collections.unmodifiableList(eds);
        boosterEditions = list;
        return list;
    }

    private static String randomSet() {
        final List<CardEdition> eds = boosterEditions();
        return eds.get(RANDOM.nextInt(eds.size())).getCode();
    }

    private static volatile JsonArray boosterSetList;

    static JsonArray boosterSets() {
        JsonArray a = boosterSetList;
        if (a != null) {
            return a;
        }
        a = new JsonArray();
        for (final CardEdition ed : boosterEditions()) {
            final JsonObject o = new JsonObject();
            o.addProperty("code", ed.getCode());
            o.addProperty("name", ed.getName());
            o.addProperty("year", ed.getDate() == null ? "" : String.valueOf(1900 + ed.getDate().getYear()));
            o.addProperty("type", ed.getType().name());
            o.addProperty("covers", Math.max(1, ed.getCntBoosterPictures()));
            // Visuel du vrai booster : listé par Forge, ou peut-être déjà publié sur son dépôt (essayé à la demande).
            o.addProperty("art", true);
            o.addProperty("listed", BoosterArt.has(ed.getCode()));
            final String feature = featureImage(ed);
            if (feature != null) {
                o.addProperty("feature", feature);
            }
            a.add(o);
        }
        boosterSetList = a;
        return a;
    }

    /**
     * Carte phare d'une extension, dont l'illustration orne le booster dessiné quand le vrai visuel manque :
     * la première mythique légendaire (ou mythique, ou rare légendaire, ou rare) dans l'ordre de l'extension.
     */
    private static String featureImage(final CardEdition ed) {
        PaperCard best = null;
        int bestScore = -1;
        for (final CardEdition.EditionEntry e : ed.getAllCardsInSet()) {
            final CardRarity r = e.rarity();
            final int base = r == CardRarity.MythicRare ? 2 : r == CardRarity.Rare ? 0 : -1;
            if (base < 0) {
                continue;
            }
            final PaperCard pc = FModel.getMagicDb().getCommonCards().getCard(e.name(), ed.getCode());
            if (pc == null || pc.getRules().getType().isLand()) {
                continue;
            }
            final int score = base + (pc.getRules().getType().isLegendary() ? 1 : 0);
            if (score > bestScore) {
                best = pc;
                bestScore = score;
                if (score == 3) {
                    break;
                }
            }
        }
        return best == null ? null : best.getImageKey(false);
    }

    static synchronized JsonObject buy(final Catalog catalog, final String set) {
        final JsonObject c = load();
        if (!bool(c, "started")) {
            throw new IllegalStateException("Commence d'abord ta carrière de Planeswalker.");
        }
        if (boosterEditions().stream().noneMatch(ed -> ed.getCode().equals(set))) {
            throw new IllegalArgumentException("Pas de booster pour cette extension.");
        }
        final long mana = num(c, "mana");
        if (mana < BOOSTER_PRICE) {
            throw new IllegalStateException("Il te faut " + BOOSTER_PRICE + " mana (tu en as " + mana + "). Chaque duel gagné en rapporte " + WIN_MANA + ".");
        }
        c.addProperty("mana", mana - BOOSTER_PRICE);
        final JsonArray boosters = array(c, "boosters");
        final JsonObject b = newBooster(boosters, set);
        c.add("boosters", boosters);
        save(c);
        final JsonObject o = summary(catalog);
        o.addProperty("bought", str(b, "id"));
        return o;
    }

    private static int rarityRank(final PaperCard pc) {
        final CardRarity r = pc.getRarity();
        if (r == null) {
            return 1;
        }
        return switch (r) {
            case BasicLand -> 0;
            case Common -> 1;
            case Uncommon -> 2;
            case Rare, Special -> 3;
            case MythicRare -> 4;
            default -> 1;
        };
    }

    /**
     * Ouvre un booster : son contenu suit le modèle de l'extension dans Forge (le vrai format : communes,
     * peu communes, rare ou mythique, cartes spéciales). Au-delà de 14 cartes, le terrain de base (puis une commune)
     * reste dans le paquet. Les cartes nouvelles vont dans la collection, les doublons deviennent des jetons de leur
     * rareté ; la rare (ou mythique) est révélée en dernier.
     */
    static synchronized JsonObject open(final String id) {
        final JsonObject c = load();
        final JsonObject o = openOne(c, id);
        save(c);
        o.add("wildcards", wildcards(c));
        return o;
    }

    /**
     * Ouvre plusieurs boosters d'un coup (dans l'ordre donné, 100 au plus) : un résultat par booster, comme
     * {@link #open}, et la carrière enregistrée une seule fois. Une carte déjà sortie d'un booster précédent du lot
     * compte comme un doublon.
     */
    static synchronized JsonObject openMany(final JsonArray ids) {
        final JsonObject c = load();
        final JsonArray packs = new JsonArray();
        for (int i = 0; i < Math.min(100, ids.size()); i++) {
            packs.add(openOne(c, ids.get(i).getAsString()));
        }
        save(c);
        final JsonObject o = new JsonObject();
        o.add("packs", packs);
        o.add("wildcards", wildcards(c));
        return o;
    }

    /** Ouvre un booster de la carrière (sans l'enregistrer) : ses cartes, dans l'ordre de révélation. */
    private static JsonObject openOne(final JsonObject c, final String id) {
        final JsonArray boosters = array(c, "boosters");
        JsonObject booster = null;
        final JsonArray rest = new JsonArray();
        for (final JsonElement e : boosters) {
            if (booster == null && id.equals(str(e.getAsJsonObject(), "id"))) {
                booster = e.getAsJsonObject();
            } else {
                rest.add(e);
            }
        }
        if (booster == null) {
            throw new IllegalArgumentException("Ce booster n'existe plus (déjà ouvert ?).");
        }
        final CardEdition ed = FModel.getMagicDb().getEditions().get(str(booster, "set"));
        if (ed == null || ed.getBoosterTemplate() == null) {
            throw new IllegalStateException("Extension inconnue : " + str(booster, "set"));
        }
        final List<PaperCard> cards = new ArrayList<>(new BoosterPack(ed.getName(), ed.getBoosterTemplate()).getCards());
        while (cards.size() > PACK_SIZE) {
            int drop = -1;
            for (int i = cards.size() - 1; i >= 0 && drop < 0; i--) {
                if (isBasic(cards.get(i))) {
                    drop = i;
                }
            }
            for (int i = cards.size() - 1; i >= 0 && drop < 0; i--) {
                if (rarityRank(cards.get(i)) == 1 && !cards.get(i).isFoil()) {
                    drop = i;
                }
            }
            cards.remove(drop < 0 ? cards.size() - 1 : drop);
        }
        // Ordre de révélation : communes d'abord, la meilleure carte à la fin (comme dans un vrai paquet).
        final List<PaperCard> order = new ArrayList<>(cards);
        order.sort(Comparator.comparingInt((PaperCard pc) -> rarityRank(pc) + (pc.isFoil() ? 1 : 0)));
        final JsonObject coll = collection(c);
        final JsonObject wc = wildcards(c);
        final JsonArray out = new JsonArray();
        int mythics = 0;
        for (final PaperCard pc : order) {
            final boolean dupe = !isBasic(pc) && coll.has(pc.getName());
            final JsonObject card = Catalog.paperJson(pc);
            card.addProperty("foil", pc.isFoil());
            card.addProperty("isNew", !dupe && !isBasic(pc));
            if (dupe) {
                final String r = rarityKey(pc);
                wc.addProperty(r, wc.get(r).getAsInt() + 1);
                card.addProperty("dupe", r);
            } else {
                add(coll, pc.getName(), 1);
            }
            out.add(card);
            if (pc.getRarity() == CardRarity.MythicRare) {
                mythics++;
            }
        }
        c.add("collection", coll);
        c.add("wildcards", wc);
        c.add("boosters", rest);
        c.addProperty("opened", num(c, "opened") + 1);
        c.addProperty("mythics", num(c, "mythics") + mythics);
        final JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("set", ed.getCode());
        o.addProperty("name", ed.getName());
        o.add("cards", out);
        return o;
    }

    // ------------------------------------------------------------------ réglages avancés

    /** Ajustements de la carrière (mana, boosters, jetons, série, deck au choix, nouveaux adversaires). */
    static synchronized JsonObject adjust(final Catalog catalog, final JsonObject m) {
        final JsonObject c = load();
        if (!bool(c, "started")) {
            throw new IllegalStateException("Commence d'abord ta carrière de Planeswalker.");
        }
        final String op = str(m, "op");
        final int n = m.has("n") ? m.get("n").getAsInt() : 1;
        switch (op) {
            case "mana" -> c.addProperty("mana", Math.max(0, num(c, "mana") + n));
            case "boosters" -> {
                final JsonArray boosters = array(c, "boosters");
                final String set = str(m, "set");
                for (int i = 0; i < Math.min(100, Math.max(0, n)); i++) {
                    newBooster(boosters, set.isEmpty() ? randomSet() : set);
                }
                c.add("boosters", boosters);
            }
            case "wildcards" -> {
                final JsonObject wc = wildcards(c);
                final String r = str(m, "rarity");
                if (!RARITIES.contains(r)) {
                    throw new IllegalArgumentException("Rareté inconnue.");
                }
                wc.addProperty(r, Math.max(0, wc.get(r).getAsInt() + n));
                c.add("wildcards", wc);
            }
            case "streak" -> {
                c.addProperty("streak", Math.max(0, n));
                c.addProperty("bestStreak", Math.max(num(c, "bestStreak"), n));
            }
            case "deckChoice" -> c.addProperty("deckChoices", Math.max(0, num(c, "deckChoices") + n));
            case "series" -> c.addProperty("series", Math.max(0, series(c) + n));
            case "rerollOpponents" -> c.add("opponents", new JsonObject());
            default -> throw new IllegalArgumentException("Réglage inconnu : " + op);
        }
        save(c);
        return summary(catalog);
    }

    // ------------------------------------------------------------------ outils

    /** « Abzan Armor [TDC] [2025] » devient « Abzan Armor ». */
    static String cleanName(final String name) {
        return name == null ? "" : name.replaceAll("\\s*\\[.*$", "").trim();
    }

    private static JsonArray array(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonArray() ? o.getAsJsonArray(key) : new JsonArray();
    }

    private static long num(final JsonObject o, final String key) {
        try {
            return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsLong() : 0;
        } catch (final RuntimeException e) {
            return 0;
        }
    }

    private static boolean bool(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonPrimitive() && o.get(key).getAsBoolean();
    }

    private static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsString() : "";
    }
}
