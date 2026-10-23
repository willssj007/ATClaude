package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.card.CardEdition;
import forge.card.CardRarity;
import forge.deck.Deck;
import forge.deck.DeckProxy;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Mode Planeswalker : une carrière avec sa collection de cartes, ses decks, sa réserve de « mana » (la monnaie du jeu)
 * et ses boosters. On commence avec un préconstruit Commander tiré au hasard ; chaque duel gagné rapporte du mana,
 * quelques cartes du deck adverse (jamais une carte déjà possédée) et un booster ; 5 victoires d'affilée, 10 boosters.
 *
 * Tout est décidé ici, pas dans l'interface : récompenses, achats, contenu des boosters et cartes autorisées dans les decks.
 * Le fichier suit le compte (synchronisation) : la version la plus récente gagne.
 */
final class Career {

    static final int WIN_MANA = 100;
    static final int BOOSTER_PRICE = 1000;
    static final int CARDS_PER_WIN = 3;
    static final int STREAK_BONUS_EVERY = 5;
    static final int STREAK_BONUS_BOOSTERS = 10;
    static final int PACK_SIZE = 14;
    static final String KEY_PREFIX = "career:";

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

    /** Tout ce que l'interface affiche : mana, série, boosters, decks, prochain adversaire. */
    static synchronized JsonObject summary(final Catalog catalog) {
        final JsonObject c = load();
        final JsonObject o = new JsonObject();
        o.addProperty("started", bool(c, "started"));
        for (final String k : List.of("mana", "wins", "losses", "streak", "bestStreak", "opened", "mythics", "duels")) {
            o.addProperty(k, num(c, k));
        }
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
        final JsonArray boosters = new JsonArray();
        for (final JsonElement e : array(c, "boosters")) {
            final JsonObject b = e.getAsJsonObject().deepCopy();
            final CardEdition ed = FModel.getMagicDb().getEditions().get(str(b, "set"));
            b.addProperty("name", ed == null ? str(b, "set") : ed.getName());
            boosters.add(b);
        }
        o.add("boosters", boosters);
        o.add("decks", deckList(catalog, c));
        if (bool(c, "started")) {
            o.add("opponent", opponentInfo(catalog, opponent(c)));
        }
        if (c.has("starter")) {
            o.addProperty("starter", str(c, "starter"));
        }
        return o;
    }

    /** Début de carrière : un préconstruit Commander au hasard, ses cartes forment la collection. */
    static synchronized JsonObject start(final Catalog catalog) {
        final JsonObject c = load();
        if (bool(c, "started")) {
            return summary(catalog);
        }
        final List<DeckProxy> precons = new ArrayList<>();
        DeckProxy.getAllCommanderPreconDecks().forEach(precons::add);
        Collections.shuffle(precons, RANDOM);
        Deck deck = null;
        String preconName = "";
        for (final DeckProxy p : precons) {
            try {
                final Deck d = p.getDeck();
                if (d != null && d.has(DeckSection.Commander) && d.get(DeckSection.Commander).countAll() > 0
                        && forge.deck.DeckFormat.Commander.getDeckConformanceProblem(d) == null) {
                    deck = d;
                    preconName = p.getName();
                    break;
                }
            } catch (final RuntimeException e) {
                // deck illisible : on en prend un autre
            }
        }
        if (deck == null) {
            throw new IllegalStateException("Aucun deck préconstruit disponible pour commencer.");
        }
        final JsonObject fresh = new JsonObject();
        fresh.addProperty("version", 1);
        fresh.addProperty("started", true);
        fresh.addProperty("startedAt", System.currentTimeMillis());
        fresh.addProperty("at", num(c, "at"));
        for (final String k : List.of("mana", "wins", "losses", "streak", "bestStreak", "opened", "mythics", "duels")) {
            fresh.addProperty(k, 0);
        }
        final JsonObject coll = new JsonObject();
        for (final Map.Entry<PaperCard, Integer> e : deck.getAllCardsInASinglePool(true, false)) {
            add(coll, e.getKey().getName(), e.getValue());
        }
        fresh.add("collection", coll);
        fresh.add("boosters", new JsonArray());
        final String name = cleanName(preconName);
        deck.setName(name);
        final JsonArray decks = new JsonArray();
        decks.add(compact(deck));
        fresh.add("decks", decks);
        fresh.addProperty("starter", name);
        fresh.addProperty("opponent", randomOpponent("precon:" + preconName));
        save(fresh);
        return summary(catalog);
    }

    /** Efface la carrière (la remise à zéro se propage aux autres appareils par la synchronisation). */
    static synchronized void reset() {
        final JsonObject o = new JsonObject();
        o.addProperty("version", 1);
        o.addProperty("started", false);
        o.addProperty("at", num(load(), "at"));
        save(o);
    }

    // ------------------------------------------------------------------ collection

    private static JsonObject collection(final JsonObject c) {
        return c.has("collection") && c.get("collection").isJsonObject() ? c.getAsJsonObject("collection") : new JsonObject();
    }

    private static void add(final JsonObject coll, final String name, final int n) {
        coll.addProperty(name, (coll.has(name) ? coll.get(name).getAsInt() : 0) + n);
    }

