package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.card.CardRules;
import forge.card.CardSplitType;
import forge.card.ColorSet;
import forge.card.ICardFace;
import forge.card.mana.ManaCost;
import forge.deck.CardPool;
import forge.deck.Deck;
import forge.deck.DeckFormat;
import forge.deck.DeckProxy;
import forge.deck.DeckSection;
import forge.deck.DeckgenUtil;
import forge.game.GameType;
import forge.item.PaperCard;
import forge.model.FModel;
import forge.util.CardTranslation;
import forge.util.storage.IStorage;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Base de cartes et decks : recherche en français et en anglais, decks enregistrés, import de listes.
 * Les cartes et leurs traductions viennent de Forge ; l'index de recherche est construit au premier usage.
 */
final class Catalog {

    private static final int DEFAULT_LIMIT = 60;
    private static final Pattern DECK_LINE = Pattern.compile("^(\\d+)\\s*x?\\s+(.+)$");
    private static final Pattern MOXFIELD_ID = Pattern.compile("moxfield\\.com/decks/([A-Za-z0-9_-]+)");
    private static final Map<String, String> SECTIONS = new HashMap<>();

    static {
        for (final String s : List.of("commander", "commanders", "commandant", "commandants")) {
            SECTIONS.put(s, "commander");
        }
        for (final String s : List.of("deck", "main", "mainboard", "maindeck", "main deck", "deck principal")) {
            SECTIONS.put(s, "main");
        }
        for (final String s : List.of("sideboard", "side", "réserve", "reserve", "maybeboard", "considering")) {
            SECTIONS.put(s, "side");
        }
    }

    /** Une carte de l'index de recherche, avec ses textes déjà normalisés. */
    private record Entry(PaperCard card, String nameEn, String nameFr, String searchName, String searchText,
                         String typeEn, int cmc, String identity, boolean commanderLegal, boolean canBeCommander) { }

    private volatile List<Entry> index;
    /** Nom français (et nom de chaque autre face) normalisé → nom anglais de la carte dans Forge. */
    private volatile Map<String, String> frenchToEnglish;

    // ------------------------------------------------------------------ recherche

    private List<Entry> index() {
        List<Entry> result = index;
        if (result != null) {
            return result;
        }
        synchronized (this) {
            if (index != null) {
                return index;
            }
            final Predicate<PaperCard> legal = DeckFormat.Commander.isLegalCardPredicate();
            final Predicate<PaperCard> commander = DeckFormat.Commander.isLegalCommanderPredicate();
            final List<Entry> list = new ArrayList<>();
            final Map<String, String> fr = new HashMap<>();
            for (final PaperCard pc : FModel.getMagicDb().getCommonCards().getUniqueCards()) {
                // Versions rééquilibrées d'Arena (« A-… ») : pas des cartes papier, elles doublaient l'original.
                if (pc.getName().startsWith("A-") && FModel.getMagicDb().getCommonCards().getCard(pc.getName().substring(2)) != null) {
                    continue;
                }
                final CardRules rules = pc.getRules();
                final String nameEn = rules.getName();
                final String nameFr = translated(nameEn);
                final ManaCost cost = rules.getManaCost();
                // Toutes les faces (recto et verso, deux moitiés, aventure) : on trouve une carte par chacun de ses noms.
                final StringBuilder names = new StringBuilder(normalize(nameEn)).append('\n').append(normalize(nameFr));
                final StringBuilder texts = new StringBuilder();
                final StringBuilder types = new StringBuilder();
                for (final ICardFace face : faces(rules)) {
                    final String faceFr = translated(face.getName());
                    names.append('\n').append(normalize(face.getName())).append('\n').append(normalize(faceFr));
                    texts.append(normalize(face.getOracleText())).append('\n')
                            .append(normalize(CardTranslation.getTranslatedOracle(face.getName()))).append('\n');
                    types.append(face.getType().toString().toLowerCase(Locale.ROOT)).append(" // ");
                    if (face != rules.getMainPart()) {
                        fr.putIfAbsent(normalize(face.getName()), nameEn);
                        fr.putIfAbsent(normalize(faceFr), nameEn);
                    }
                }
                list.add(new Entry(pc, nameEn, nameFr, names.toString(), texts.toString(),
                        types.length() > 0 ? types.toString() : rules.getType().toString().toLowerCase(Locale.ROOT),
                        cost == null ? 0 : cost.getCMC(),
                        GameSerializer.colors(rules.getColorIdentity()),
                        legal.test(pc), commander.test(pc)));
                if (!nameFr.equals(nameEn)) {
                    fr.put(normalize(nameFr), nameEn);
                }
            }
            list.sort(Comparator.comparing(Entry::nameFr, String.CASE_INSENSITIVE_ORDER));
            frenchToEnglish = fr;
            index = list;
            return list;
        }
    }

