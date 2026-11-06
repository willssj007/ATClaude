package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.card.CardDb;
import forge.card.CardRarity;
import forge.card.CardRules;
import forge.card.CardType;
import forge.game.card.Card;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;
import forge.model.FModel;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Cartes perso (Atelier). Ce sont des scripts de Forge, rangés là où Forge les lit au démarrage
 * ({@code <données>/custom/cards}, édition « USER »), avec leur illustration à part ({@code custom/art}) et les types de
 * créature inventés pour elles ({@code custom/types.txt}).
 *
 * <p>Forge ne reconnaît que les types de créature de sa liste : « chaque X-Men que vous contrôlez » ne trouverait
 * aucune créature si « X-Men » n'y était pas. Les types perso y sont donc ajoutés après le chargement de Forge. Une
 * carte créée ou modifiée pendant que l'application tourne entre tout de suite dans la base de cartes ; une carte
 * supprimée disparaît des recherches tout de suite, et de la base au prochain lancement.</p>
 */
final class CustomCards {

    /** Préfixe des illustrations servies par le pont (comme « back: » pour les dos de cartes). */
    static final String ART_PREFIX = "custom:";
    /** Préfixe des cadres importés (image PNG transparente posée sur l'illustration). */
    static final String FRAME_PREFIX = "customframe:";
    /** Préfixe des logos d'extension perso (« customset:id:date », la date change l'adresse quand le logo change). */
    static final String SET_PREFIX = "customset:";

    private static final Pattern TYPE_NAME = Pattern.compile("[\\p{L}][\\p{L}\\p{N}'’-]{0,29}");

    /** Nom de la carte (celui du script) → son fichier. */
    private static final Map<String, File> FILES = new ConcurrentHashMap<>();
    /** Supprimées pendant cette session : Forge les garde jusqu'au prochain lancement, les recherches non. */
    private static final Set<String> DELETED = java.util.Collections.newSetFromMap(new ConcurrentHashMap<>());
    /** Noms des jetons perso (fichiers du dossier des jetons, dans la base des jetons de Forge et pas dans celle des cartes). */
    private static final Set<String> TOKENS = java.util.Collections.newSetFromMap(new ConcurrentHashMap<>());
    /** Marque d'un jeton perso dans son script. */
    private static final Pattern TOKEN_MARK = Pattern.compile("(?m)^SVar:AtelierToken:True\\s*$");
    /** Jeton créé par une capacité (« TokenScript$ w_1_1_soldier ») : il doit exister dans la base des jetons. */
    private static final Pattern TOKEN_SCRIPT = Pattern.compile("\\bTokenScript\\$\\s*([A-Za-z0-9_]+)");
    /** Types ajoutés à la liste de Forge par l'application (les seuls qu'on puisse en retirer). */
    private static final Set<String> ADDED_TYPES = java.util.Collections.newSetFromMap(new ConcurrentHashMap<>());

    /** Index de recherche du catalogue à refaire (posé par le pont). */
    static volatile Runnable onChanged = () -> { };
    /** Nom français → nom anglais d'une carte officielle (posé par le pont, d'après l'index du catalogue). */
    static volatile java.util.function.UnaryOperator<String> officialFrench = n -> null;

    private CustomCards() { }

    private static void changed() {
        setIndex = null;
        onChanged.run();
    }

    private static File cardsDir() {
        return new File(ForgeConstants.USER_CUSTOM_CARDS_DIR);
    }

    /** Jetons perso : Forge les lit au démarrage dans sa base des jetons, sous le nom du fichier (« atelier_… »). */
    private static File tokensDir() {
        return new File(ForgeConstants.USER_CUSTOM_TOKENS_DIR);
    }

    private static File artDir() {
        return new File(ForgeConstants.USER_CUSTOM_DIR, "art");
    }

    /** Cadres importés (PNG, la fenêtre de l'illustration transparente). */
    private static File frameDir() {
        return new File(ForgeConstants.USER_CUSTOM_DIR, "frames");
    }

    /** Réglages du formulaire de l'Atelier pour chaque carte (pour la rouvrir dans le formulaire) ; Forge ne lit que les .txt. */
    private static File formsDir() {
        return new File(ForgeConstants.USER_CUSTOM_DIR, "forms");
    }

    private static File typesFile() {
        return new File(ForgeConstants.USER_CUSTOM_DIR, "types.txt");
    }

    /** Avant le chargement de Forge : sans le dossier, Forge ne lit aucune carte perso. */
    static void prepare() {
        cardsDir().mkdirs();
        tokensDir().mkdirs();
        artDir().mkdirs();
        frameDir().mkdirs();
        formsDir().mkdirs();
    }

    /** Après le chargement de Forge : les types perso dans sa liste, l'index des fichiers. */
    static void init() {
        prepare();
        registerTypes(readTypes());
        final File[] list = cardsDir().listFiles((d, n) -> n.endsWith(".txt"));
        if (list != null) {
            for (final File f : list) {
                final String name = nameOf(read(f));
                if (name != null) {
                    FILES.put(name, f);
                }
            }
        }
        final File[] tokens = tokensDir().listFiles((d, n) -> n.endsWith(".txt"));
        if (tokens != null) {
            for (final File f : tokens) {
                final String text = read(f);
                final String name = nameOf(text);
                if (name != null && !FILES.containsKey(name)) {
                    FILES.put(name, f);
                    TOKENS.add(name);
                    registerToken(base(f), text);
                }
            }
        }
    }

    /** Jeton perso dans la base des jetons de Forge (déjà fait au démarrage par Forge, sinon tout de suite). */
    private static void registerToken(final String script, final String text) {
        final Map<String, CardRules> rules = FModel.getMagicDb().getAllTokens().getRules();
        if (!rules.containsKey(script) || text != null) {
            try {
                rules.put(script, new CardRules.Reader().readCard(Arrays.asList(text.replace("\r", "").split("\n")), script));
            } catch (final RuntimeException e) {
                System.err.println("Jeton perso illisible (" + script + ") : " + e.getMessage());
            }
        }
        Catalog.forgetTokenScripts();
    }

    static boolean isTokenScript(final String script) {
        return script != null && TOKEN_MARK.matcher(script).find();
    }

    /** Jeton perso (créé par les capacités, pas une carte qu'on met dans un deck). */
    static boolean isToken(final String name) {
        return name != null && TOKENS.contains(name) && isCustom(name);
    }

    /** Nom du jeton perso pour Forge (« TokenScript$ atelier_… »), ou null. */
    static String tokenScript(final String name) {
        final File f = isToken(name) ? FILES.get(name) : null;
        return f == null ? null : base(f);
    }

    static boolean isCustom(final String name) {
        return name != null && FILES.containsKey(name) && !DELETED.contains(name);
    }

    /** Noms des cartes perso (sans les supprimées). */
    static List<String> names() {
        final List<String> out = new ArrayList<>();
        for (final String n : FILES.keySet()) {
            if (!DELETED.contains(n)) {
                out.add(n);
            }
        }
        return out;
    }

    static boolean isDeleted(final String name) {
        return name != null && DELETED.contains(name);
    }

    /** Illustration d'une carte perso (clé « custom:Nom »), ou null. */
    static File art(final String key) {
        final String name = key.startsWith(ART_PREFIX) ? key.substring(ART_PREFIX.length()) : key;
        final File f = FILES.get(name);
        if (f == null) {
            return null;
        }
        final File art = new File(artDir(), base(f) + ".jpg");
        return art.isFile() ? art : null;
    }

    /** Cadre importé d'une carte perso (clé « customframe:Nom »), ou null. */
    static File frameImage(final String key) {
        final String name = key.startsWith(FRAME_PREFIX) ? key.substring(FRAME_PREFIX.length()) : key;
        final File f = FILES.get(name);
        if (f == null) {
            return null;
        }
        final File img = new File(frameDir(), base(f) + ".png");
        return img.isFile() ? img : null;
    }

    /** Clé du cadre importé d'une carte perso, ou null si elle n'en a pas. */
    static String frameKey(final String name) {
        return isCustom(name) && frameImage(name) != null ? FRAME_PREFIX + name : null;
    }

    /** Clé de l'illustration d'une carte perso, ou null si elle n'en a pas. */
    static String artKey(final String name) {
        return isCustom(name) && art(name) != null ? ART_PREFIX + name : null;
    }

    // ------------------------------------------------------------------ types

    static List<String> readTypes() {
        final Set<String> out = new LinkedHashSet<>();
        if (typesFile().isFile()) {
            for (final String line : read(typesFile()).split("\n")) {
                final String t = line.trim();
                if (!t.isEmpty()) {
                    out.add(t);
                }
            }
        }
        return new ArrayList<>(out);
    }

    /** Ajoute à la liste de Forge les types qui n'y sont pas, et retire ceux que l'application y avait ajoutés et qui n'en font plus partie. */
    private static void registerTypes(final List<String> types) {
        for (final String t : new ArrayList<>(ADDED_TYPES)) {
            if (!types.contains(t)) {
                CardType.Constant.CREATURE_TYPES.remove(t);
                CardType.Constant.pluralTypes.remove(t);
                ADDED_TYPES.remove(t);
            }
        }
        for (final String t : types) {
            if (CardType.Constant.CREATURE_TYPES.add(t)) {
                ADDED_TYPES.add(t);
                // Pluriel identique au singulier (« chaque X-Men »), s'il n'est pas déjà celui d'un autre type.
                if (!CardType.Constant.pluralTypes.containsKey(t) && !CardType.Constant.pluralTypes.containsValue(t)) {
                    CardType.Constant.pluralTypes.put(t, t);
                }
            }
        }
    }

    static synchronized JsonObject setTypes(final JsonArray list) {
        final Set<String> out = new LinkedHashSet<>();
        for (int i = 0; i < list.size(); i++) {
            final String t = list.get(i).getAsString().trim();
            if (t.isEmpty()) {
                continue;
            }
            if (!TYPE_NAME.matcher(t).matches()) {
                throw new IllegalArgumentException("« " + t + " » : un type tient en un mot (lettres, chiffres, tiret, apostrophe ; 30 au plus).");
            }
            out.add(Character.toUpperCase(t.charAt(0)) + t.substring(1));
        }
        write(typesFile(), String.join("\n", out) + "\n");
        registerTypes(new ArrayList<>(out));
        changed();
        return state();
    }

