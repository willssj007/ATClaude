package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.card.CardEdition;
import forge.card.CardRarity;
import forge.deck.Deck;
import forge.gamemodes.limited.CardRanker;
import forge.gamemodes.limited.SealedDeckBuilder;
import forge.item.BoosterPack;
import forge.item.PaperCard;
import forge.model.FModel;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Formats limités de la Sandbox, contre l'IA : scellé (six boosters, un deck de 40 cartes) et draft (huit joueurs dont
 * sept IA, trois boosters chacun, on prend une carte et on passe le reste). Les boosters viennent d'une extension de
 * Magic, ou d'une extension perso de l'Atelier (10 communes, 3 peu communes, une rare ou mythique). L'adversaire joue un
 * deck construit par Forge avec son propre paquet de cartes (ses six boosters, ou ce qu'il a drafté).
 */
final class Limited {

    private static final Random RANDOM = new Random();
    private static final int SEATS = 8;
    private static final int PACKS = 3;
    static final String CUSTOM = "custom:";

    /** La partie limitée en cours de préparation (une seule à la fois) : extension, cartes, draft. */
    private static String set = "";
    private static List<PaperCard> myPool = new ArrayList<>();
    private static Deck aiDeck;
    private static Draft draft;

    private Limited() { }

    // ------------------------------------------------------------------ boosters

    /** Un booster de l'extension : officielle (code), ou perso (« custom:identifiant »). */
    static List<PaperCard> pack(final String code) {
        if (code.startsWith(CUSTOM)) {
            return customPack(code.substring(CUSTOM.length()));
        }
        final CardEdition ed = FModel.getMagicDb().getEditions().get(code);
        if (ed == null || ed.getBoosterTemplate() == null) {
            throw new IllegalArgumentException("Pas de booster pour cette extension : " + code);
        }
        final List<PaperCard> cards = new ArrayList<>(new BoosterPack(ed.getName(), ed.getBoosterTemplate()).getCards());
        // Les jetons et cartes publicitaires de certains boosters ne servent à rien ici.
        cards.removeIf(pc -> pc.getRules() == null || pc.getRules().getType().isBasicLand() && cards.size() > 14);
        return cards;
    }

    /** Les cartes perso d'une extension de l'Atelier, rangées par rareté (sans les jetons). */
    private static Map<String, List<PaperCard>> customCards(final String id) {
        final Map<String, List<PaperCard>> byRarity = new HashMap<>();
        for (final String name : CustomCards.names()) {
            if (CustomCards.isToken(name) || !id.equals(CustomCards.setOf(name))) {
                continue;
            }
            final PaperCard pc = FModel.getMagicDb().getCommonCards().getCard(name);
            if (pc == null) {
                continue;
            }
            final String r = CustomCards.rarityOf(name);
            byRarity.computeIfAbsent(r.isEmpty() ? "C" : r.equals("S") ? "R" : r, k -> new ArrayList<>()).add(pc);
        }
        return byRarity;
    }

    /** Un booster d'une extension perso : 10 communes, 3 peu communes, une rare (une fois sur huit, une mythique). */
    static List<PaperCard> customPack(final String id) {
        final Map<String, List<PaperCard>> cards = customCards(id);
        final List<PaperCard> all = new ArrayList<>();
        cards.values().forEach(all::addAll);
        if (all.isEmpty()) {
            throw new IllegalArgumentException("Cette extension perso n'a pas encore de cartes.");
        }
        final List<PaperCard> pack = new ArrayList<>();
        final String top = RANDOM.nextInt(8) == 0 && cards.containsKey("M") ? "M" : cards.containsKey("R") ? "R" : "M";
        pick(pack, cards.get(top), all, 1);
        pick(pack, cards.get("U"), all, 3);
        pick(pack, cards.get("C"), all, 10);
        return pack;
    }

    private static void pick(final List<PaperCard> pack, final List<PaperCard> from, final List<PaperCard> all, final int n) {
        final List<PaperCard> src = from == null || from.isEmpty() ? all : from;
        for (int i = 0; i < n; i++) {
            pack.add(src.get(RANDOM.nextInt(src.size())));
        }
    }

    /** Les extensions perso qui ont des cartes (pour leurs boosters). */
    static JsonArray customSets() {
        final JsonArray out = new JsonArray();
        for (final JsonElement e : CustomCards.state().getAsJsonArray("sets")) {
            final JsonObject s = e.getAsJsonObject();
            final String id = s.has("id") ? s.get("id").getAsString() : "";
            int n = 0;
            for (final List<PaperCard> l : customCards(id).values()) {
                n += l.size();
            }
            if (n > 0) {
                final JsonObject o = new JsonObject();
                o.addProperty("code", CUSTOM + id);
                o.addProperty("name", s.has("name") ? s.get("name").getAsString() : id);
                o.addProperty("count", n);
                out.add(o);
            }
        }
        return out;
    }

    private static JsonArray cardsJson(final List<PaperCard> cards) {
        final JsonArray a = new JsonArray();
        for (final PaperCard pc : cards) {
            a.add(Catalog.paperJson(pc));
        }
        return a;
    }

    /** Ordre de révélation d'un booster : communes d'abord, la meilleure carte à la fin. */
    private static List<PaperCard> revealOrder(final List<PaperCard> pack) {
        final List<PaperCard> order = new ArrayList<>(pack);
        order.sort(Comparator.comparingInt(Limited::rarityRank));
        return order;
    }

    private static int rarityRank(final PaperCard pc) {
        final CardRarity r = pc.getRarity();
        if (r == null) {
            return 1;
        }
        return switch (r) {
            case BasicLand -> 0;
            case Uncommon -> 2;
            case Rare, Special -> 3;
            case MythicRare -> 4;
            default -> 1;
        };
    }

    // ------------------------------------------------------------------ scellé

    /** Scellé : mes six boosters (ouverts), et ceux de l'adversaire, dont Forge fait son deck. */
    static synchronized JsonObject sealed(final String code) {
        set = code;
        draft = null;
        myPool = new ArrayList<>();
        final JsonArray packs = new JsonArray();
        for (int i = 0; i < 6; i++) {
            final List<PaperCard> p = revealOrder(pack(code));
            myPool.addAll(p);
            packs.add(cardsJson(p));
        }
        final List<PaperCard> theirs = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            theirs.addAll(pack(code));
        }
        aiDeck = aiDeck(theirs);
        final JsonObject o = new JsonObject();
        o.add("packs", packs);
        o.add("pool", cardsJson(myPool));
        return o;
    }

    private static Deck aiDeck(final List<PaperCard> pool) {
        try {
            final Deck d = new SealedDeckBuilder(pool).buildDeck();
            if (d != null && d.getMain().countAll() >= 30) {
                d.setName("Deck de l'IA");
                return d;
            }
        } catch (final RuntimeException e) {
            System.err.println("Deck limité de l'IA : " + e);
        }
        // Repli : les 23 meilleures cartes et 17 terrains de base de leurs couleurs.
        final Deck d = new Deck("Deck de l'IA");
        final List<PaperCard> best = CardRanker.rankCardsInDeck(pool);
        int spells = 0;
        for (final PaperCard pc : best) {
            if (spells < 23 && !pc.getRules().getType().isLand()) {
                d.getMain().add(pc);
                spells++;
            }
        }
        addBasics(d, colorCounts(d.getMain().toFlatList()), 17);
        return d;
    }

    // ------------------------------------------------------------------ draft

    private static final class Draft {
        final List<List<List<PaperCard>>> packs = new ArrayList<>();
        final List<List<PaperCard>> pools = new ArrayList<>();
        final List<List<PaperCard>> hands = new ArrayList<>();
        int round;
        int pick;
    }

    /** Draft : huit joueurs, trois boosters chacun. Renvoie l'état (mon booster en main, mes cartes). */
    static synchronized JsonObject draftStart(final String code) {
        set = code;
        final Draft d = new Draft();
        for (int seat = 0; seat < SEATS; seat++) {
            final List<List<PaperCard>> mine = new ArrayList<>();
            for (int r = 0; r < PACKS; r++) {
                mine.add(new ArrayList<>(pack(code)));
            }
            d.packs.add(mine);
            d.pools.add(new ArrayList<>());
            d.hands.add(mine.get(0));
        }
        draft = d;
        return draftState();
    }

    static synchronized JsonObject draftState() {
        final Draft d = draft;
        if (d == null) {
            throw new IllegalStateException("Aucun draft en cours.");
        }
        final JsonObject o = new JsonObject();
        o.addProperty("round", d.round + 1);
        o.addProperty("pick", d.pick + 1);
        o.addProperty("done", d.round >= PACKS);
        o.add("pack", d.round >= PACKS ? new JsonArray() : cardsJson(revealOrder(d.hands.get(0))));
        o.add("pool", cardsJson(d.pools.get(0)));
        // Sens de passage : à gauche aux boosters 1 et 3, à droite au 2.
        o.addProperty("left", d.round % 2 == 0);
        return o;
    }

    /** Je prends cette carte (son nom) ; les IA prennent la leur ; les boosters passent au voisin. */
    static synchronized JsonObject draftPick(final String name) {
        final Draft d = draft;
        if (d == null || d.round >= PACKS) {
            throw new IllegalStateException("Aucun draft en cours.");
        }
        final List<PaperCard> hand = d.hands.get(0);
        PaperCard chosen = null;
        for (final PaperCard pc : hand) {
            if (pc.getName().equals(name)) {
                chosen = pc;
                break;
            }
        }
        if (chosen == null) {
            throw new IllegalArgumentException("Cette carte n'est pas dans le booster.");
        }
        hand.remove(chosen);
        d.pools.get(0).add(chosen);
        for (int seat = 1; seat < SEATS; seat++) {
            final List<PaperCard> h = d.hands.get(seat);
            if (!h.isEmpty()) {
                final PaperCard best = aiPick(h, d.pools.get(seat));
                h.remove(best);
                d.pools.get(seat).add(best);
            }
        }
        d.pick++;
        if (d.hands.get(0).isEmpty()) {
            d.round++;
            d.pick = 0;
            if (d.round >= PACKS) {
                myPool = new ArrayList<>(d.pools.get(0));
                // L'adversaire : un des drafteurs IA, au hasard.
                aiDeck = aiDeck(d.pools.get(1 + RANDOM.nextInt(SEATS - 1)));
            } else {
                for (int seat = 0; seat < SEATS; seat++) {
                    d.hands.set(seat, d.packs.get(seat).get(d.round));
                }
            }
        } else {
            // Passer : à gauche (le joueur suivant reçoit mon booster) ou à droite.
            final List<List<PaperCard>> next = new ArrayList<>(d.hands);
            final boolean left = d.round % 2 == 0;
            for (int seat = 0; seat < SEATS; seat++) {
                final int to = left ? (seat + 1) % SEATS : (seat + SEATS - 1) % SEATS;
                next.set(to, d.hands.get(seat));
            }
            d.hands.clear();
            d.hands.addAll(next);
        }
        return draftState();
    }

    /** Choix d'une IA : la carte la mieux classée par Forge, en tenant compte de ce qu'elle a déjà pris. */
    private static PaperCard aiPick(final List<PaperCard> hand, final List<PaperCard> pool) {
        try {
            final List<PaperCard> ranked = CardRanker.rankCardsInPack(hand, pool, colorsOf(pool), pool.size() < 8);
            if (!ranked.isEmpty()) {
                return ranked.get(0);
            }
        } catch (final RuntimeException e) {
            // classement indisponible pour cette extension : la plus rare
        }
        return hand.stream().max(Comparator.comparingInt(Limited::rarityRank)).orElse(hand.get(0));
    }

    private static forge.card.ColorSet colorsOf(final List<PaperCard> pool) {
        final Map<Character, Integer> counts = colorCounts(pool);
        final List<Map.Entry<Character, Integer>> top = new ArrayList<>(counts.entrySet());
        top.sort((a, b) -> b.getValue() - a.getValue());
        final StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(2, top.size()); i++) {
            sb.append(top.get(i).getKey());
        }
        return forge.card.ColorSet.fromNames(sb.length() == 0 ? "WUBRG".toCharArray() : sb.toString().toCharArray());
    }

    // ------------------------------------------------------------------ deck et partie

    private static Map<Character, Integer> colorCounts(final List<PaperCard> cards) {
        final Map<Character, Integer> counts = new HashMap<>();
        for (final PaperCard pc : cards) {
            final String cost = pc.getRules().getManaCost() == null ? "" : pc.getRules().getManaCost().toString();
            for (final char c : "WUBRG".toCharArray()) {
                if (cost.indexOf(c) >= 0) {
                    counts.merge(c, 1, Integer::sum);
                }
            }
        }
        return counts;
    }

    private static final Map<Character, String> BASIC = Map.of('W', "Plains", 'U', "Island", 'B', "Swamp", 'R', "Mountain", 'G', "Forest");

    /** n terrains de base répartis selon les couleurs des sorts (au moins un par couleur jouée). */
    private static void addBasics(final Deck d, final Map<Character, Integer> counts, final int n) {
        final int total = counts.values().stream().mapToInt(Integer::intValue).sum();
        if (total == 0) {
            d.getMain().add(FModel.getMagicDb().getCommonCards().getCard("Wastes"), n);
            return;
        }
        int left = n;
        final List<Map.Entry<Character, Integer>> list = new ArrayList<>(counts.entrySet());
        list.sort((a, b) -> b.getValue() - a.getValue());
        for (int i = 0; i < list.size(); i++) {
            final int k = i == list.size() - 1 ? left : Math.max(1, Math.round((float) n * list.get(i).getValue() / total));
            final int put = Math.min(left, k);
            if (put > 0) {
                d.getMain().add(FModel.getMagicDb().getCommonCards().getCard(BASIC.get(list.get(i).getKey())), put);
            }
            left -= put;
        }
    }

    /** Le deck proposé par Forge avec mes cartes (bouton « Deck automatique »). */
    static synchronized JsonObject autoDeck() {
        if (myPool.isEmpty()) {
            throw new IllegalStateException("Aucune carte : ouvre d'abord tes boosters.");
        }
        final Deck d = new SealedDeckBuilder(new ArrayList<>(myPool)).buildDeck();
        final JsonObject o = new JsonObject();
        final JsonArray names = new JsonArray();
        final JsonObject lands = new JsonObject();
        for (final Map.Entry<PaperCard, Integer> e : d.getMain()) {
            final PaperCard pc = e.getKey();
            if (pc.getRules().getType().isBasicLand()) {
                lands.addProperty(pc.getName(), lands.has(pc.getName()) ? lands.get(pc.getName()).getAsInt() + e.getValue() : e.getValue());
            } else {
                for (int i = 0; i < e.getValue(); i++) {
                    names.add(pc.getName());
                }
            }
        }
        o.add("cards", names);
        o.add("lands", lands);
        return o;
    }

    /**
     * Le salon de la partie : mon deck (les cartes choisies parmi les miennes, plus les terrains de base demandés) contre
     * le deck de l'IA. Au moins 40 cartes.
     */
    static synchronized JsonObject setup(final JsonArray cards, final JsonObject lands, final String playerName) {
        if (myPool.isEmpty() || aiDeck == null) {
            throw new IllegalStateException("Aucune partie limitée en préparation.");
        }
        final Deck mine = new Deck("Mon deck limité");
        final List<PaperCard> left = new ArrayList<>(myPool);
        for (final JsonElement e : cards) {
            PaperCard found = null;
            for (final PaperCard pc : left) {
                if (pc.getName().equals(e.getAsString())) {
                    found = pc;
                    break;
                }
            }
            if (found == null) {
                throw new IllegalArgumentException("« " + e.getAsString() + " » n'est pas (ou plus) dans tes cartes.");
            }
            left.remove(found);
            mine.getMain().add(found);
        }
        for (final Map.Entry<String, JsonElement> e : lands.entrySet()) {
            final int n = Math.max(0, Math.min(40, e.getValue().getAsInt()));
            final PaperCard basic = FModel.getMagicDb().getCommonCards().getCard(e.getKey());
            if (n > 0 && basic != null && basic.getRules().getType().isBasicLand()) {
                mine.getMain().add(basic, n);
            }
        }
        if (mine.getMain().countAll() < 40) {
            throw new IllegalArgumentException("Un deck limité a au moins 40 cartes (il en a " + mine.getMain().countAll() + ").");
        }
        final JsonObject setup = new JsonObject();
        setup.addProperty("format", "constructed");
        setup.addProperty("limited", set);
        final JsonArray players = new JsonArray();
        final JsonObject me = new JsonObject();
        me.addProperty("name", playerName == null || playerName.isEmpty() ? "Moi" : playerName);
        me.addProperty("ai", false);
        me.add("deck", Catalog.deckJson(mine, "constructed"));
        players.add(me);
        final JsonObject ai = new JsonObject();
        ai.addProperty("name", "IA 1");
        ai.addProperty("ai", true);
        ai.add("deck", Catalog.deckJson(aiDeck, "constructed"));
        players.add(ai);
        setup.add("players", players);
        return setup;
    }

    static synchronized JsonObject pool() {
        final JsonObject o = new JsonObject();
        o.addProperty("set", set);
        o.add("pool", cardsJson(myPool));
        return o;
    }
}