    JsonElement search(final JsonObject q) {
        final String text = normalize(str(q, "text"));
        final boolean inText = bool(q, "inText");
        final String colors = upper(q, "colors");
        final String colorMode = str(q, "colorMode").isEmpty() ? "any" : str(q, "colorMode");
        final List<String> types = new ArrayList<>();
        if (q.has("types")) {
            for (final JsonElement t : q.getAsJsonArray("types")) {
                types.add(t.getAsString().toLowerCase(Locale.ROOT));
            }
        }
        final int cmcMin = q.has("cmcMin") ? q.get("cmcMin").getAsInt() : -1;
        final int cmcMax = q.has("cmcMax") ? q.get("cmcMax").getAsInt() : -1;
        final boolean commanderLegal = bool(q, "commanderLegal");
        final boolean commandersOnly = bool(q, "commandersOnly");
        final int offset = q.has("offset") ? q.get("offset").getAsInt() : 0;
        final int limit = q.has("limit") ? q.get("limit").getAsInt() : DEFAULT_LIMIT;
        // Extension : les cartes imprimées dans ce set, montrées avec leur impression de ce set.
        final String setCode = str(q, "set");
        final java.util.Set<String> inSet = setCode.isEmpty() ? null : namesInSet(setCode);
        // Mode Planeswalker : seulement les cartes de la collection (et les terrains de base) ; ownedInfo : toutes les
        // cartes, avec le nombre d'exemplaires possédés (cartes manquantes, à acheter avec des jetons).
        final boolean onlyOwned = bool(q, "owned");
        final Map<String, Integer> owned = onlyOwned || bool(q, "ownedInfo") ? Career.owned() : null;

        final List<Entry> matches = new ArrayList<>();
        for (final Entry e : index()) {
            if (inSet != null && !inSet.contains(e.nameEn())) continue;
            if (onlyOwned && !owned.containsKey(e.nameEn()) && !Career.isBasic(e.card())) continue;
            if (!text.isEmpty()) {
                final boolean nameHit = e.searchName().contains(text);
                if (!nameHit && !(inText && e.searchText().contains(text))) {
                    continue;
                }
            }
            if (commanderLegal && !e.commanderLegal()) continue;
            if (commandersOnly && !e.canBeCommander()) continue;
            if (cmcMin >= 0 && e.cmc() < cmcMin) continue;
            if (cmcMax >= 0 && e.cmc() > cmcMax) continue;
            if (!types.isEmpty() && types.stream().noneMatch(t -> e.typeEn().contains(t))) continue;
            if (!colors.isEmpty() && !colorsMatch(e.identity(), colors, colorMode)) continue;
            matches.add(e);
        }
        if (!text.isEmpty()) {
            // Les noms qui commencent par le texte cherché passent devant.
            matches.sort(Comparator.comparingInt((Entry e) -> rank(e, text)));
        }
        final JsonObject result = new JsonObject();
        result.addProperty("total", matches.size());
        final JsonArray cards = new JsonArray();
        for (int i = offset; i < Math.min(matches.size(), offset + limit); i++) {
            PaperCard pc = matches.get(i).card();
            if (inSet != null) {
                final PaperCard print = FModel.getMagicDb().getCommonCards().getCard(pc.getName(), setCode);
                pc = print != null ? print : pc;
            }
            final JsonObject card = paperJson(pc);
            if (owned != null) {
                card.addProperty("owned", Career.isBasic(pc) ? -1 : owned.getOrDefault(pc.getName(), 0));
            }
            cards.add(card);
        }
        result.add("cards", cards);
        return result;
    }

    private final Map<String, java.util.Set<String>> setNames = new java.util.concurrent.ConcurrentHashMap<>();

    private java.util.Set<String> namesInSet(final String code) {
        return setNames.computeIfAbsent(code, c -> {
            final java.util.Set<String> names = new java.util.HashSet<>();
            final forge.card.CardEdition ed = FModel.getMagicDb().getEditions().get(c);
            if (ed != null) {
                for (final forge.card.CardEdition.EditionEntry entry : ed.getAllCardsInSet()) {
                    names.add(entry.name());
                }
            }
            return names;
        });
    }

    private static int rank(final Entry e, final String text) {
        final String en = normalize(e.nameEn());
        final String fr = normalize(e.nameFr());
        if (en.equals(text) || fr.equals(text)) return 0;
        if (en.startsWith(text) || fr.startsWith(text)) return 1;
        if (e.searchName().contains(text)) return 2;
        return 3;
    }

    /** any : partage une couleur ; identity : tient dans ces couleurs ; exact : exactement ces couleurs. */
    private static boolean colorsMatch(final String identity, final String wanted, final String mode) {
        final boolean wantsColorless = wanted.contains("C");
        final String colored = wanted.replace("C", "");
        switch (mode) {
            case "identity":
                for (final char c : identity.toCharArray()) {
                    if (colored.indexOf(c) < 0) return false;
                }
                return true;
            case "exact":
                if (identity.isEmpty()) return wantsColorless && colored.isEmpty();
                if (identity.length() != colored.length()) return false;
                for (final char c : colored.toCharArray()) {
                    if (identity.indexOf(c) < 0) return false;
                }
                return true;
            default:
                if (identity.isEmpty()) return wantsColorless;
                for (final char c : colored.toCharArray()) {
                    if (identity.indexOf(c) >= 0) return true;
                }
                return false;
        }
    }

    JsonElement cardInfo(final String name) {
        final PaperCard pc = resolve(name);
        if (pc == null) {
            throw new IllegalArgumentException("Carte inconnue : " + name);
        }
        final JsonObject o = paperJson(pc);
        final JsonArray prints = new JsonArray();
        for (final PaperCard p : FModel.getMagicDb().getCommonCards().getAllCards(pc.getName())) {
            final JsonObject print = new JsonObject();
            print.addProperty("set", p.getEdition());
            print.addProperty("number", p.getCollectorNumber());
            print.addProperty("image", p.getImageKey(false));
            prints.add(print);
        }
        o.add("prints", prints);
        return o;
    }

    static JsonObject paperJson(final PaperCard pc) {
        final CardRules rules = pc.getRules();
        final ICardFace main = rules.getMainPart();
        final String nameEn = rules.getName();
        final JsonObject o = new JsonObject();
        o.addProperty("name", nameEn);
        o.addProperty("nameFr", translated(nameEn));
        final ManaCost cost = rules.getManaCost();
        o.addProperty("cost", cost == null || cost.isNoCost() ? "" : cost.toString());
        o.addProperty("cmc", cost == null ? 0 : cost.getCMC());
        final String typeEn = rules.getType().toString();
        final CardSplitType split = rules.getSplitType();
        final ICardFace other = rules.getOtherPart();
        if (split == CardSplitType.Split && main != null && other != null) {
            // Carte scindée (Feu // Glace) : les deux moitiés, chacune avec son coût, son type et son texte traduits.
            final String t1 = faceType(main);
            final String t2 = faceType(other);
            o.addProperty("typeLine", t1.equals(t2) ? t1 : t1 + " // " + t2);
            o.addProperty("typeEn", typeEn);
            o.addProperty("text", halfText(main, true) + "\n\n" + halfText(other, true));
            o.addProperty("textEn", halfText(main, false) + "\n\n" + halfText(other, false));
        } else {
            o.addProperty("typeLine", main != null ? faceType(main) : typeEn);
            o.addProperty("typeEn", typeEn);
            String text = main != null ? faceText(main, split == CardSplitType.Modal, true) : rules.getOracleText();
            String textEn = main != null ? main.getOracleText() : rules.getOracleText();
            if (other != null && SECONDARY_SPELLS.contains(split)) {
                // Aventure (et cousines) : le sort imprimé dans la même carte, sous le texte principal.
                text += "\n\n" + halfText(other, true);
                textEn += "\n\n" + halfText(other, false);
            }
            o.addProperty("text", text);
            o.addProperty("textEn", textEn);
        }
        if (main != null && rules.getType().isCreature()) {
            o.addProperty("power", main.getPower());
            o.addProperty("toughness", main.getToughness());
        }
        if (main != null && rules.getType().isPlaneswalker()) {
            o.addProperty("loyalty", main.getInitialLoyalty());
        }
        if (other != null && (CardSplitType.DUAL_FACED_CARDS.contains(split) || split == CardSplitType.Flip)) {
            // Recto verso (transformables, modales, fusion) et cartes retournables : l'autre face, à part.
            o.add("back", faceJson(rules, other, split == CardSplitType.Flip ? "" : pc.getImageKey(true)));
        }
        o.addProperty("colors", GameSerializer.colors(rules.getColor()));
        o.addProperty("identity", GameSerializer.colors(rules.getColorIdentity()));
        o.addProperty("image", pc.getImageKey(false));
        o.addProperty("set", pc.getEdition());
        // Impression précise (édition, numéro d'illustration) : gardée dans le deck, choisie dans le deck builder.
        o.addProperty("art", pc.getArtIndex());
        o.addProperty("number", pc.getCollectorNumber());
        o.addProperty("exactArt", ArtChoices.isChosen(pc.getCardImageKey()));
        o.addProperty("rarity", pc.getRarity() == null ? "" : pc.getRarity().name());
        o.addProperty("land", rules.getType().isLand());
        o.addProperty("creature", rules.getType().isCreature());
        o.addProperty("canBeCommander", DeckFormat.Commander.isLegalCommanderPredicate().test(pc));
        o.addProperty("commanderLegal", DeckFormat.Commander.isLegalCardPredicate().test(pc));
        o.addProperty("basic", rules.getType().isBasicLand());
        return o;
    }

