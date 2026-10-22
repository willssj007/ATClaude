package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.card.CardRules;
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
import java.net.URL;
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
                final CardRules rules = pc.getRules();
                final String nameEn = rules.getName();
                final String nameFr = translated(nameEn);
                final String textFr = CardTranslation.getTranslatedOracle(nameEn);
                final ManaCost cost = rules.getManaCost();
                list.add(new Entry(pc, nameEn, nameFr,
                        normalize(nameEn) + "\n" + normalize(nameFr),
                        normalize(rules.getOracleText()) + "\n" + normalize(textFr == null ? "" : textFr),
                        rules.getType().toString().toLowerCase(Locale.ROOT),
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

        final List<Entry> matches = new ArrayList<>();
        for (final Entry e : index()) {
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
            cards.add(paperJson(matches.get(i).card()));
        }
        result.add("cards", cards);
        return result;
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
        final String typeFr = CardTranslation.getTranslatedType(nameEn, typeEn);
        o.addProperty("typeLine", typeFr == null || typeFr.isEmpty() ? typeEn : typeFr);
        o.addProperty("typeEn", typeEn);
        final String textFr = CardTranslation.getTranslatedOracle(nameEn);
        o.addProperty("text", textFr == null || textFr.isEmpty() ? rules.getOracleText() : textFr);
        o.addProperty("textEn", rules.getOracleText());
        if (main != null && rules.getType().isCreature()) {
            o.addProperty("power", main.getPower());
            o.addProperty("toughness", main.getToughness());
        }
        if (main != null && rules.getType().isPlaneswalker()) {
            o.addProperty("loyalty", main.getInitialLoyalty());
        }
        o.addProperty("colors", GameSerializer.colors(rules.getColor()));
        o.addProperty("identity", GameSerializer.colors(rules.getColorIdentity()));
        o.addProperty("image", pc.getImageKey(false));
        o.addProperty("set", pc.getEdition());
        o.addProperty("rarity", pc.getRarity() == null ? "" : pc.getRarity().name());
        o.addProperty("land", rules.getType().isLand());
        o.addProperty("creature", rules.getType().isCreature());
        o.addProperty("canBeCommander", DeckFormat.Commander.isLegalCommanderPredicate().test(pc));
        o.addProperty("commanderLegal", DeckFormat.Commander.isLegalCardPredicate().test(pc));
        o.addProperty("basic", rules.getType().isBasicLand());
        return o;
    }

    private static String translated(final String name) {
        final String fr = CardTranslation.getTranslatedName(name);
        return fr == null || fr.isEmpty() ? name : fr;
    }

    /** Trouve une carte par son nom anglais ou français, avec ou sans accents. */
    PaperCard resolve(final String rawName) {
        final String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) {
            return null;
        }
        PaperCard pc = tryCard(name);
        if (pc == null && name.contains(" // ")) {
            pc = tryCard(name.substring(0, name.indexOf(" // ")));
        }
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

    /** Clé « commander:Nom », « constructed:Nom », « precon:Nom » ou « random ». */
    Deck deckFromKey(final String key) {
        if ("random".equals(key)) {
            return DeckgenUtil.generateCommanderDeck(true, GameType.Commander);
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
        return deckJson(DeckgenUtil.generateCommanderDeck(true, GameType.Commander), "commander");
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
                final PaperCard pc = resolve(name);
                if (pc == null) {
                    unknown.add(name);
                    continue;
                }
                deck.getOrCreate(section).add(pc, count);
            }
        }
        return deck;
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
        o.add("problems", problems);
        o.addProperty("count", deck.getAllCardsInASinglePool(true, false).countAll());
        o.addProperty("identity", identity(deck));
        return o;
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
            final PaperCard pc = resolve(cardName);
            if (pc == null) {
                unknown.add(line);
                continue;
            }
            if (commanderTag) {
                target = "commander";
            }
            sections.get(target).merge(pc.getName(), Integer.parseInt(m.group(1)), Integer::sum);
            if (blankAfterMain && target.equals("main")) {
                blankAfterMain = false;
            }
        }
        // Sans section Commandant, une dernière ligne seule et légendaire après un blanc est le commandant (export MTGA).
        if (sections.get("commander").isEmpty()) {
            guessCommander(text, sections);
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
                line.add("card", paperJson(resolve(e.getKey())));
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

    private void guessCommander(final String text, final Map<String, Map<String, Integer>> sections) {
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
            final PaperCard pc = resolve(cleanName(m.group(2)));
            if (pc == null || !DeckFormat.Commander.isLegalCommanderPredicate().test(pc)) {
                return;
            }
            names.add(pc.getName());
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
                final String name = entry.has("card") ? entry.getAsJsonObject("card").get("name").getAsString() : e.getKey();
                sb.append(quantity).append(' ').append(name).append('\n');
            }
        }
        return sb.toString();
    }

    private static String httpGet(final String url) throws IOException {
        final HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
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