    // ------------------------------------------------------------------ extensions

    /** Identifiant d'une extension perso (il ne change pas, même si son code change) : écrit dans le script des cartes. */
    private static final Pattern SET_ID = Pattern.compile("[a-z0-9]{1,20}");
    /** Code d'une extension, comme ceux des vraies (« MH3 ») : 2 à 6 lettres ou chiffres. */
    private static final Pattern SET_CODE = Pattern.compile("[A-Z0-9]{2,6}");
    /** Extensions perso lues sur le disque (null : à relire). */
    private static volatile JsonArray sets;
    /** Pour chaque carte perso : son extension, et son numéro dans l'extension (refait à chaque changement). */
    private static volatile Map<String, String[]> setIndex;

    private static File setsFile() {
        return new File(ForgeConstants.USER_CUSTOM_DIR, "sets.json");
    }

    private static File setLogo(final String id) {
        return new File(new File(ForgeConstants.USER_CUSTOM_DIR, "sets"), id + ".png");
    }

    /** Les extensions perso, dans l'ordre de création : {id, code, name, tint}. */
    static JsonArray readSets() {
        JsonArray a = sets;
        if (a == null) {
            a = new JsonArray();
            if (setsFile().isFile()) {
                try {
                    for (final com.google.gson.JsonElement e : com.google.gson.JsonParser.parseString(read(setsFile())).getAsJsonArray()) {
                        final JsonObject o = e.getAsJsonObject();
                        if (SET_ID.matcher(str(o, "id")).matches() && !str(o, "name").isEmpty()) {
                            a.add(o);
                        }
                    }
                } catch (final RuntimeException e) {
                    System.err.println("Extensions perso illisibles : " + e.getMessage());
                }
            }
            sets = a;
        }
        return a;
    }

    private static JsonObject findSet(final String id) {
        for (final com.google.gson.JsonElement e : readSets()) {
            if (str(e.getAsJsonObject(), "id").equals(id)) {
                return e.getAsJsonObject();
            }
        }
        return null;
    }

    private static void writeSets(final JsonArray a) {
        write(setsFile(), a.toString());
        sets = a;
    }

    /** Logo d'une extension perso (clé « customset:id:date »), ou null. */
    static File setLogoFile(final String key) {
        final String rest = key.startsWith(SET_PREFIX) ? key.substring(SET_PREFIX.length()) : key;
        final int colon = rest.indexOf(':');
        final String id = colon < 0 ? rest : rest.substring(0, colon);
        if (!SET_ID.matcher(id).matches()) {
            return null;
        }
        final File f = setLogo(id);
        return f.isFile() ? f : null;
    }

    private static String logoKey(final String id) {
        final File f = setLogo(id);
        return f.isFile() ? SET_PREFIX + id + ":" + f.lastModified() : null;
    }

    /** Valeur d'une ligne « SVar:Nom:… » d'une carte (vide si elle n'en a pas). */
    private static String svar(final CardRules rules, final String key) {
        if (rules != null && rules.getMainPart() != null) {
            for (final Map.Entry<String, String> v : rules.getMainPart().getVariables()) {
                if (key.equals(v.getKey())) {
                    return v.getValue() == null ? "" : v.getValue().trim();
                }
            }
        }
        return "";
    }

    /** Ordre des cartes dans une extension, comme les vraies : blanc, bleu, noir, rouge, vert, multicolore, incolore, terrains. */
    private static int colorRank(final CardRules r) {
        if (r.getType().isLand()) {
            return 7;
        }
        final forge.card.ColorSet c = r.getColor();
        if (c.countColors() > 1) {
            return 5;
        }
        if (c.countColors() == 0) {
            return 6;
        }
        return c.hasWhite() ? 0 : c.hasBlue() ? 1 : c.hasBlack() ? 2 : c.hasRed() ? 3 : 4;
    }

    /** Carte → {extension, numéro, nombre de cartes de l'extension} ; les jetons n'ont pas de numéro. */
    private static Map<String, String[]> setIndex() {
        Map<String, String[]> idx = setIndex;
        if (idx != null) {
            return idx;
        }
        idx = new java.util.HashMap<>();
        final Map<String, List<CardRules>> bySet = new java.util.HashMap<>();
        for (final String name : names()) {
            final CardRules r = rules(name);
            final String id = svar(r, "AtelierSet");
            if (id.isEmpty() || findSet(id) == null) {
                continue;
            }
            if (TOKENS.contains(name)) {
                idx.put(name, new String[] {id, "", ""});
            } else {
                bySet.computeIfAbsent(id, k -> new ArrayList<>()).add(r);
            }
        }
        for (final Map.Entry<String, List<CardRules>> e : bySet.entrySet()) {
            final List<CardRules> list = e.getValue();
            list.sort(java.util.Comparator.comparingInt(CustomCards::colorRank).thenComparing(CardRules::getName, String.CASE_INSENSITIVE_ORDER));
            for (int i = 0; i < list.size(); i++) {
                idx.put(list.get(i).getName(), new String[] {e.getKey(), String.valueOf(i + 1), String.valueOf(list.size())});
            }
        }
        setIndex = idx;
        return idx;
    }

    /** L'extension perso d'une carte (son identifiant), ou "". */
    static String setOf(final String name) {
        final String[] s = name == null ? null : setIndex().get(name);
        return s == null ? "" : s[0];
    }

    /** Numéro d'une carte dans son extension (0 si elle n'en a pas). */
    static int numberOf(final String name) {
        final String[] s = name == null ? null : setIndex().get(name);
        return s == null || s[1].isEmpty() ? 0 : Integer.parseInt(s[1]);
    }

    /** Les extensions pour l'interface : id, code, nom, logo (clé d'image), teinte selon la rareté, nombre de cartes. */
    static JsonArray sets() {
        final Map<String, Integer> counts = new java.util.HashMap<>();
        for (final String[] s : setIndex().values()) {
            counts.merge(s[0], 1, Integer::sum);
        }
        final JsonArray out = new JsonArray();
        for (final com.google.gson.JsonElement e : readSets()) {
            final JsonObject o = e.getAsJsonObject().deepCopy();
            final String id = str(o, "id");
            final String logo = logoKey(id);
            if (logo != null) {
                o.addProperty("logo", logo);
            }
            o.addProperty("count", counts.getOrDefault(id, 0));
            out.add(o);
        }
        return out;
    }

    /**
     * Crée ou modifie une extension perso : {id (absent : nouvelle), code, name, tint, logo (PNG en data URL ; "" le
     * retire ; absent le garde)}. Le code ne doit pas être celui d'une extension officielle ni d'une autre extension perso.
     */
    static synchronized JsonObject saveSet(final JsonObject m) {
        final String name = str(m, "name").replaceAll("[\\r\\n|]+", " ").trim();
        final String code = str(m, "code").trim().toUpperCase(Locale.ROOT);
        if (name.isEmpty() || name.length() > 40) {
            throw new IllegalArgumentException("Donne un nom à l'extension (40 caractères au plus).");
        }
        if (!SET_CODE.matcher(code).matches()) {
            throw new IllegalArgumentException("Le code de l'extension tient en 2 à 6 lettres ou chiffres (ex. « MDR », « ILO1 »).");
        }
        if ("USER".equals(code) || FModel.getMagicDb().getEditions().get(code) != null) {
            throw new IllegalArgumentException("« " + code + " » est déjà le code d'une extension officielle : choisis-en un autre.");
        }
        String id = str(m, "id");
        final JsonArray list = readSets().deepCopy();
        JsonObject set = null;
        for (final com.google.gson.JsonElement e : list) {
            final JsonObject o = e.getAsJsonObject();
            if (!id.isEmpty() && str(o, "id").equals(id)) {
                set = o;
            } else if (str(o, "code").equals(code)) {
                throw new IllegalArgumentException("Tu as déjà une extension « " + code + " » (" + str(o, "name") + ").");
            }
        }
        if (set == null) {
            if (!id.isEmpty() && !SET_ID.matcher(id).matches()) {
                throw new IllegalArgumentException("Extension inconnue.");
            }
            if (id.isEmpty()) {
                id = Long.toString(System.currentTimeMillis(), 36);
                while (findSet(id) != null) {
                    id = id + "x";
                }
            }
            set = new JsonObject();
            set.addProperty("id", id);
            list.add(set);
        }
        set.addProperty("code", code);
        set.addProperty("name", name);
        set.addProperty("tint", m.has("tint") && m.get("tint").getAsBoolean());
        if (m.has("logo") && !m.get("logo").isJsonNull()) {
            final String logo = m.get("logo").getAsString();
            if (logo.isEmpty()) {
                delete(setLogo(id));
            } else {
                final byte[] bytes = B64.decode(logo.startsWith("data:") ? logo.substring(logo.indexOf(',') + 1) : logo);
                if (bytes.length < 8 || (bytes[0] & 0xff) != 0x89 || bytes[1] != 'P' || bytes[2] != 'N' || bytes[3] != 'G') {
                    throw new IllegalArgumentException("Le logo doit être une image PNG.");
                }
                if (bytes.length > 1_000_000) {
                    throw new IllegalArgumentException("Logo trop lourd.");
                }
                try {
                    setLogo(id).getParentFile().mkdirs();
                    Files.write(setLogo(id).toPath(), bytes);
                } catch (final IOException e) {
                    throw new IllegalStateException("Logo non enregistré : " + e.getMessage());
                }
            }
        }
        writeSets(list);
        changed();
        return state();
    }

    /** Supprime une extension perso et son logo ; ses cartes restent (sans extension). */
    static synchronized JsonObject deleteSet(final String id) {
        final JsonArray list = new JsonArray();
        for (final com.google.gson.JsonElement e : readSets()) {
            if (!str(e.getAsJsonObject(), "id").equals(id)) {
                list.add(e);
            }
        }
        if (SET_ID.matcher(id).matches()) {
            delete(setLogo(id));
        }
        writeSets(list);
        changed();
        return state();
    }