    private static volatile Map<CardRules, String> tokenScripts;

    /** Aperçu d'un jeton (liste des jetons de la triche) : nom, type, texte, force et endurance, image ; null si ce n'en est pas un. */
    static JsonObject tokenJson(final CardRules rules) {
        Map<CardRules, String> scripts = tokenScripts;
        final forge.token.TokenDb db = FModel.getMagicDb().getAllTokens();
        if (scripts == null) {
            scripts = new java.util.IdentityHashMap<>();
            for (final Map.Entry<String, CardRules> e : db.getRules().entrySet()) {
                scripts.putIfAbsent(e.getValue(), e.getKey());
            }
            tokenScripts = scripts;
        }
        if (!scripts.containsKey(rules)) {
            return null;
        }
        final ICardFace main = rules.getMainPart();
        final JsonObject o = new JsonObject();
        final String name = rules.getName().replaceAll("\\s*Token$", "");
        o.addProperty("name", name);
        o.addProperty("nameFr", translated(name));
        o.addProperty("cost", "");
        final String typeEn = rules.getType().toString();
        final String typeFr = CardTranslation.getTranslatedType(rules.getName(), typeEn);
        o.addProperty("typeLine", typeFr == null || typeFr.isEmpty() ? typeEn : typeFr);
        o.addProperty("text", rules.getOracleText());
        if (main != null && rules.getType().isCreature()) {
            o.addProperty("power", main.getPower());
            o.addProperty("toughness", main.getToughness());
        }
        o.addProperty("colors", GameSerializer.colors(rules.getColor()));
        try {
            final String script = scripts.get(rules);
            final forge.item.PaperToken token = script == null ? null : db.getToken(script);
            if (token != null) {
                o.addProperty("image", token.getImageKey(false));
            }
        } catch (final RuntimeException e) {
            // jeton sans impression connue : le cadre dessiné suffit
        }
        return o;
    }

    /** Parties d'une carte imprimées sur la carte elle-même, à lire avec le texte principal. */
    private static final java.util.EnumSet<CardSplitType> SECONDARY_SPELLS = java.util.EnumSet.of(
            CardSplitType.Adventure, CardSplitType.Omen, CardSplitType.Prepare);

    /** Les faces d'une carte qui en a plusieurs (recto et verso, deux moitiés, aventure) ; vide sinon. */
    private static List<ICardFace> faces(final CardRules rules) {
        final List<ICardFace> list = new ArrayList<>(2);
        if (rules.getOtherPart() != null && rules.getMainPart() != null) {
            list.add(rules.getMainPart());
            list.add(rules.getOtherPart());
        }
        return list;
    }

    /**
     * Traduction d'une face, null si elle manque ou est décalée dans le fichier de Forge (quelques moitiés de cartes
     * scindées ont leur texte à la place du type : « Glace|Engagez le permanent ciblé.|Piochez une carte. »).
     */
    private static String frenchType(final ICardFace face) {
        final String fr = CardTranslation.getTranslatedType(face.getName(), "");
        return fr == null || fr.isEmpty() || fr.endsWith(".") ? null : fr.replace(" : - ", " : ");
    }

    private static String faceType(final ICardFace face) {
        final String fr = frenchType(face);
        return fr == null ? face.getType().toString() : fr;
    }

    /**
     * Texte d'une face. modal : face d'une carte modale, dont la traduction de Forge reprend à la fin deux lignes de
     * l'autre face (son type et son coût, ou sa capacité de mana) ; on les retire quand le texte anglais en a deux de moins.
     */
    private static String faceText(final ICardFace face, final boolean modal, final boolean french) {
        if (!french || frenchType(face) == null) {
            return face.getOracleText();
        }
        final String fr = CardTranslation.getTranslatedOracle(face.getName());
        if (fr == null || fr.isEmpty()) {
            return face.getOracleText();
        }
        if (modal) {
            final int english = face.getOracleText().split("(\\\\n|\\r?\\n)+").length;
            final List<Integer> starts = new ArrayList<>();
            final Matcher m = Pattern.compile("(?m)^\\s*\\S").matcher(fr);
            while (m.find()) {
                starts.add(m.start());
            }
            if (starts.size() == english + 2) {
                return fr.substring(0, starts.get(english)).stripTrailing();
            }
        }
        return fr;
    }

    /** « Nom {coût} — type » puis le texte d'une moitié ou d'un sort d'aventure. */
    private static String halfText(final ICardFace face, final boolean french) {
        final ManaCost cost = face.getManaCost();
        return (french ? translated(face.getName()) : face.getName())
                + (cost == null || cost.isNoCost() ? "" : " " + cost)
                + " — " + (french ? faceType(face) : face.getType().toString())
                + "\n" + faceText(face, false, french);
    }