    static boolean isBasic(final PaperCard pc) {
        return pc.getRules().getType().isBasicLand();
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
                    + (lack.size() > 12 ? "…" : "") + ". Gagne des duels ou ouvre des boosters pour les obtenir.");
        }
        final String previous = str(json, "previousName");
        final JsonArray decks = array(c, "decks");
        final JsonArray out = new JsonArray();
        for (final JsonElement e : decks) {
            final String n = str(e.getAsJsonObject(), "name");
            if (!n.equals(deck.getName()) && !n.equals(previous)) {
                out.add(e);
            }
        }
        out.add(compact(deck));
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

    // ------------------------------------------------------------------ duels

    private static String opponent(final JsonObject c) {
        final String o = str(c, "opponent");
        return o.isEmpty() ? randomOpponent("") : o;
    }

    static synchronized String opponentKey() {
        return opponent(load());
    }

    private static String randomOpponent(final String avoid) {
        final List<DeckProxy> precons = new ArrayList<>();
        DeckProxy.getAllCommanderPreconDecks().forEach(precons::add);
        Collections.shuffle(precons, RANDOM);
        for (final DeckProxy p : precons) {
            final String key = "precon:" + p.getName();
            if (!key.equals(avoid)) {
                return key;
            }
        }
        return "random";
    }

    private static JsonObject opponentInfo(final Catalog catalog, final String key) {
        final JsonObject o = new JsonObject();
        o.addProperty("key", key);
        try {
            final Deck d = catalog.deckFromKey(key);
            o.addProperty("name", cleanName(d.getName()));
            final JsonArray commanders = new JsonArray();
            if (d.has(DeckSection.Commander) && d.get(DeckSection.Commander).countAll() > 0) {
                for (final Map.Entry<PaperCard, Integer> e : d.get(DeckSection.Commander)) {
                    commanders.add(Catalog.translated(e.getKey().getName()));
                }
                o.addProperty("image", d.get(DeckSection.Commander).toFlatList().get(0).getImageKey(false));
            }
            o.add("commanders", commanders);
            o.addProperty("identity", Catalog.identity(d));
            int unowned = 0;
            final Map<String, Integer> owned = owned();
            for (final PaperCard pc : d.getAllCardsInASinglePool(true, false).toFlatList()) {
                if (!isBasic(pc) && owned.getOrDefault(pc.getName(), 0) == 0) {
                    unowned++;
                }
            }
            o.addProperty("unowned", unowned);
        } catch (final RuntimeException e) {
            o.addProperty("name", key);
        }
        return o;
    }

    /**
     * Fin d'un duel de carrière (une seule fois par partie). Victoire : mana, cartes du deck adverse pas encore
     * possédées, un booster d'une extension au hasard, et 10 boosters toutes les 5 victoires d'affilée.
     * Défaite, égalité ou abandon : la série repart de zéro. Dans tous les cas, un nouvel adversaire attend.
     */
    static synchronized JsonObject duelFinished(final String sessionId, final boolean won, final Deck opponentDeck) {
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
                final JsonArray bonus = new JsonArray();
                for (int i = 0; i < STREAK_BONUS_BOOSTERS; i++) {
                    bonus.add(newBooster(boosters, randomSet()));
                }
                reward.add("bonus", bonus);
            }
            c.add("boosters", boosters);
            reward.addProperty("streak", streak);
        } else {
            c.addProperty("losses", num(c, "losses") + 1);
            reward.addProperty("lostStreak", num(c, "streak"));
            c.addProperty("streak", 0);
            reward.addProperty("streak", 0);
        }
        c.addProperty("opponent", randomOpponent(str(c, "opponent")));
        save(c);
        reward.addProperty("manaTotal", num(c, "mana"));
        // Noms des extensions, pour l'écran de fin.
        for (final String k : List.of("boosters", "bonus")) {
            if (reward.has(k)) {
                for (final JsonElement e : reward.getAsJsonArray(k)) {
                    final CardEdition ed = FModel.getMagicDb().getEditions().get(str(e.getAsJsonObject(), "set"));
                    e.getAsJsonObject().addProperty("name", ed == null ? str(e.getAsJsonObject(), "set") : ed.getName());
                }
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

    static JsonArray boosterSets() {
        final JsonArray a = new JsonArray();
        for (final CardEdition ed : boosterEditions()) {
            final JsonObject o = new JsonObject();
            o.addProperty("code", ed.getCode());
            o.addProperty("name", ed.getName());
            o.addProperty("year", ed.getDate() == null ? "" : String.valueOf(1900 + ed.getDate().getYear()));
            o.addProperty("type", ed.getType().name());
            o.addProperty("covers", Math.max(1, ed.getCntBoosterPictures()));
            o.addProperty("art", BoosterArt.has(ed.getCode()));
            a.add(o);
        }
        return a;
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
     * reste dans le paquet. Les cartes vont dans la collection ; la rare (ou mythique) est révélée en dernier.
     */
    static synchronized JsonObject open(final String id) {
        final JsonObject c = load();
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
        final JsonArray out = new JsonArray();
        int mythics = 0;
        final Set<String> seen = new java.util.HashSet<>();
        for (final PaperCard pc : order) {
            final boolean isNew = !coll.has(pc.getName()) && !isBasic(pc) && seen.add(pc.getName());
            add(coll, pc.getName(), 1);
            final JsonObject card = Catalog.paperJson(pc);
            card.addProperty("foil", pc.isFoil());
            card.addProperty("isNew", isNew);
            out.add(card);
            if (pc.getRarity() == CardRarity.MythicRare) {
                mythics++;
            }
        }
        c.add("collection", coll);
        c.add("boosters", rest);
        c.addProperty("opened", num(c, "opened") + 1);
        c.addProperty("mythics", num(c, "mythics") + mythics);
        save(c);
        final JsonObject o = new JsonObject();
        o.addProperty("set", ed.getCode());
        o.addProperty("name", ed.getName());
        o.add("cards", out);
        return o;
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