    private static long setsAt() {
        return setsFile().isFile() ? setsFile().lastModified() : 0;
    }

    private static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsString() : "";
    }

    // ------------------------------------------------------------------ cartes

    /** Types perso, cartes perso (script, carte telle que la montre le catalogue) et types de créature connus. */
    static JsonObject state() {
        final JsonObject o = new JsonObject();
        final JsonArray types = new JsonArray();
        readTypes().forEach(types::add);
        o.add("types", types);
        final JsonArray cards = new JsonArray();
        final Map<String, File> sorted = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        sorted.putAll(FILES);
        for (final Map.Entry<String, File> e : sorted.entrySet()) {
            if (DELETED.contains(e.getKey())) {
                continue;
            }
            cards.add(entry(e.getKey(), e.getValue()));
        }
        o.add("cards", cards);
        final JsonArray known = new JsonArray();
        new java.util.TreeSet<>(CardType.Constant.CREATURE_TYPES).forEach(known::add);
        o.add("creatureTypes", known);
        o.add("sets", sets());
        return o;
    }

    private static JsonObject entry(final String name, final File file) {
        final JsonObject o = new JsonObject();
        o.addProperty("name", name);
        o.addProperty("script", read(file));
        o.addProperty("at", file.lastModified());
        final File form = new File(formsDir(), base(file) + ".json");
        if (form.isFile()) {
            try {
                o.add("form", com.google.gson.JsonParser.parseString(read(form)));
            } catch (final RuntimeException e) {
                // formulaire illisible : la carte s'ouvre dans l'éditeur de script
            }
        }
        if (TOKENS.contains(name)) {
            o.addProperty("token", true);
            o.addProperty("tokenScript", base(file));
            final CardRules r = FModel.getMagicDb().getAllTokens().getRules().get(base(file));
            if (r != null) {
                o.add("card", Catalog.paperJson(new PaperCard(r, "USER", CardRarity.Special)));
            }
            return o;
        }
        final PaperCard pc = FModel.getMagicDb().getCommonCards().getCard(name);
        if (pc != null) {
            o.add("card", Catalog.paperJson(pc));
        }
        return o;
    }

    /**
     * Vérifie un script comme Forge le lira : lecture, puis création de la carte et de toutes ses capacités. Renvoie
     * la carte telle que le catalogue la montrera, et des avertissements (types inconnus...). {@code previous} : nom
     * de la carte perso modifiée (null pour une nouvelle).
     */
    static JsonObject validate(final String script, final String previous) {
        lint(script);
        final CardRules rules = parse(script, previous);
        final PaperCard pc = new PaperCard(rules, "USER", CardRarity.Special);
        try {
            final Card c = Card.fromPaperCard(pc, null);
            if (c == null) {
                throw new IllegalArgumentException("Forge n'a pas pu créer la carte.");
            }
        } catch (final RuntimeException e) {
            throw new IllegalArgumentException("Script refusé par Forge : " + message(e));
        }
        final JsonObject o = new JsonObject();
        o.add("card", Catalog.paperJson(pc));
        final JsonArray warnings = new JsonArray();
        for (final String t : rules.getType().getSubtypes()) {
            if (!knownSubtype(t)) {
                warnings.add("Type inconnu de Forge : « " + t + " ». Ajoute-le aux types perso, sinon les effets qui le citent ne trouvent aucune carte.");
            }
        }
        o.add("warnings", warnings);
        return o;
    }

    private static final Pattern API = Pattern.compile("\\b(?:AB|SP|DB)\\$\\s*([A-Za-z]+)");
    private static final Pattern MODE = Pattern.compile("\\bMode\\$\\s*([A-Za-z]+)");
    private static final Pattern EXECUTE = Pattern.compile("\\b(?:Execute|SubAbility)\\$\\s*([A-Za-z0-9_]+)");

    /**
     * Forge accepte sans rien dire un effet, un déclencheur ou un mot-clé qu'il ne connaît pas (la capacité ne fait
     * alors rien) : chaque nom est vérifié ici, avec la ligne en cause.
     */
    private static void lint(final String script) {
        final String[] lines = script.replace("\r", "").split("\n");
        final Set<String> svars = new java.util.HashSet<>();
        for (final String line : lines) {
            if (line.startsWith("SVar:")) {
                final int colon = line.indexOf(':', 5);
                if (colon > 5) {
                    svars.add(line.substring(5, colon));
                }
            }
        }
        // Surcharge : Forge recopie les cibles du sort ; sans cible, la carte plante quand elle arrive en partie.
        if (Arrays.stream(lines).anyMatch(l -> l.trim().startsWith("K:Overload"))
                && Arrays.stream(lines).noneMatch(l -> l.trim().startsWith("A:SP$") && l.contains("ValidTgts$"))) {
            throw new IllegalArgumentException("Surcharge ne va que sur un éphémère ou un rituel qui cible (« …ciblé ») : la version surchargée touche chaque cible possible.");
        }
        for (int i = 0; i < lines.length; i++) {
            final String line = lines[i].trim();
            final String where = " (ligne " + (i + 1) + ")";
            final java.util.regex.Matcher api = API.matcher(line);
            while (api.find()) {
                try {
                    forge.game.ability.ApiType.smartValueOf(api.group(1));
                } catch (final RuntimeException e) {
                    throw new IllegalArgumentException("Effet inconnu de Forge : « " + api.group(1) + " »" + where + ".");
                }
            }
            final java.util.regex.Matcher mode = MODE.matcher(line);
            if (mode.find()) {
                try {
                    if (line.startsWith("T:")) {
                        forge.game.trigger.TriggerType.smartValueOf(mode.group(1));
                    } else if (line.startsWith("S:")) {
                        forge.game.staticability.StaticAbilityMode.smartValueOf(mode.group(1));
                    }
                } catch (final RuntimeException e) {
                    throw new IllegalArgumentException((line.startsWith("T:") ? "Déclencheur" : "Capacité statique")
                            + " inconnu(e) de Forge : « " + mode.group(1) + " »" + where + ".");
                }
            }
            final java.util.regex.Matcher exec = EXECUTE.matcher(line);
            while (exec.find()) {
                if (!svars.contains(exec.group(1))) {
                    throw new IllegalArgumentException("« " + exec.group(1) + " » n'est défini par aucune ligne « SVar:" + exec.group(1) + ":… »" + where + ".");
                }
            }
            final java.util.regex.Matcher token = TOKEN_SCRIPT.matcher(line);
            while (token.find()) {
                if (!FModel.getMagicDb().getAllTokens().containsRule(token.group(1))) {
                    throw new IllegalArgumentException("Jeton inconnu : « " + token.group(1) + " »" + where
                            + (token.group(1).startsWith("atelier_") ? " (jeton perso supprimé ?)." : "."));
                }
            }
            if (line.startsWith("K:")) {
                final String k = line.substring(2).trim();
                // Lignes que Forge lit sans en faire un mot-clé de sa liste : chapitres de saga, marqueurs à l'arrivée,
                // niveaux de classe.
                // Lignes K: que Forge lit sans en faire un mot-clé : chapitres, marqueurs à l'arrivée, classes, copie à l'arrivée,
                // et les mots-clés en phrase (« CARDNAME must be blocked if able. »).
                final boolean special = k.startsWith("Chapter:") || k.startsWith("etbCounter:") || k.startsWith("Class:") || k.startsWith("ETBReplacement:")
                        || KW_TEXT_LINES.contains(k);
                if (!special && forge.game.keyword.Keyword.getInstance(k).getKeyword() == forge.game.keyword.Keyword.UNDEFINED) {
                    throw new IllegalArgumentException("Mot-clé inconnu de Forge : « " + k + " »" + where + ".");
                }
            }
        }
    }

    private static boolean knownSubtype(final String t) {
        return CardType.isACreatureType(t) || CardType.isASubType(t);
    }

    private static CardRules parse(final String script, final String previous) {
        if (script == null || script.isBlank()) {
            throw new IllegalArgumentException("Le script est vide.");
        }
        final List<String> lines = Arrays.asList(script.replace("\r", "").split("\n"));
        final String name = nameOf(script);
        if (name == null) {
            throw new IllegalArgumentException("Il manque la ligne « Name: » (le nom de la carte).");
        }
        if (name.contains("|") || name.contains("//")) {
            throw new IllegalArgumentException("Le nom ne peut contenir ni « | » ni « // ».");
        }
        final boolean mine = FILES.containsKey(name);
        final CardRules existing = FModel.getMagicDb().getCommonCards().getRules(name, false);
        // Une carte perso supprimée pendant cette session reste dans la base de Forge : son nom est libre.
        if (!mine && existing != null && !existing.isCustom()) {
            throw new IllegalArgumentException("Une carte de Magic s'appelle déjà « " + name + " » : choisis un autre nom.");
        }
        final String frenchOf = mine ? null : officialFrench.apply(name);
        if (frenchOf != null) {
            // Une liste de deck en français (« 1 Tornade ») ne saurait plus laquelle prendre.
            throw new IllegalArgumentException("« " + name + " » est le nom français d'une carte de Magic (" + frenchOf + ") : choisis un autre nom.");
        }
        if (mine && !name.equals(previous) && !DELETED.contains(name)) {
            throw new IllegalArgumentException("Tu as déjà une carte perso qui s'appelle « " + name + " ».");
        }
        final CardRules rules;
        try {
            rules = new CardRules.Reader().readCard(lines, base(name));
        } catch (final RuntimeException e) {
            throw new IllegalArgumentException("Script illisible : " + message(e));
        }
        if (rules == null || rules.getMainPart() == null || rules.getType() == null) {
            throw new IllegalArgumentException("Script illisible (« Name: », « ManaCost: », « Types: » attendus).");
        }
        rules.setCustom();
        return rules;
    }

    /**
     * Enregistre une carte perso (nouvelle, ou {@code previous} modifiée), avec son illustration : {@code art} en
     * JPEG (data URL ou base64), "" pour la retirer, null pour garder celle qu'elle a.
     */
    static synchronized JsonObject save(final String script, final String previous, final String art, final String form) {
        return save(script, previous, art, form, null);
    }

    /** Comme {@link #save(String, String, String, String)}, avec le cadre importé (PNG ; "" le retire, null le garde). */
    static synchronized JsonObject save(final String script, final String previous, final String art, final String form, final String frame) {
        validate(script, previous);
        final CardRules rules = parse(script, previous);
        final String name = rules.getName();
        // Carte ou jeton : chacun son dossier (Forge lit les cartes dans sa base des cartes, les jetons dans celle des jetons).
        final boolean token = isTokenScript(script);
        final File dir = token ? tokensDir() : cardsDir();
        File file = FILES.get(name);
        File oldArt = null;
        File oldFrame = null;
        if (file != null && !DELETED.contains(name) && !dir.getAbsoluteFile().equals(file.getAbsoluteFile().getParentFile())) {
            // Une carte devenue jeton (ou l'inverse) : nouveau fichier, l'illustration et le cadre suivent.
            oldArt = new File(artDir(), base(file) + ".jpg");
            oldFrame = new File(frameDir(), base(file) + ".png");
            delete(new File(formsDir(), base(file) + ".json"));
            delete(file);
            file = null;
        }
        if (file == null || DELETED.contains(name)) {
            dir.mkdirs();
            file = new File(dir, unusedBase(name, token) + ".txt");
        }
        if (previous != null && !previous.equals(name) && FILES.containsKey(previous)) {
            // Renommée : l'ancienne carte disparaît (de la base de Forge au prochain lancement), son illustration suit.
            final File old = FILES.remove(previous);
            oldArt = new File(artDir(), base(old) + ".jpg");
            oldFrame = new File(frameDir(), base(old) + ".png");
            delete(new File(formsDir(), base(old) + ".json"));
            delete(old);
            DELETED.add(previous);
            tomb(previous, true);
        }
        write(file, script.replace("\r", "").trim() + "\n");
        FILES.put(name, file);
        DELETED.remove(name);
        tomb(name, false);
        final File formFile = new File(formsDir(), base(file) + ".json");
        if (form == null || form.isEmpty()) {
            delete(formFile);
        } else {
            write(formFile, form);
        }
        final File artFile = new File(artDir(), base(file) + ".jpg");
        if (art == null) {
            if (oldArt != null && oldArt.isFile()) {
                try {
                    Files.move(oldArt.toPath(), artFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                } catch (final IOException e) {
                    System.err.println("Illustration non déplacée : " + e.getMessage());
                }
            }
        } else if (art.isEmpty()) {
            delete(artFile);
        } else {
            final String b64 = art.startsWith("data:") ? art.substring(art.indexOf(',') + 1) : art;
            final byte[] bytes = B64.decode(b64);
            if (bytes.length > 2_000_000) {
                throw new IllegalArgumentException("Illustration trop lourde.");
            }
            try {
                Files.write(artFile.toPath(), bytes);
            } catch (final IOException e) {
                throw new IllegalStateException("Illustration non enregistrée : " + e.getMessage());
            }
        }
        final File frameFile = new File(frameDir(), base(file) + ".png");
        if (frame == null) {
            if (oldFrame != null && oldFrame.isFile()) {
                try {
                    Files.move(oldFrame.toPath(), frameFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                } catch (final IOException e) {
                    System.err.println("Cadre non déplacé : " + e.getMessage());
                }
            }
        } else if (frame.isEmpty()) {
            delete(frameFile);
        } else {
            final byte[] bytes = B64.decode(frame.startsWith("data:") ? frame.substring(frame.indexOf(',') + 1) : frame);
            // Un PNG (signature 89 50 4E 47) : la transparence laisse voir l'illustration.
            if (bytes.length < 8 || (bytes[0] & 0xff) != 0x89 || bytes[1] != 'P' || bytes[2] != 'N' || bytes[3] != 'G') {
                throw new IllegalArgumentException("Le cadre doit être une image PNG.");
            }
            if (bytes.length > 3_000_000) {
                throw new IllegalArgumentException("Cadre trop lourd.");
            }
            try {
                frameFile.getParentFile().mkdirs();
                Files.write(frameFile.toPath(), bytes);
            } catch (final IOException e) {
                throw new IllegalStateException("Cadre non enregistré : " + e.getMessage());
            }
        }
        if (token) {
            // Jeton : dans la base des jetons de Forge, sous le nom de son fichier ; jamais dans les cartes.
            TOKENS.add(name);
            registerToken(base(file), read(file));
            changed();
            return entry(name, file);
        }
        TOKENS.remove(name);
        // Dans la base de Forge tout de suite, comme au démarrage (édition « USER »), ou modifiée sur place.
        final CardDb db = FModel.getMagicDb().getCommonCards();
        if (db.getRules(name, false) != null) {
            db.getEditor().putCard(rules);
        } else {
            db.loadCard(name, null, rules);
            db.addCard(new PaperCard(rules, "USER", CardRarity.Special));
        }
        changed();
        return entry(name, file);
    }

    static synchronized JsonObject delete(final String name) {
        if (remove(name)) {
            tomb(name, true);
        }
        return state();
    }

    /** Retire une carte perso de l'appareil (fichiers, recherches) ; Forge la garde jusqu'au prochain lancement. */
    private static boolean remove(final String name) {
        final File f = FILES.remove(name);
        if (f == null) {
            return false;
        }
        delete(new File(artDir(), base(f) + ".jpg"));
        delete(new File(frameDir(), base(f) + ".png"));
        delete(new File(formsDir(), base(f) + ".json"));
        delete(f);
        DELETED.add(name);
        TOKENS.remove(name);
        changed();
        return true;
    }

    /** Nom français d'un mot-clé simple (« flying » : Vol), ou null. */
    static String keywordFr(final String en) {
        return en == null ? null : KEYWORDS_FR.get(en.trim().toLowerCase(Locale.ROOT));
    }

    /** Mots-clés de l'Atelier (ceux du formulaire) : Forge les écrit en anglais pour une carte sans traduction. */
    // Généré depuis KW_ALL (ui/js/cardscript.js) : nom anglais de Forge en minuscules → nom français des cartes.
    private static final Map<String, String> KEYWORDS_FR = Map.ofEntries(
            Map.entry("flying", "Vol"),
            Map.entry("first strike", "Initiative"),
            Map.entry("double strike", "Double initiative"),
            Map.entry("deathtouch", "Contact mortel"),
            Map.entry("haste", "Célérité"),
            Map.entry("lifelink", "Lien de vie"),
            Map.entry("menace", "Menace"),
            Map.entry("reach", "Portée"),
            Map.entry("trample", "Piétinement"),
            Map.entry("trample over planeswalkers", "Piétinement au-dessus des planeswalkers"),
            Map.entry("vigilance", "Vigilance"),
            Map.entry("defender", "Défenseur"),
            Map.entry("infect", "Infection"),
            Map.entry("wither", "Flétrissure"),
            Map.entry("shadow", "Distorsion"),
            Map.entry("fear", "Peur"),
            Map.entry("intimidate", "Intimidation"),
            Map.entry("skulk", "Furtivité"),
            Map.entry("horsemanship", "Équitation"),
            Map.entry("flanking", "Débordement"),
            Map.entry("banding", "Regroupement"),
            Map.entry("plainswalk", "Traversée des plaines"),
            Map.entry("islandwalk", "Traversée des îles"),
            Map.entry("swampwalk", "Traversée des marais"),
            Map.entry("mountainwalk", "Traversée des montagnes"),
            Map.entry("forestwalk", "Traversée des forêts"),
            Map.entry("legendary landwalk", "Traversée des terrains légendaires"),
            Map.entry("afflict", "Affliction"),
            Map.entry("provoke", "Provocation"),
            Map.entry("enlist", "Enrôlement"),
            Map.entry("hexproof", "Défense talismanique"),
            Map.entry("hexproof from white", "Défense talismanique contre le blanc"),
            Map.entry("hexproof from blue", "Défense talismanique contre le bleu"),
            Map.entry("hexproof from black", "Défense talismanique contre le noir"),
            Map.entry("hexproof from red", "Défense talismanique contre le rouge"),
            Map.entry("hexproof from green", "Défense talismanique contre le vert"),
            Map.entry("hexproof from monocolored", "Défense talismanique contre le monochrome"),
            Map.entry("hexproof from artifacts", "Défense talismanique contre les artefacts"),
            Map.entry("shroud", "Linceul"),
            Map.entry("indestructible", "Indestructible"),
            Map.entry("protection from white", "Protection contre le blanc"),
            Map.entry("protection from blue", "Protection contre le bleu"),
            Map.entry("protection from black", "Protection contre le noir"),
            Map.entry("protection from red", "Protection contre le rouge"),
            Map.entry("protection from green", "Protection contre le vert"),
            Map.entry("protection from creatures", "Protection contre les créatures"),
            Map.entry("protection from artifacts", "Protection contre les artefacts"),
            Map.entry("protection from multicolored", "Protection contre le multicolore"),
            Map.entry("protection from instants", "Protection contre les éphémères"),
            Map.entry("protection from everything", "Protection contre tout"),
            Map.entry("ward", "Parade"),
            Map.entry("ward—pay life", "Parade — payer des points de vie"),
            Map.entry("ward—discard a card", "Parade — se défausser d'une carte"),
            Map.entry("phasing", "Déphasage"),
            Map.entry("flash", "Flash"),
            Map.entry("prowess", "Prouesse"),
            Map.entry("cascade", "Cascade"),
            Map.entry("exalted", "Exaltation"),
            Map.entry("persist", "Persistance"),
            Map.entry("undying", "Survivance"),
            Map.entry("changeling", "Changelin"),
            Map.entry("riot", "Émeute"),
            Map.entry("training", "Entraînement"),
            Map.entry("mentor", "Mentor"),
            Map.entry("dethrone", "Détrôner"),
            Map.entry("melee", "Mêlée"),
            Map.entry("battle cry", "Cri de guerre"),
            Map.entry("myriad", "Myriade"),
            Map.entry("evolve", "Évolution"),
            Map.entry("extort", "Extorsion"),
            Map.entry("unleash", "Emportement"),
            Map.entry("decayed", "Décomposition"),
            Map.entry("ascend", "Ascension"),
            Map.entry("devoid", "Carence"),
            Map.entry("exploit", "Exploitation"),
            Map.entry("ingest", "Ingestion"),
            Map.entry("soulbond", "Association d'âmes"),
            Map.entry("sunburst", "Solarisation"),
            Map.entry("increment", "Incrémentation"),
            Map.entry("compleated", "Parachevé"),
            Map.entry("read ahead", "Lecture rapide"),
            Map.entry("outlast", "Résilience"),
            Map.entry("champion", "Appui"),
            Map.entry("annihilator", "Annihilateur"),
            Map.entry("bushido", "Bushido"), Map.entry("hideaway", "Cachette"),
            Map.entry("toxic", "Toxique"),
            Map.entry("afterlife", "Au-delà"),
            Map.entry("fabricate", "Fabrication"),
            Map.entry("rampage", "Sauvagerie"),
            Map.entry("modular", "Modularité"),
            Map.entry("renown", "Réputation"),
            Map.entry("bloodthirst", "Soif de sang"),
            Map.entry("dredge", "Dragage"),
            Map.entry("fading", "Évanescence"),
            Map.entry("vanishing", "Disparition"),
            Map.entry("amplify", "Amplification"),
            Map.entry("devour", "Dévorement"),
            Map.entry("graft", "Greffe"),
            Map.entry("soulshift", "Transmigration"),
            Map.entry("mobilize", "Mobilisation"),
            Map.entry("firebending", "Maîtrise du Feu"),
            Map.entry("equip", "Équipement"),
            Map.entry("enchant", "Enchanter"),
            Map.entry("bestow", "Grâce"),
            Map.entry("crew", "Pilotage"),
            Map.entry("saddle", "Seller"),
            Map.entry("living weapon", "Arme vivante"),
            Map.entry("for mirrodin!", "Pour Mirrodin !"),
            Map.entry("job select", "Choix de job"),
            Map.entry("reconfigure", "Reconfiguration"),
            Map.entry("fortify", "Fortification"),
            Map.entry("station", "Station"),
            Map.entry("umbra armor", "Armure totémique"),
            Map.entry("living metal", "Métal vivant"),
            Map.entry("kicker", "Kick"),
            Map.entry("multikicker", "Multikick"),
            Map.entry("buyback", "Rappel"),
            Map.entry("ninjutsu", "Ninjutsu"),
            Map.entry("dash", "Précipitation"),
            Map.entry("blitz", "Blitz"),
            Map.entry("evoke", "Évocation"),
            Map.entry("madness", "Folie"),
            Map.entry("morph", "Mue"),
            Map.entry("megamorph", "Mégamue"),
            Map.entry("disguise", "Déguisement"),
            Map.entry("echo", "Écho"),
            Map.entry("cumulative upkeep", "Entretien cumulatif"),
            Map.entry("entwine", "Union"),
            Map.entry("escalate", "Intensification"),
            Map.entry("foretell", "Prédiction"),
            Map.entry("mutate", "Mutation"),
            Map.entry("miracle", "Miracle"),
            Map.entry("prowl", "Incursion"),
            Map.entry("plot", "Complot"),
            Map.entry("offspring", "Progéniture"),
            Map.entry("overload", "Surcharge"),
            Map.entry("replicate", "Duplication"),
            Map.entry("spectacle", "Spectacle"),
            Map.entry("squad", "Escouade"),
            Map.entry("surge", "Déferlement"),
            Map.entry("emerge", "Émergence"),
            Map.entry("freerunning", "Course libre"),
            Map.entry("strive", "Obstination"),
            Map.entry("sneak", "Infiltration"),
            Map.entry("warp", "Warp"),
            Map.entry("web-slinging", "Lanceur de toile"),
            Map.entry("transmute", "Transmutation"),
            Map.entry("transfigure", "Transfiguration"),
            Map.entry("offering", "Offrande"),
            Map.entry("suspend", "Suspension"),
            Map.entry("awaken", "Éveil"),
            Map.entry("reinforce", "Renfort"),
            Map.entry("impending", "Imminence"),
            Map.entry("flashback", "Flashback"),
            Map.entry("unearth", "Exhumation"),
            Map.entry("embalm", "Embaumement"),
            Map.entry("eternalize", "Éternalisation"),
            Map.entry("encore", "Encore"),
            Map.entry("scavenge", "Récupération"),
            Map.entry("harmonize", "Harmonisation"),
            Map.entry("mayhem", "Désordre"),
            Map.entry("recover", "Recouvrement"),
            Map.entry("retrace", "Pistage"),
            Map.entry("jump-start", "Relancez"),
            Map.entry("escape", "Échappée"),
            Map.entry("cycling", "Recyclage"),
            Map.entry("plainscycling", "Recyclage de plaine"),
            Map.entry("islandcycling", "Recyclage d'île"),
            Map.entry("swampcycling", "Recyclage de marais"),
            Map.entry("mountaincycling", "Recyclage de montagne"),
            Map.entry("forestcycling", "Recyclage de forêt"),
            Map.entry("basic landcycling", "Recyclage de terrain de base"),
            Map.entry("affinity", "Affinité"),
            Map.entry("convoke", "Convocation"),
            Map.entry("delve", "Fouille"),
            Map.entry("improvise", "Improvisation"),
            Map.entry("storm", "Déluge"),
            Map.entry("gravestorm", "Déluge de cimetière"),
            Map.entry("split second", "Fraction de seconde"),
            Map.entry("rebound", "Rebond"),
            Map.entry("bargain", "Négociation"),
            Map.entry("cipher", "Cryptage"),
            Map.entry("conspire", "Conspiration"),
            Map.entry("demonstrate", "Démonstration"),
            Map.entry("epic", "Épique"),
            Map.entry("undaunted", "Témérité"),
            Map.entry("paradigm", "Paradigme"),
            Map.entry("casualty", "Victime"),
            Map.entry("ripple", "Remous"),
            Map.entry("splice onto arcane", "Imprégnation d'arcane"),
            Map.entry("partner", "Partenariat"),
            Map.entry("partner with", "Partenariat avec"),
            Map.entry("choose a background", "Choisissez un passé"),
            Map.entry("doctor's companion", "Compagnon du Docteur"),
            Map.entry("partner—character select", "Partenariat — Sélection du personnage"),
            Map.entry("assist", "Assistance"));
    /** Mot-clé avec sa valeur, tel que Forge l'écrit (« Annihilator 2 », « Cycling {1}{U} », « Ward {3} »). */
    /** Ligne de mot-clé avec son texte de rappel (« Undying (When this creature dies, …) ») : le rappel en anglais tombe. */
    private static final Pattern REMINDER = Pattern.compile("^(.*?)\\s*\\((?:[^()]|\\([^()]*\\))*\\)$");
    /** Les noms français des mots-clés (« équipement », « pilotage »), pour reconnaître un mot-clé que Forge écrit déjà en français. */
    private static final java.util.Set<String> FR_KEYWORD_NAMES = new java.util.HashSet<>();

    static {
        for (final String fr : KEYWORDS_FR.values()) {
            FR_KEYWORD_NAMES.add(fr.toLowerCase(Locale.ROOT));
        }
    }

    private static final Pattern KEYWORD_VALUE = Pattern.compile("^(.+?)\\s+((?:\\{[^}]*\\})+|\\d+)$");
    private static final Pattern COUNTERS_LINE = Pattern.compile("^(.+) counters: (\\d+)$");

    /**
     * Texte d'une carte perso en partie, en français : Forge y ajoute en anglais les mots-clés qu'elle a ou qu'on
     * lui donne (« Haste, flying ») et ses marqueurs (« +1/+1 counters: 2 »).
     */
    private static final String[] EN_NUMBERS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"};
    private static final String[] FR_NUMBERS = {"zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"};
    private static final Pattern KW_NCOST = Pattern.compile("^(Suspend|Awaken|Reinforce|Impending) (\\d+|X)\\s*—\\s*(.+)$");
    private static final Pattern KW_ESCAPE = Pattern.compile("^Escape—(.+?), Exile (\\w+) other cards? from your graveyard\\.?$");
    private static final Pattern KW_CHAMPION = Pattern.compile("^Champion an? (.+)$");
    private static final Pattern KW_OFFERING = Pattern.compile("^(.+) offering$");
    private static final Pattern KW_STRIVE = Pattern.compile("^Strive - .+ costs (.+) more to cast for each target beyond the first\\.?$");
    private static final Pattern KW_WARD_LIFE = Pattern.compile("^Ward—Pay (\\d+) life\\.?$");
    private static final Pattern KW_AFFINITY = Pattern.compile("^Affinity for (.+?)\\.?$");

    /** « de créature », « d'elfe » : un type de créature dans un nom de mot-clé (Appui, Offrande). */
    private static String deType(final String en) {
        String fr = "creature".equalsIgnoreCase(en) ? "créature" : French.creatureTypeFr(en);
        if (fr == null) {
            fr = en;
        }
        fr = fr.toLowerCase(Locale.ROOT);
        return (fr.matches("^[aeiouyhéèêàâîôû].*") ? "d'" : "de ") + fr;
    }

    /** Les mots-clés que Forge écrit en phrase (« Suspend 3—{1}{U} », « Escape—… ») : leur texte des cartes françaises, ou null. */
    /** Mots-clés en phrase que l'Atelier écrit (Forge les connaît, sans en faire des mots-clés). */
    private static final Set<String> KW_TEXT_LINES = Set.of("CARDNAME must be blocked if able.", "All creatures able to block CARDNAME do so.",
            "CARDNAME can't attack or block alone.", "CARDNAME can't attack alone.", "Prevent all damage that would be dealt to CARDNAME.",
            "Prevent all combat damage that would be dealt to CARDNAME.", "You may choose not to untap CARDNAME during your untap step.",
            "CARDNAME can be your commander.", "A deck can have any number of cards named CARDNAME.");

    /** Mots-clés en phrase (« CARDNAME must be blocked if able. ») : Forge les écrit en anglais, avec le nom de la carte. */
    private static final String[][] KW_SENTENCES = {
        {"^(.+?) must be blocked if able\\.?$", "$1 doit être bloquée si possible."},
        {"^All creatures able to block (.+?) do so\\.?$", "Toutes les créatures capables de bloquer $1 le font."},
        {"^(.+?) can't attack or block alone\\.?$", "$1 ne peut pas attaquer ou bloquer seule."},
        {"^(.+?) can't attack alone\\.?$", "$1 ne peut pas attaquer seule."},
        {"^Prevent all combat damage that would be dealt to (.+?)\\.?$", "Prévenez toutes les blessures de combat qui devraient être infligées à $1."},
        {"^Prevent all damage that would be dealt to (.+?)\\.?$", "Prévenez toutes les blessures qui devraient être infligées à $1."},
        {"^You may choose not to untap (.+?) during your untap step\\.?$", "Vous pouvez choisir de ne pas dégager $1 pendant votre étape de dégagement."},
        {"^(.+?) can be your commander\\.?$", "$1 peut être votre commandant."},
        {"^A deck can have any number of cards named (.+?)\\.?$", "Un deck peut contenir n'importe quel nombre de cartes appelées $1."},
    };
    private static final Pattern[] KW_SENTENCE_PATTERNS = java.util.Arrays.stream(KW_SENTENCES).map(x -> Pattern.compile(x[0])).toArray(Pattern[]::new);

    static String keywordPhrase(final String core) {
        for (int i = 0; i < KW_SENTENCE_PATTERNS.length; i++) {
            final java.util.regex.Matcher s = KW_SENTENCE_PATTERNS[i].matcher(core);
            if (s.matches()) {
                return s.replaceFirst(KW_SENTENCES[i][1]);
            }
        }
        java.util.regex.Matcher m = KW_NCOST.matcher(core);
        if (m.matches()) {
            final String name = Map.of("Suspend", "Suspension", "Awaken", "Éveil", "Reinforce", "Renfort", "Impending", "Imminence").get(m.group(1));
            return name + " " + m.group(2) + " — " + m.group(3).trim();
        }
        m = KW_ESCAPE.matcher(core);
        if (m.matches()) {
            int k = java.util.Arrays.asList(EN_NUMBERS).indexOf(m.group(2).toLowerCase(Locale.ROOT));
            final String n = k >= 0 ? FR_NUMBERS[k] : m.group(2);
            return "Échappée — " + m.group(1) + ", exilez " + n + " autre" + ("one".equals(m.group(2)) ? "" : "s") + " carte" + ("one".equals(m.group(2)) ? "" : "s") + " de votre cimetière.";
        }
        m = KW_CHAMPION.matcher(core);
        if (m.matches()) {
            return "Appui " + deType(m.group(1));
        }
        m = KW_OFFERING.matcher(core);
        if (m.matches() && !m.group(1).contains(" ")) {
            return "Offrande " + deType(m.group(1));
        }
        m = KW_STRIVE.matcher(core);
        if (m.matches()) {
            return "Obstination — Ce sort coûte " + m.group(1) + " de plus à lancer pour chaque cible au-delà de la première.";
        }
        m = KW_WARD_LIFE.matcher(core);
        if (m.matches()) {
            return "Parade — Payez " + m.group(1) + " points de vie.";
        }
        m = KW_AFFINITY.matcher(core);
        if (m.matches()) {
            final String what = Map.of("artifacts", "les artefacts", "equipment", "les équipements", "creatures", "les créatures",
                    "enchantments", "les enchantements", "plains", "les plaines", "islands", "les îles", "swamps", "les marais",
                    "mountains", "les montagnes", "forests", "les forêts").get(m.group(1).trim().toLowerCase(Locale.ROOT));
            if (what != null) {
                return "Affinité pour " + what;
            }
        }
        if (core.matches("^Ward—Discard a card\\.?$")) {
            return "Parade — Défaussez-vous d'une carte.";
        }
        if (core.startsWith("Partner with ")) {
            return "Partenariat avec " + core.substring("Partner with ".length());
        }
        if (core.equals("Partner — Character select")) {
            return "Partenariat — Sélection du personnage";
        }
        return null;
    }

    static String frenchText(final String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        final StringBuilder out = new StringBuilder(text.length());
        // « Choisissez l'un — » : Forge écrit toujours en anglais la tête d'une capacité à modes.
        // Classes et affaires : les lignes que Forge écrit lui-même (rappel, niveaux, « Solved »).
        final String[] lines = text.replace("(Gain the next level as a sorcery to add its ability.)",
                        "(Acquérez le prochain niveau lorsque vous pourriez lancer un rituel pour ajouter sa capacité.)")
                .replaceAll("(?m)^(\\{[^\\n]*\\}): Level (\\d+)\\s*$", "$1 : Niveau $2")
                .replaceAll("\\(Class Level: (\\d+)\\)", "(Niveau de classe : $1)")
                .replaceAll("(?m)^Solved\\s*$", "Résolue")
                .replace("Choose one or more —", "Choisissez un ou plusieurs —").replace("choose one or more —", "choisissez un ou plusieurs —")
                .replace("Choose two —", "Choisissez deux —").replace("choose two —", "choisissez deux —")
                .replace("Choose one —", "Choisissez l'un —").replace("choose one —", "choisissez l'un —")
                .split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            final String line = lines[i];
            if (i > 0) {
                out.append('\n');
            }
            final java.util.regex.Matcher m = COUNTERS_LINE.matcher(line.trim());
            if (m.matches()) {
                out.append("Marqueurs ").append(m.group(1)).append(" : ").append(m.group(2));
                continue;
            }
            String core = line.trim();
            final java.util.regex.Matcher reminder = REMINDER.matcher(core);
            if (reminder.matches() && !reminder.group(1).isEmpty()) {
                core = reminder.group(1).trim();
            }
            final String phrase = keywordPhrase(core);
            if (phrase != null) {
                out.append(phrase);
                continue;
            }
            final String[] parts = core.split(",\\s*");
            final List<String> fr = new ArrayList<>();
            for (final String part : parts) {
                String k = KEYWORDS_FR.get(part.trim().toLowerCase(Locale.ROOT));
                if (k == null && FR_KEYWORD_NAMES.contains(part.trim().toLowerCase(Locale.ROOT))) {
                    // Déjà en français (Forge a repris le texte d'une carte traduite) : seulement sans son rappel.
                    k = part.trim();
                }
                if (k == null) {
                    final java.util.regex.Matcher v = KEYWORD_VALUE.matcher(part.trim());
                    String name = v.matches() ? KEYWORDS_FR.get(v.group(1).toLowerCase(Locale.ROOT)) : null;
                    if (name == null && v.matches() && FR_KEYWORD_NAMES.contains(v.group(1).toLowerCase(Locale.ROOT))) {
                        name = v.group(1);
                    }
                    if (name == null) {
                        break;
                    }
                    k = name + " " + v.group(2);
                }
                fr.add(fr.isEmpty() ? k : Character.toLowerCase(k.charAt(0)) + k.substring(1));
            }
            out.append(!core.isBlank() && fr.size() == parts.length ? String.join(", ", fr) : line);
        }
        return out.toString();
    }

    // ------------------------------------------------------------------ affichage

    private static final Pattern FRAME_VALUE = Pattern.compile("[A-Za-z0-9_-]{1,20}");

    /**
     * Réglages d'affichage d'une carte perso, écrits dans son script (lignes « SVar:AtelierFrame:… »,
     * « SVar:AtelierFrameColor:… », « SVar:AtelierLang:en ») : cadre, couleur du cadre, langue du texte.
     */
    static void addDisplay(final JsonObject o, final CardRules rules) {
        String frame = "modern";
        String color = "auto";
        String lang = "fr";
        String text = "dark";
        String fx = "none";
        String setId = "";
        if (rules != null && rules.getMainPart() != null) {
            for (final Map.Entry<String, String> v : rules.getMainPart().getVariables()) {
                final String value = v.getValue() == null ? "" : v.getValue().trim();
                if ("AtelierFlavor".equals(v.getKey())) {
                    // Texte d'ambiance (en italique sous les capacités) : « \n » y marque un retour à la ligne.
                    if (!value.isEmpty()) {
                        o.addProperty("flavor", value.replace("\\n", "\n"));
                    }
                    continue;
                }
                if ("AtelierArtist".equals(v.getKey())) {
                    // L'artiste, en bas de la carte (« ✎ Ilona »).
                    if (!value.isEmpty()) {
                        o.addProperty("artist", value.length() > 60 ? value.substring(0, 60) : value);
                    }
                    continue;
                }
                if (!FRAME_VALUE.matcher(value).matches()) {
                    continue;
                }
                switch (v.getKey()) {
                    case "AtelierFrame" -> frame = value;
                    case "AtelierFrameColor" -> color = value;
                    case "AtelierLang" -> lang = "en".equals(value) ? "en" : "fr";
                    case "AtelierFrameText" -> text = "light".equals(value) ? "light" : "dark";
                    case "AtelierFx" -> fx = value;
                    case "AtelierRarity" -> {
                        if (value.matches("[CURMS]")) {
                            o.addProperty("crarity", value);
                        }
                    }
                    case "AtelierSet" -> setId = value;
                    default -> { }
                }
            }
        }
        o.addProperty("frame", frame);
        o.addProperty("frameColor", color);
        o.addProperty("lang", lang);
        o.addProperty("frameText", text);
        o.addProperty("fx", fx);
        // Extension perso : code, nom, logo, et le numéro de la carte (« 007/120 »).
        final JsonObject set = setId.isEmpty() ? null : findSet(setId);
        if (set != null) {
            final JsonObject cs = new JsonObject();
            cs.addProperty("id", setId);
            cs.addProperty("code", str(set, "code"));
            cs.addProperty("name", str(set, "name"));
            cs.addProperty("tint", set.has("tint") && set.get("tint").getAsBoolean());
            final String logo = logoKey(setId);
            if (logo != null) {
                cs.addProperty("logo", logo);
            }
            final String[] n = rules == null ? null : setIndex().get(rules.getName());
            if (n != null && !n[1].isEmpty()) {
                cs.addProperty("n", Integer.parseInt(n[1]));
                cs.addProperty("total", Integer.parseInt(n[2]));
            }
            o.add("cset", cs);
        }
    }

    /** La carte perso de ce nom, telle que Forge l'a lue (null si ce n'en est pas une). */
    static CardRules rules(final String name) {
        final String token = tokenScript(name);
        if (token != null) {
            return FModel.getMagicDb().getAllTokens().getRules().get(token);
        }
        final CardRules r = name == null ? null : FModel.getMagicDb().getCommonCards().getRules(name, false);
        return r != null && r.isCustom() ? r : null;
    }

    /** Ligne de type dans la langue de la carte : « Legendary Creature — Human Wizard » en anglais. */
    static String typeLine(final forge.card.CardTypeView type, final String lang) {
        if (!"en".equals(lang)) {
            return typeLine(type);
        }
        final List<String> head = new ArrayList<>();
        for (final CardType.Supertype st : type.getSupertypes()) {
            head.add(st.name());
        }
        for (final CardType.CoreType c : type.getCoreTypes()) {
            head.add(c.name());
        }
        final StringBuilder sb = new StringBuilder(String.join(" ", head));
        if (!type.getSubtypes().isEmpty()) {
            sb.append(" — ").append(String.join(" ", type.getSubtypes()));
        }
        return sb.toString().trim();
    }

    /**
     * Sous-types non-créature en français, comme sur les cartes (« Artefact : équipement », « Enchantement : aura et
     * malédiction »). Généré depuis SUBTYPES (ui/js/cardscript.js).
     */
    private static final Map<String, String> SUBTYPES_FR = Map.ofEntries(
            Map.entry("Equipment", "équipement"),
            Map.entry("Fortification", "fortification"),
            Map.entry("Vehicle", "véhicule"),
            Map.entry("Spacecraft", "vaisseau spatial"),
            Map.entry("Food", "nourriture"),
            Map.entry("Clue", "indice"),
            Map.entry("Treasure", "trésor"),
            Map.entry("Blood", "sang"),
            Map.entry("Gold", "or"),
            Map.entry("Map", "carte"),
            Map.entry("Powerstone", "lithoforce"),
            Map.entry("Junk", "bric-à-brac"),
            Map.entry("Lander", "atterrisseur"),
            Map.entry("Mutagen", "mutagène"),
            Map.entry("Incubator", "incubateur"),
            Map.entry("Attraction", "attraction"),
            Map.entry("Bobblehead", "figurine"),
            Map.entry("Book", "livre"),
            Map.entry("Communicator", "communicateur"),
            Map.entry("Heartwood", "heartwood"),
            Map.entry("Infinity", "infinité"),
            Map.entry("Stone", "pierre"),
            Map.entry("Vibranium", "vibranium"),
            Map.entry("Aura", "aura"),
            Map.entry("Curse", "malédiction"),
            Map.entry("Role", "rôle"),
            Map.entry("Cartouche", "cartouche"),
            Map.entry("Rune", "rune"),
            Map.entry("Saga", "saga"),
            Map.entry("Class", "classe"),
            Map.entry("Case", "affaire"),
            Map.entry("Background", "passé"),
            Map.entry("Shard", "éclat"),
            Map.entry("Shrine", "reliquaire"),
            Map.entry("Plan", "plan"),
            Map.entry("Room", "pièce"),
            Map.entry("Plains", "plaine"),
            Map.entry("Island", "île"),
            Map.entry("Swamp", "marais"),
            Map.entry("Mountain", "montagne"),
            Map.entry("Forest", "forêt"),
            Map.entry("Cave", "caverne"),
            Map.entry("Desert", "désert"),
            Map.entry("Gate", "porte"),
            Map.entry("Lair", "repaire"),
            Map.entry("Locus", "site"),
            Map.entry("Sphere", "sphère"),
            Map.entry("Town", "ville"),
            Map.entry("Planet", "planète"),
            Map.entry("Urza's", "d'urza"),
            Map.entry("Mine", "mine"),
            Map.entry("Power-Plant", "centrale"),
            Map.entry("Tower", "tour"),
            Map.entry("Arcane", "arcane"),
            Map.entry("Lesson", "leçon"),
            Map.entry("Trap", "piège"),
            Map.entry("Chorus", "chorus"),
            Map.entry("Adventure", "aventure"),
            Map.entry("Omen", "présage")
    );

    /**
     * Ligne de type en français (Forge n'a pas de traduction pour une carte perso), comme sur les cartes françaises :
     * « Créature-artefact légendaire : golem », « Terrain de base : forêt », « Éphémère de clan : elfe ».
     */
    static String typeLine(final forge.card.CardTypeView type) {
        // Le type principal d'abord, les autres accrochés par un trait d'union (« Créature-artefact », « Terrain-artefact »).
        final CardType.CoreType[] order = {CardType.CoreType.Creature, CardType.CoreType.Planeswalker, CardType.CoreType.Land,
            CardType.CoreType.Artifact, CardType.CoreType.Enchantment, CardType.CoreType.Battle, CardType.CoreType.Instant, CardType.CoreType.Sorcery};
        final List<String> core = new ArrayList<>();
        for (final CardType.CoreType c : order) {
            if (type.hasType(c)) {
                core.add(switch (c) {
                    case Creature -> "Créature";
                    case Artifact -> "Artefact";
                    case Enchantment -> "Enchantement";
                    case Instant -> "Éphémère";
                    case Sorcery -> "Rituel";
                    case Land -> "Terrain";
                    case Battle -> "Bataille";
                    default -> c.name();
                });
            }
        }
        for (final CardType.CoreType c : type.getCoreTypes()) {
            if (!Arrays.asList(order).contains(c) && c != CardType.CoreType.Kindred) {
                core.add(c.name());
            }
        }
        final StringBuilder sb = new StringBuilder();
        for (int i = 0; i < core.size(); i++) {
            sb.append(i == 0 ? core.get(i) : "-" + core.get(i).toLowerCase(Locale.ROOT));
        }
        final boolean fem = !core.isEmpty() && "Créature".equals(core.get(0));
        if (type.hasType(CardType.CoreType.Kindred)) {
            sb.append(" de clan");
        }
        for (final CardType.Supertype st : type.getSupertypes()) {
            if (st == CardType.Supertype.Snow) {
                sb.append(fem ? " neigeuse" : " neigeux");
            }
        }
        for (final CardType.Supertype st : type.getSupertypes()) {
            sb.append(switch (st) {
                case Legendary -> " légendaire";
                case Basic -> " de base";
                case Snow -> "";
                case World -> " du monde";
                default -> " " + st.name().toLowerCase(Locale.ROOT);
            });
        }
        if (!type.getSubtypes().isEmpty()) {
            // Comme sur les cartes françaises : « Créature : elfe et druide » (un type inventé reste tel quel).
            final List<String> subs = new ArrayList<>();
            for (final String t : type.getSubtypes()) {
                String fr = French.creatureTypesFr().get(t);
                if (fr == null) {
                    fr = SUBTYPES_FR.get(t);
                }
                subs.add(fr != null ? fr : t);
            }
            final String last = subs.remove(subs.size() - 1);
            sb.append(" : ").append(subs.isEmpty() ? last : String.join(", ", subs) + " et " + last);
        }
        return sb.toString().trim();
    }

    // ------------------------------------------------------------------ synchronisation

    /** Suppressions de cartes perso (nom → date), pour qu'une carte supprimée ici le soit aussi sur les autres appareils. */
    private static File deletedFile() {
        return new File(ForgeConstants.USER_CUSTOM_DIR, "deleted.json");
    }

    private static JsonObject tombs() {
        if (deletedFile().isFile()) {
            try {
                return com.google.gson.JsonParser.parseString(read(deletedFile())).getAsJsonObject();
            } catch (final RuntimeException e) {
                // illisible : on repart de zéro
            }
        }
        return new JsonObject();
    }

    private static void tomb(final String name, final boolean add) {
        final JsonObject t = tombs();
        if (add) {
            t.addProperty(name, System.currentTimeMillis());
        } else if (t.has(name)) {
            t.remove(name);
        } else {
            return;
        }
        write(deletedFile(), t.toString());
    }

    private static long typesAt() {
        return typesFile().isFile() ? typesFile().lastModified() : 0;
    }

    /** Pour la synchronisation du compte : chaque carte (script, illustration, formulaire, date), les types perso et les suppressions. */
    static synchronized JsonObject export() {
        final JsonObject o = new JsonObject();
        final JsonArray types = new JsonArray();
        readTypes().forEach(types::add);
        o.add("types", types);
        o.addProperty("typesAt", typesAt());
        o.add("deleted", tombs());
        // Les extensions perso, avec leur logo.
        final JsonArray setList = new JsonArray();
        for (final com.google.gson.JsonElement e : readSets()) {
            final JsonObject set = e.getAsJsonObject().deepCopy();
            final File logo = setLogo(str(set, "id"));
            if (logo.isFile()) {
                try {
                    set.addProperty("logo", B64.encode(Files.readAllBytes(logo.toPath())));
                } catch (final IOException ex) {
                    // sans logo
                }
            }
            setList.add(set);
        }
        o.add("sets", setList);
        o.addProperty("setsAt", setsAt());
        final JsonObject cards = new JsonObject();
        for (final Map.Entry<String, File> e : FILES.entrySet()) {
            if (DELETED.contains(e.getKey())) {
                continue;
            }
            final JsonObject c = new JsonObject();
            c.addProperty("script", read(e.getValue()));
            c.addProperty("at", e.getValue().lastModified());
            final File form = new File(formsDir(), base(e.getValue()) + ".json");
            if (form.isFile()) {
                c.addProperty("form", read(form));
            }
            final File art = new File(artDir(), base(e.getValue()) + ".jpg");
            if (art.isFile()) {
                try {
                    c.addProperty("art", B64.encode(Files.readAllBytes(art.toPath())));
                } catch (final IOException ex) {
                    // sans illustration
                }
            }
            final File frame = new File(frameDir(), base(e.getValue()) + ".png");
            if (frame.isFile()) {
                try {
                    c.addProperty("frameImage", B64.encode(Files.readAllBytes(frame.toPath())));
                } catch (final IOException ex) {
                    // sans cadre importé
                }
            }
            cards.add(e.getKey(), c);
        }
        o.add("cards", cards);
        return o;
    }

    /**
     * Fusion de deux exports : la liste de types la plus récente, chaque carte dans sa version la plus récente (sauf si
     * elle a été supprimée depuis). À la première synchronisation d'un appareil, ses cartes ne sont jamais supprimées.
     */
    static JsonObject merge(final JsonObject local, final JsonObject remote, final boolean firstSync) {
        final JsonObject l = local == null ? new JsonObject() : local;
        final JsonObject r = remote == null ? new JsonObject() : remote;
        final JsonObject m = new JsonObject();
        final boolean localTypes = at(l, "typesAt") >= at(r, "typesAt");
        final JsonObject typesFrom = localTypes ? l : r;
        m.add("types", typesFrom.has("types") && typesFrom.get("types").isJsonArray() ? typesFrom.getAsJsonArray("types") : new JsonArray());
        m.addProperty("typesAt", at(typesFrom, "typesAt"));
        // Extensions perso : la liste la plus récente (avec leurs logos).
        final JsonObject setsFrom = at(l, "setsAt") >= at(r, "setsAt") ? l : r;
        m.add("sets", setsFrom.has("sets") && setsFrom.get("sets").isJsonArray() ? setsFrom.getAsJsonArray("sets") : new JsonArray());
        m.addProperty("setsAt", at(setsFrom, "setsAt"));

        final JsonObject tombs = new JsonObject();
        final long cutoff = System.currentTimeMillis() - 90L * 24 * 3600_000;
        for (final JsonObject src : List.of(l, r)) {
            final JsonObject d = obj(src, "deleted");
            for (final String n : d.keySet()) {
                final long t = d.get(n).getAsLong();
                if (t > cutoff && (!tombs.has(n) || tombs.get(n).getAsLong() < t)) {
                    tombs.addProperty(n, t);
                }
            }
        }
        final JsonObject localCards = obj(l, "cards");
        final JsonObject cards = new JsonObject();
        for (final JsonObject src : List.of(l, r)) {
            final JsonObject c = obj(src, "cards");
            for (final String n : c.keySet()) {
                final JsonObject card = c.getAsJsonObject(n);
                if (!cards.has(n) || at(cards.getAsJsonObject(n), "at") < at(card, "at")) {
                    cards.add(n, card);
                }
            }
        }
        for (final String n : new ArrayList<>(cards.keySet())) {
            final boolean protectedLocal = firstSync && localCards.has(n);
            if (tombs.has(n) && !protectedLocal && tombs.get(n).getAsLong() >= at(cards.getAsJsonObject(n), "at")) {
                cards.remove(n);
            }
        }
        m.add("deleted", tombs);
        m.add("cards", cards);
        return m;
    }

    /** Applique sur cet appareil le résultat d'une synchronisation : renvoie le nombre de cartes ajoutées, changées ou supprimées. */
    static synchronized int apply(final JsonObject merged) {
        if (merged == null) {
            return 0;
        }
        int changed = 0;
        // Les types d'abord : les cartes qui suivent s'en servent.
        if (at(merged, "typesAt") > typesAt() && merged.has("types") && merged.get("types").isJsonArray()) {
            final List<String> theirs = new ArrayList<>();
            merged.getAsJsonArray("types").forEach(e -> theirs.add(e.getAsString()));
            if (!theirs.equals(readTypes())) {
                try {
                    setTypes(merged.getAsJsonArray("types"));
                } catch (final RuntimeException e) {
                    System.err.println("Types perso non repris : " + e.getMessage());
                }
            }
            typesFile().setLastModified(at(merged, "typesAt"));
        }
        // Les extensions perso (avant les cartes, qui s'y rangent).
        if (at(merged, "setsAt") > setsAt() && merged.has("sets") && merged.get("sets").isJsonArray()) {
            final JsonArray list = new JsonArray();
            final Set<String> kept = new java.util.HashSet<>();
            for (final com.google.gson.JsonElement e : merged.getAsJsonArray("sets")) {
                if (!e.isJsonObject()) {
                    continue;
                }
                final JsonObject set = e.getAsJsonObject().deepCopy();
                final String id = str(set, "id");
                if (!SET_ID.matcher(id).matches()) {
                    continue;
                }
                kept.add(id);
                final String logo = str(set, "logo");
                set.remove("logo");
                set.remove("count");
                try {
                    if (logo.isEmpty()) {
                        delete(setLogo(id));
                    } else {
                        setLogo(id).getParentFile().mkdirs();
                        Files.write(setLogo(id).toPath(), B64.decode(logo));
                    }
                } catch (final IOException | RuntimeException ex) {
                    System.err.println("Logo d'extension non repris : " + ex.getMessage());
                }
                list.add(set);
            }
            for (final com.google.gson.JsonElement e : readSets()) {
                final String id = str(e.getAsJsonObject(), "id");
                if (!kept.contains(id)) {
                    delete(setLogo(id));
                }
            }
            writeSets(list);
            setsFile().setLastModified(at(merged, "setsAt"));
            setIndex = null;
            changed++;
        }
        // Suppressions faites ailleurs (après la dernière modification ici).
        final JsonObject theirTombs = obj(merged, "deleted");
        final JsonObject mine = tombs();
        boolean tombsChanged = false;
        for (final String n : theirTombs.keySet()) {
            final long t = theirTombs.get(n).getAsLong();
            if (!mine.has(n) || mine.get(n).getAsLong() < t) {
                mine.addProperty(n, t);
                tombsChanged = true;
            }
            final File here = FILES.get(n);
            if (here != null && !DELETED.contains(n) && here.lastModified() <= t) {
                remove(n);
                changed++;
            }
        }
        if (tombsChanged) {
            write(deletedFile(), mine.toString());
        }
        final JsonObject cards = obj(merged, "cards");
        // Les jetons d'abord : une carte qui en crée un est refusée tant que son jeton n'existe pas.
        final List<String> order = new ArrayList<>(cards.keySet());
        order.sort(java.util.Comparator.comparing(n -> {
            final JsonObject c = cards.getAsJsonObject(n);
            return !isTokenScript(c.has("script") ? c.get("script").getAsString() : "");
        }));
        for (final String name : order) {
            final JsonObject c = cards.getAsJsonObject(name);
            final File here = FILES.get(name);
            final boolean present = here != null && !DELETED.contains(name);
            final long at = at(c, "at");
            if (present && here.lastModified() >= at) {
                continue; // la version d'ici est aussi récente
            }
            if (mine.has(name) && mine.get(name).getAsLong() >= at) {
                continue; // supprimée ici pendant la synchronisation
            }
            try {
                final JsonObject saved = save(c.has("script") ? c.get("script").getAsString() : "", present ? name : null,
                        c.has("art") ? c.get("art").getAsString() : "", c.has("form") ? c.get("form").getAsString() : null,
                        c.has("frameImage") ? c.get("frameImage").getAsString() : "");
                final File f = FILES.get(saved.get("name").getAsString());
                if (f != null && at > 0) {
                    f.setLastModified(at);
                }
                changed++;
            } catch (final RuntimeException e) {
                System.err.println("Carte perso « " + name + " » non reprise : " + e.getMessage());
            }
        }
        return changed;
    }

    private static JsonObject obj(final JsonObject o, final String key) {
        return o != null && o.has(key) && o.get(key).isJsonObject() ? o.getAsJsonObject(key) : new JsonObject();
    }

    private static long at(final JsonObject o, final String key) {
        try {
            return o != null && o.has(key) ? o.get(key).getAsLong() : 0;
        } catch (final RuntimeException e) {
            return 0;
        }
    }

    // ------------------------------------------------------------------ fichiers

    static String nameOf(final String script) {
        for (final String line : script.replace("\r", "").split("\n")) {
            if (line.startsWith("Name:")) {
                final String n = line.substring(5).trim();
                return n.isEmpty() ? null : n;
            }
        }
        return null;
    }

    /** Nom de fichier tiré du nom de la carte : « Professeur X » → professeur_x. */
    private static String base(final String name) {
        final String s = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
        return s.isEmpty() ? "carte" : s;
    }

    private static String base(final File f) {
        final String n = f.getName();
        return n.endsWith(".txt") ? n.substring(0, n.length() - 4) : n;
    }

    /** Nom de fichier libre : celui de la carte (« gardienne_des_runes »), « atelier_… » pour un jeton (son nom pour Forge). */
    private static String unusedBase(final String name, final boolean token) {
        final String b = token ? "atelier_" + base(name) : base(name);
        final File dir = token ? tokensDir() : cardsDir();
        String candidate = b;
        for (int i = 2; new File(dir, candidate + ".txt").exists(); i++) {
            candidate = b + "_" + i;
        }
        return candidate;
    }

    private static String read(final File f) {
        try {
            return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        } catch (final IOException e) {
            return "";
        }
    }

    private static void write(final File f, final String text) {
        try {
            f.getParentFile().mkdirs();
            final File tmp = new File(f.getPath() + ".part");
            Files.write(tmp.toPath(), text.getBytes(StandardCharsets.UTF_8));
            Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (final IOException e) {
            throw new IllegalStateException("Enregistrement impossible : " + e.getMessage());
        }
    }

    private static void delete(final File f) {
        if (f != null && f.exists() && !f.delete()) {
            System.err.println("Fichier non supprimé : " + f);
        }
    }

    private static String message(final Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
        }
        final String m = t.getMessage() != null ? t.getMessage() : t.toString();
        return m.length() > 300 ? m.substring(0, 300) + "…" : m;
    }
}