    /** Une face seule (le verso d'une carte recto verso), avec son image ("" : cadre dessiné). */
    private static JsonObject faceJson(final CardRules rules, final ICardFace face, final String image) {
        final JsonObject o = new JsonObject();
        o.addProperty("name", face.getName());
        o.addProperty("nameFr", translated(face.getName()));
        final ManaCost cost = face.getManaCost();
        o.addProperty("cost", cost == null || cost.isNoCost() ? "" : cost.toString());
        o.addProperty("typeLine", faceType(face));
        o.addProperty("typeEn", face.getType().toString());
        o.addProperty("text", faceText(face, rules.getSplitType() == CardSplitType.Modal, true));
        o.addProperty("textEn", face.getOracleText());
        if (face.getType().isCreature()) {
            o.addProperty("power", face.getPower());
            o.addProperty("toughness", face.getToughness());
        }
        if (face.getType().isPlaneswalker()) {
            o.addProperty("loyalty", face.getInitialLoyalty());
        }
        o.addProperty("colors", GameSerializer.colors(face.getColor()));
        o.addProperty("image", image);
        return o;
    }

    static String translated(final String name) {
        final String fr = CardTranslation.getTranslatedName(name);
        return fr == null || fr.isEmpty() ? name : fr;
    }

    /** Séparateur des deux faces dans les listes : « // » (Forge, Archidekt), « / » (Moxfield) ou « /// ». */
    private static final Pattern FACE_SEPARATOR = Pattern.compile("\\s+/{1,3}\\s+");

    /**
     * Trouve une carte par son nom anglais ou français, avec ou sans accents, ou par celui de l'une de ses faces :
     * « Emeria's Call / Emeria, Shattered Skyclave » (export Moxfield), « Agadeem's Awakening // Agadeem, the
     * Undercrypt », ou la face arrière seule (« Insectile Aberration »).
     */
    PaperCard resolve(final String rawName) {
        final String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) {
            return null;
        }
        PaperCard pc = lookup(name);
        if (pc == null) {
            final String[] faces = FACE_SEPARATOR.split(name);
            for (int i = 0; pc == null && faces.length > 1 && i < faces.length; i++) {
                pc = lookup(faces[i]);
            }
        }
        return pc;
    }

    private PaperCard lookup(final String name) {
        PaperCard pc = tryCard(name);
        if (pc == null) {
            index();
            final String english = frenchToEnglish.get(normalize(name));
            if (english != null) {
                pc = tryCard(english);
            }
        }
        if (pc == null) {
            // Dernier essai : comparaison sans casse ni accents sur les noms anglais.
            final String wanted = normalize(name);
            for (final Entry e : index()) {
                if (normalize(e.nameEn()).equals(wanted)) {
                    return e.card();
                }
            }
        }
        return pc;
    }

    private static PaperCard tryCard(final String name) {
        try {
            return FModel.getMagicDb().getCommonCards().getCard(name);
        } catch (final RuntimeException e) {
            return null;
        }
    }

    // ------------------------------------------------------------------ decks

    private static IStorage<Deck> storage(final String format) {
        return "constructed".equals(format) ? FModel.getDecks().getConstructed() : FModel.getDecks().getCommander();
    }

    JsonElement listDecks() {
        final JsonObject result = new JsonObject();
        final JsonArray mine = new JsonArray();
        for (final String format : List.of("commander", "constructed")) {
            for (final Deck d : storage(format)) {
                final JsonObject o = new JsonObject();
                o.addProperty("key", format + ":" + d.getName());
                o.addProperty("name", d.getName());
                o.addProperty("format", format);
                o.addProperty("count", d.getAllCardsInASinglePool(true, false).countAll());
                o.addProperty("identity", identity(d));
                final JsonArray commanders = new JsonArray();
                if (d.has(DeckSection.Commander)) {
                    for (final Map.Entry<PaperCard, Integer> e : d.get(DeckSection.Commander)) {
                        commanders.add(translated(e.getKey().getName()));
                    }
                    if (d.get(DeckSection.Commander).countAll() > 0) {
                        o.addProperty("image", d.get(DeckSection.Commander).toFlatList().get(0).getImageKey(false));
                    }
                }
                o.add("commanders", commanders);
                mine.add(o);
            }
        }
        result.add("decks", mine);
        result.add("precons", precons());
        return result;
    }

    private JsonArray preconCache;

    /** Préconstruits Commander, avec leur commandant (nom et image) pour reconnaître chaque deck. Calculé une fois. */
    private synchronized JsonArray precons() {
        if (preconCache != null) {
            return preconCache;
        }
        final JsonArray precons = new JsonArray();
        for (final DeckProxy proxy : DeckProxy.getAllCommanderPreconDecks()) {
            final JsonObject o = new JsonObject();
            o.addProperty("key", "precon:" + proxy.getName());
            o.addProperty("name", proxy.getName());
            o.addProperty("format", "commander");
            o.addProperty("identity", GameSerializer.colors(proxy.getColorIdentity()));
            try {
                final Deck d = proxy.getDeck();
                if (d != null && d.has(DeckSection.Commander) && d.get(DeckSection.Commander).countAll() > 0) {
                    final JsonArray commanders = new JsonArray();
                    for (final Map.Entry<PaperCard, Integer> e : d.get(DeckSection.Commander)) {
                        commanders.add(translated(e.getKey().getName()));
                    }
                    o.add("commanders", commanders);
                    o.addProperty("image", d.get(DeckSection.Commander).toFlatList().get(0).getImageKey(false));
                }
            } catch (final RuntimeException e) {
                // Deck illisible : la tuile reste sans illustration.
            }
            precons.add(o);
        }
        preconCache = precons;
        return precons;
    }

    // ------------------------------------------------------------------ decks aléatoires préparés d'avance

    /**
     * Decks Commander aléatoires générés d'avance, en fond : Forge passe toute la base de cartes au crible pour chacun
     * (une demi-seconde sur ordinateur, plusieurs sur téléphone), et une partie à quatre en demande quatre. La partie
     * démarre ainsi tout de suite ; la réserve se reconstitue un peu après, pendant que l'on joue.
     */
    private static final int RANDOM_POOL = 4;
    private final java.util.concurrent.ConcurrentLinkedQueue<Deck> randomPool = new java.util.concurrent.ConcurrentLinkedQueue<>();
    private final java.util.concurrent.atomic.AtomicBoolean refilling = new java.util.concurrent.atomic.AtomicBoolean();
    private final java.util.concurrent.ScheduledExecutorService deckMaker = java.util.concurrent.Executors.newSingleThreadScheduledExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-decks");
        t.setDaemon(true);
        t.setPriority(Thread.MIN_PRIORITY);
        return t;
    });

    /** Un deck Commander aléatoire : de la réserve s'il y en a, sinon généré tout de suite. */
    Deck randomCommander() {
        final Deck deck = randomPool.poll();
        refillRandomPool(20);
        return deck != null ? deck : DeckgenUtil.generateCommanderDeck(true, GameType.Commander);
    }

    /** Complète la réserve de decks aléatoires, dans delaySeconds secondes (0 : tout de suite). */
    void refillRandomPool(final int delaySeconds) {
        if (!refilling.compareAndSet(false, true)) {
            return;
        }
        deckMaker.schedule(() -> {
            try {
                while (randomPool.size() < RANDOM_POOL && ForgeRuntime.isReady()) {
                    randomPool.add(DeckgenUtil.generateCommanderDeck(true, GameType.Commander));
                }
            } catch (final RuntimeException e) {
                e.printStackTrace();
            } finally {
                refilling.set(false);
            }
        }, delaySeconds, java.util.concurrent.TimeUnit.SECONDS);
    }

    /** Clé « commander:Nom », « constructed:Nom », « precon:Nom » ou « random ». */
    Deck deckFromKey(final String key) {
        if ("random".equals(key)) {
            return randomCommander();
        }
        if ("randomConstructed".equals(key)) {
            return DeckgenUtil.getRandomColorDeck(true);
        }
        final int colon = key.indexOf(':');
        if (colon < 0) {
            throw new IllegalArgumentException("Deck inconnu : " + key);
        }
        final String kind = key.substring(0, colon);
        final String name = key.substring(colon + 1);
        if ("career".equals(kind)) {
            return Career.deck(this, name);
        }
        if ("precon".equals(kind)) {
            for (final DeckProxy proxy : DeckProxy.getAllCommanderPreconDecks()) {
                if (proxy.getName().equals(name)) {
                    return proxy.getDeck();
                }
            }
            throw new IllegalArgumentException("Deck préconstruit introuvable : " + name);
        }
        final Deck deck = storage(kind).get(name);
        if (deck == null) {
            throw new IllegalArgumentException("Deck introuvable : " + name);
        }
        return deck;
    }

    JsonElement loadDeck(final String key) {
        final Deck deck = deckFromKey(key);
        final String format = key.startsWith("constructed:") ? "constructed" : "commander";
        return deckJson(deck, format);
    }

    JsonElement randomCommanderDeck() {
        return deckJson(randomCommander(), "commander");
    }

    static JsonObject deckJson(final Deck deck, final String format) {
        final JsonObject o = new JsonObject();
        o.addProperty("name", deck.getName());
        o.addProperty("format", format);
        final JsonObject sections = new JsonObject();
        sections.add("commander", sectionJson(deck.has(DeckSection.Commander) ? deck.get(DeckSection.Commander) : null));
        sections.add("main", sectionJson(deck.getMain()));
        sections.add("side", sectionJson(deck.has(DeckSection.Sideboard) ? deck.get(DeckSection.Sideboard) : null));
        o.add("sections", sections);
        return o;
    }

    private static JsonArray sectionJson(final CardPool pool) {
        final JsonArray list = new JsonArray();
        if (pool == null) {
            return list;
        }
        final Map<String, Integer> counts = new LinkedHashMap<>();
        final Map<String, PaperCard> cards = new HashMap<>();
        for (final Map.Entry<PaperCard, Integer> e : pool) {
            final String name = e.getKey().getName();
            counts.merge(name, e.getValue(), Integer::sum);
            cards.putIfAbsent(name, e.getKey());
        }
        for (final Map.Entry<String, Integer> e : counts.entrySet()) {
            final JsonObject line = new JsonObject();
            line.addProperty("count", e.getValue());
            line.add("card", paperJson(cards.get(e.getKey())));
            list.add(line);
        }
        return list;
    }

    /** Construit un deck Forge depuis le JSON de l'interface. Les cartes inconnues sont signalées. */
    Deck deckFromJson(final JsonObject json, final List<String> unknown) {
        final Deck deck = new Deck(str(json, "name").isEmpty() ? "Sans nom" : str(json, "name"));
        final JsonObject sections = json.getAsJsonObject("sections");
        for (final String key : List.of("commander", "main", "side")) {
            if (sections == null || !sections.has(key)) {
                continue;
            }
            final DeckSection section = switch (key) {
                case "commander" -> DeckSection.Commander;
                case "side" -> DeckSection.Sideboard;
                default -> DeckSection.Main;
            };
            for (final JsonElement e : sections.getAsJsonArray(key)) {
                final JsonObject line = e.getAsJsonObject();
                final String name = line.has("name") ? line.get("name").getAsString()
                        : line.getAsJsonObject("card").get("name").getAsString();
                final int count = line.has("count") ? line.get("count").getAsInt() : 1;
                final PaperCard pc = printing(line, name);
                if (pc == null) {
                    unknown.add(name);
                    continue;
                }
                deck.getOrCreate(section).add(pc, count);
            }
        }
        return deck;
    }

    /** L'impression demandée par une ligne de deck (édition et illustration de sa carte), sinon celle par défaut. */
    private PaperCard printing(final JsonObject line, final String name) {
        final JsonObject card = line.has("card") && line.get("card").isJsonObject() ? line.getAsJsonObject("card") : null;
        if (card != null && card.has("set") && !card.get("set").isJsonNull()) {
            final String set = card.get("set").getAsString();
            final int art = card.has("art") ? card.get("art").getAsInt() : 0;
            final PaperCard exact = art > 0 ? FModel.getMagicDb().getCommonCards().getCard(name, set, art)
                    : FModel.getMagicDb().getCommonCards().getCard(name, set);
            if (exact != null) {
                return exact;
            }
        }
        return resolve(name);
    }

    /** Toutes les impressions d'une carte, les plus récentes d'abord, pour choisir son illustration. */
    JsonElement prints(final String rawName) {
        final PaperCard pc = resolve(rawName);
        if (pc == null) {
            throw new IllegalArgumentException("Carte inconnue : " + rawName);
        }
        final forge.card.CardEdition.Collection editions = FModel.getMagicDb().getEditions();
        final List<PaperCard> all = new ArrayList<>(FModel.getMagicDb().getCommonCards().getAllCards(pc.getName()));
        final Map<String, java.util.Date> dates = new HashMap<>();
        for (final PaperCard p : all) {
            final forge.card.CardEdition ed = editions.get(p.getEdition());
            dates.put(p.getEdition(), ed == null || ed.getDate() == null ? new java.util.Date(0) : ed.getDate());
        }
        all.sort(Comparator.comparing((PaperCard p) -> dates.get(p.getEdition())).reversed()
                .thenComparing(PaperCard::getArtIndex));
        final JsonArray list = new JsonArray();
        for (final PaperCard p : all) {
            final JsonObject o = paperJson(p);
            final forge.card.CardEdition ed = editions.get(p.getEdition());
            o.addProperty("setName", ed == null ? p.getEdition() : ed.getName());
            o.addProperty("year", ed == null || ed.getDate() == null ? "" : String.valueOf(1900 + ed.getDate().getYear()));
            list.add(o);
        }
        final JsonObject result = new JsonObject();
        result.addProperty("name", pc.getName());
        result.add("prints", list);
        return result;
    }

    private volatile JsonArray editionList;

    /** Extensions qui ont des cartes, les plus récentes d'abord (filtre de la recherche). */
    JsonElement editions() {
        JsonArray list = editionList;
        if (list != null) {
            return list;
        }
        final List<forge.card.CardEdition> eds = new ArrayList<>();
        for (final forge.card.CardEdition ed : FModel.getMagicDb().getEditions()) {
            if (ed.getType() != forge.card.CardEdition.Type.CUSTOM_SET && !ed.getAllCardsInSet().isEmpty()) {
                eds.add(ed);
            }
        }
        eds.sort(Comparator.comparing((forge.card.CardEdition ed) -> ed.getDate() == null ? new java.util.Date(0) : ed.getDate()).reversed());
        list = new JsonArray();
        for (final forge.card.CardEdition ed : eds) {
            final JsonObject o = new JsonObject();
            o.addProperty("code", ed.getCode());
            o.addProperty("name", ed.getName());
            o.addProperty("year", ed.getDate() == null ? "" : String.valueOf(1900 + ed.getDate().getYear()));
            o.addProperty("type", ed.getType().name());
            o.addProperty("count", ed.getAllCardsInSet().size());
            list.add(o);
        }
        editionList = list;
        return list;
    }

    JsonElement saveDeck(final JsonObject json) {
        final List<String> unknown = new ArrayList<>();
        final Deck deck = deckFromJson(json, unknown);
        if (!unknown.isEmpty()) {
            throw new IllegalArgumentException("Cartes inconnues : " + String.join(", ", unknown));
        }
        final String format = str(json, "format").isEmpty() ? "commander" : str(json, "format");
        final String previous = str(json, "previousName");
        final IStorage<Deck> storage = storage(format);
        if (!previous.isEmpty() && !previous.equals(deck.getName()) && storage.contains(previous)) {
            storage.delete(previous);
        }
        storage.add(deck);
        final JsonObject o = new JsonObject();
        o.addProperty("key", format + ":" + deck.getName());
        return o;
    }

    void deleteDeck(final String key) {
        final int colon = key.indexOf(':');
        if (colon < 0 || key.startsWith("precon:")) {
            throw new IllegalArgumentException("Ce deck ne peut pas être supprimé.");
        }
        storage(key.substring(0, colon)).delete(key.substring(colon + 1));
    }

    JsonElement validate(final JsonObject json) {
        final List<String> unknown = new ArrayList<>();
        final Deck deck = deckFromJson(json, unknown);
        final String format = str(json, "format").isEmpty() ? "commander" : str(json, "format");
        final JsonObject o = new JsonObject();
        final JsonArray problems = new JsonArray();
        if (!unknown.isEmpty()) {
            problems.add("Cartes inconnues : " + String.join(", ", unknown));
        }
        final DeckFormat deckFormat = "constructed".equals(format) ? DeckFormat.Constructed : DeckFormat.Commander;
        final String problem = deckFormat.getDeckConformanceProblem(deck);
        if (problem != null) {
            problems.add(problem);
        }
        if (bool(json, "career")) {
            final List<String> lack = Career.missing(deck);
            if (!lack.isEmpty()) {
                problems.add("Cartes absentes de ta collection : " + String.join(", ", lack.subList(0, Math.min(15, lack.size()))) + (lack.size() > 15 ? "…" : ""));
            }
        }
        o.add("problems", problems);
        o.addProperty("count", deck.getAllCardsInASinglePool(true, false).countAll());
        o.addProperty("identity", identity(deck));
        return o;
    }

    /** Analyse d'un deck (bracket, puissance, rôles des cartes) : le deck en cours d'édition ou un deck par sa clé. */
    JsonElement analyze(final JsonObject m) {
        final Deck deck;
        final boolean commander;
        if (m.has("deck") && m.get("deck").isJsonObject()) {
            final JsonObject json = m.getAsJsonObject("deck");
            deck = deckFromJson(json, new ArrayList<>());
            commander = !"constructed".equals(str(json, "format"));
        } else {
            final String key = str(m, "key");
            if (key.isEmpty() || key.startsWith("random")) {
                throw new IllegalArgumentException("Deck aléatoire : rien à analyser avant la partie.");
            }
            deck = deckFromKey(key);
            commander = !key.startsWith("constructed:");
        }
        return DeckAnalyzer.analyze(deck, commander);
    }

    /** Résumés déjà calculés : clé du deck → (contenu, résumé). */
    private final Map<String, Object[]> summaries = new java.util.concurrent.ConcurrentHashMap<>();

    /** Bracket et puissance de plusieurs decks (tuiles, salon). Les decks inchangés ne sont pas réanalysés. */
    JsonElement deckSummaries(final JsonArray keys) {
        final JsonObject out = new JsonObject();
        for (final JsonElement e : keys) {
            final String key = e.getAsString();
            if (key.startsWith("random")) {
                continue;
            }
            try {
                final Deck deck = deckFromKey(key);
                final List<String> lines = new ArrayList<>();
                for (final Map.Entry<PaperCard, Integer> c : deck.getAllCardsInASinglePool(true, false)) {
                    lines.add(c.getKey().getName() + "×" + c.getValue());
                }
                java.util.Collections.sort(lines);
                final String signature = String.join("|", lines);
                final Object[] hit = summaries.get(key);
                if (hit != null && hit[0].equals(signature)) {
                    out.add(key, (JsonObject) hit[1]);
                    continue;
                }
                final JsonObject a = DeckAnalyzer.analyze(deck, !key.startsWith("constructed:"));
                final JsonObject summary = new JsonObject();
                summary.add("bracket", a.getAsJsonObject("bracket").deepCopy());
                summary.getAsJsonObject("bracket").remove("reasons");
                summary.add("power", a.getAsJsonObject("power").deepCopy());
                summary.getAsJsonObject("power").remove("factors");
                summaries.put(key, new Object[]{signature, summary});
                out.add(key, summary);
            } catch (final RuntimeException ex) {
                // deck illisible ou supprimé entre-temps : pas de pastille
            }
        }
        return out;
    }

    /** Identité de couleur d'un deck : union des identités de ses cartes, commandant compris. */
    static String identity(final Deck deck) {
        int mask = 0;
        for (final Map.Entry<PaperCard, Integer> e : deck.getAllCardsInASinglePool(true, false)) {
            mask |= e.getKey().getRules().getColorIdentity().getColor();
        }
        return GameSerializer.colors(ColorSet.fromMask(mask));
    }

    // ------------------------------------------------------------------ import

    /** Lit une liste au format texte (Moxfield, Arena, Archidekt…) et renvoie un deck au format de l'interface. */
    JsonElement parseDeckText(final String text, final String name) {
        final Map<String, Map<String, Integer>> sections = new LinkedHashMap<>();
        sections.put("commander", new LinkedHashMap<>());
        sections.put("main", new LinkedHashMap<>());
        sections.put("side", new LinkedHashMap<>());
        final JsonArray unknown = new JsonArray();
        final Map<String, PaperCard> prints = new HashMap<>();
        String section = "main";
        String deckName = name;
        boolean blankAfterMain = false;
        for (final String raw : text.split("\\R")) {
            String line = raw.trim();
            if (line.isEmpty()) {
                // Export Moxfield « MTGA » : le commandant arrive seul après une ligne vide.
                blankAfterMain = !sections.get("main").isEmpty();
                continue;
            }
            if (line.startsWith("#") || line.startsWith("//")) {
                continue;
            }
            if (line.toLowerCase(Locale.ROOT).startsWith("name ")) {
                deckName = line.substring(5).trim();
                continue;
            }
            final String header = line.replaceAll("\\s*\\(\\d+\\)\\s*$", "").replaceAll(":$", "").trim().toLowerCase(Locale.ROOT);
            if (SECTIONS.containsKey(header)) {
                section = SECTIONS.get(header);
                blankAfterMain = false;
                continue;
            }
            String target = section;
            if (line.startsWith("SB:")) {
                target = "side";
                line = line.substring(3).trim();
            }
            final Matcher m = DECK_LINE.matcher(line);
            if (!m.matches()) {
                unknown.add(line);
                continue;
            }
            final boolean commanderTag = line.contains("*CMDR*");
            final String cardName = cleanName(m.group(2));
            final PaperCard base = resolve(cardName);
            if (base == null) {
                unknown.add(line);
                continue;
            }
            if (commanderTag) {
                target = "commander";
            }
            // L'impression indiquée (« (CMM) 400 ») : la bonne illustration, pas la plus récente.
            final PaperCard pc = printingOf(base, m.group(2));
            final String key = pc.getName() + PRINT_SEP + pc.getEdition() + PRINT_SEP + pc.getArtIndex();
            prints.put(key, pc);
            sections.get(target).merge(key, Integer.parseInt(m.group(1)), Integer::sum);
            if (blankAfterMain && target.equals("main")) {
                blankAfterMain = false;
            }
        }
        // Sans section Commandant, une dernière ligne seule et légendaire après un blanc est le commandant (export MTGA).
        if (sections.get("commander").isEmpty()) {
            guessCommander(text, sections, prints);
        }
        // Le deck prend le nom de son commandant (des deux, avec un partenaire).
        final List<String> commanders = new ArrayList<>();
        for (final String key : sections.get("commander").keySet()) {
            commanders.add(translated(prints.get(key).getName()));
        }
        if (!commanders.isEmpty()) {
            deckName = String.join(" & ", commanders);
        }
        final JsonObject deck = new JsonObject();
        deck.addProperty("name", deckName == null || deckName.isEmpty() ? "Deck importé" : deckName);
        deck.addProperty("format", "commander");
        final JsonObject out = new JsonObject();
        for (final Map.Entry<String, Map<String, Integer>> s : sections.entrySet()) {
            final JsonArray list = new JsonArray();
            for (final Map.Entry<String, Integer> e : s.getValue().entrySet()) {
                final JsonObject line = new JsonObject();
                line.addProperty("count", e.getValue());
                line.add("card", paperJson(prints.get(e.getKey())));
                list.add(line);
            }
            out.add(s.getKey(), list);
        }
        deck.add("sections", out);
        final JsonObject result = new JsonObject();
        result.add("deck", deck);
        result.add("unknown", unknown);
        return result;
    }

    private void guessCommander(final String text, final Map<String, Map<String, Integer>> sections, final Map<String, PaperCard> prints) {
        final String[] blocks = text.trim().split("\\R\\s*\\R");
        if (blocks.length < 2) {
            return;
        }
        final String last = blocks[blocks.length - 1].trim();
        final String[] lines = last.split("\\R");
        if (lines.length > 2) {
            return;
        }
        final List<String> names = new ArrayList<>();
        for (final String l : lines) {
            final Matcher m = DECK_LINE.matcher(l.trim());
            if (!m.matches() || !"1".equals(m.group(1))) {
                return;
            }
            final PaperCard base = resolve(cleanName(m.group(2)));
            if (base == null || !DeckFormat.Commander.isLegalCommanderPredicate().test(base)) {
                return;
            }
            final PaperCard pc = printingOf(base, m.group(2));
            final String key = pc.getName() + PRINT_SEP + pc.getEdition() + PRINT_SEP + pc.getArtIndex();
            prints.put(key, pc);
            names.add(key);
        }
        for (final String n : names) {
            final Map<String, Integer> main = sections.get("main");
            final Integer count = main.get(n);
            if (count != null) {
                if (count <= 1) main.remove(n); else main.put(n, count - 1);
            }
            sections.get("commander").put(n, 1);
        }
    }

    private static final String PRINT_SEP = "\u0001";
    /** « Sol Ring (CMM) 400 *F* » : édition (code Scryfall) et numéro de collection. */
    private static final Pattern PRINT = Pattern.compile("\\(([A-Za-z0-9]{2,6})\\)(?:\\s+([0-9A-Za-z★†\\-]+))?");
    private static volatile Map<String, String> editionCodes;

    /** Code d'édition de Forge pour un code Scryfall, Forge ou un alias (« cmm », « PLST »...). */
    private static String editionCode(final String code) {
        Map<String, String> codes = editionCodes;
        if (codes == null) {
            codes = new HashMap<>();
            final Iterable<forge.card.CardEdition> editions = FModel.getMagicDb().getEditions();
            // Par ordre de priorité : code de Forge, code Scryfall, puis anciens codes et alias.
            for (final forge.card.CardEdition ed : editions) {
                codes.put(ed.getCode().toLowerCase(Locale.ROOT), ed.getCode());
            }
            for (final forge.card.CardEdition ed : editions) {
                try {
                    codes.putIfAbsent(ed.getScryfallCode(), ed.getCode());
                } catch (final RuntimeException e) {
                    // édition sans code Scryfall
                }
            }
            for (final forge.card.CardEdition ed : editions) {
                for (final String c : new String[]{ed.getCode2(), ed.getAlias()}) {
                    if (c != null && !c.isEmpty()) {
                        codes.putIfAbsent(c.toLowerCase(Locale.ROOT), ed.getCode());
                    }
                }
            }
            editionCodes = codes;
        }
        return codes.get(code.toLowerCase(Locale.ROOT));
    }

    /** L'impression d'une carte désignée dans une ligne de liste (édition, numéro), sinon celle par défaut. */
    private static PaperCard printingOf(final PaperCard base, final String text) {
        final Matcher m = PRINT.matcher(text);
        if (!m.find()) {
            return base;
        }
        final String set = editionCode(m.group(1));
        if (set == null) {
            return base;
        }
        final forge.card.CardDb db = FModel.getMagicDb().getCommonCards();
        // CardDb rend une autre impression quand celle-ci manque : on ne garde que la bonne édition.
        PaperCard exact = m.group(2) == null ? null : db.getCard(base.getName(), set, m.group(2));
        if (exact == null || !set.equals(exact.getEdition()) || !m.group(2).equalsIgnoreCase(exact.getCollectorNumber())) {
            exact = db.getCard(base.getName(), set);
        }
        if (exact == null || !exact.getName().equals(base.getName()) || !set.equals(exact.getEdition())) {
            return base;
        }
        try {
            // Illustration voulue : les images (françaises comprises) suivront cette impression précise.
            ArtChoices.choose(exact.getImageKey(false));
        } catch (final RuntimeException e) {
            // impression sans clé d'image : la carte reste importée
        }
        return exact;
    }

    /** « Sol Ring (C21) 263 *F* » devient « Sol Ring ». */
    private static String cleanName(final String text) {
        String name = text;
        final int paren = name.indexOf(" (");
        if (paren > 0) {
            name = name.substring(0, paren);
        }
        name = name.replaceAll("\\s+\\*[^*]*\\*", "").replaceAll("\\s+\\[[^]]*]", "");
        return name.trim();
    }

    /**
     * Récupère un deck public Moxfield. Moxfield n'a pas d'API publique officielle : ce lien peut être
     * refusé à tout moment, l'import par texte reste la solution de secours.
     */
    JsonElement fetchMoxfield(final String url) {
        final Matcher m = MOXFIELD_ID.matcher(url);
        if (!m.find()) {
            throw new IllegalArgumentException("Lien Moxfield non reconnu (attendu : https://www.moxfield.com/decks/...)");
        }
        final String id = m.group(1);
        IOException last = null;
        for (final String api : List.of("https://api2.moxfield.com/v3/decks/all/", "https://api2.moxfield.com/v2/decks/all/")) {
            try {
                final JsonObject root = JsonParser.parseString(httpGet(api + id)).getAsJsonObject();
                return parseDeckText(moxfieldToText(root), root.has("name") ? root.get("name").getAsString() : "Deck Moxfield");
            } catch (final IOException e) {
                last = e;
            }
        }
        throw new IllegalStateException("Moxfield a refusé la demande (" + (last == null ? "?" : last.getMessage())
                + "). Sur Moxfield : Exporter > Copier en texte, puis colle la liste ici.");
    }

    private static String moxfieldToText(final JsonObject root) {
        final StringBuilder sb = new StringBuilder();
        final JsonObject boards = root.has("boards") ? root.getAsJsonObject("boards") : root;
        // Section Moxfield, puis titre de section du format texte.
        final String[][] sections = {
            {"commanders", "Commander"}, {"mainboard", "Deck"}, {"companions", "Sideboard"}, {"sideboard", "Sideboard"},
        };
        for (final String[] board : sections) {
            if (!boards.has(board[0]) || !boards.get(board[0]).isJsonObject()) {
                continue;
            }
            JsonObject cards = boards.getAsJsonObject(board[0]);
            if (cards.has("cards") && cards.get("cards").isJsonObject()) {
                cards = cards.getAsJsonObject("cards");
            }
            sb.append(board[1]).append('\n');
            for (final Map.Entry<String, JsonElement> e : cards.entrySet()) {
                final JsonObject entry = e.getValue().getAsJsonObject();
                final int quantity = entry.has("quantity") ? entry.get("quantity").getAsInt() : 1;
                final JsonObject card = entry.has("card") && entry.get("card").isJsonObject() ? entry.getAsJsonObject("card") : null;
                final String name = card != null ? card.get("name").getAsString() : e.getKey();
                sb.append(quantity).append(' ').append(name);
                // L'impression choisie sur Moxfield (édition Scryfall, numéro de collection).
                if (card != null && card.has("set") && card.get("set").isJsonPrimitive()) {
                    sb.append(" (").append(card.get("set").getAsString().toUpperCase(Locale.ROOT)).append(')');
                    if (card.has("cn") && card.get("cn").isJsonPrimitive()) {
                        sb.append(' ').append(card.get("cn").getAsString());
                    }
                }
                sb.append('\n');
            }
        }
        return sb.toString();
    }

    private static String httpGet(final String url) throws IOException {
        final HttpURLConnection c = Net.open(url);
        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36");
        c.setRequestProperty("Accept", "application/json");
        c.setConnectTimeout(10_000);
        c.setReadTimeout(20_000);
        final int code = c.getResponseCode();
        if (code != 200) {
            throw new IOException("HTTP " + code);
        }
        try (InputStream in = c.getInputStream()) {
            final java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            final byte[] buffer = new byte[16 * 1024];
            int n;
            while ((n = in.read(buffer)) > 0) {
                out.write(buffer, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    // ------------------------------------------------------------------ outils

    static String normalize(final String s) {
        if (s == null) {
            return "";
        }
        final String decomposed = Normalizer.normalize(s, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT).replace('’', '\'').trim();
    }

    private static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : "";
    }

    private static String upper(final JsonObject o, final String key) {
        if (o == null || !o.has(key)) {
            return "";
        }
        final JsonElement e = o.get(key);
        if (e.isJsonArray()) {
            final StringBuilder sb = new StringBuilder();
            for (final JsonElement c : e.getAsJsonArray()) {
                sb.append(c.getAsString());
            }
            return sb.toString().toUpperCase(Locale.ROOT);
        }
        return e.getAsString().toUpperCase(Locale.ROOT);
    }

    private static boolean bool(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).getAsBoolean();
    }
}
