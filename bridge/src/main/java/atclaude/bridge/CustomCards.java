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
                if (forge.game.keyword.Keyword.getInstance(k).getKeyword() == forge.game.keyword.Keyword.UNDEFINED) {
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
            Map.entry("plainswalk", "Traversée des plaines"),
            Map.entry("islandwalk", "Traversée des îles"),
            Map.entry("swampwalk", "Traversée des marais"),
            Map.entry("mountainwalk", "Traversée des montagnes"),
            Map.entry("forestwalk", "Traversée des forêts"),
            Map.entry("hexproof", "Défense talismanique"),
            Map.entry("shroud", "Linceul"),
            Map.entry("indestructible", "Indestructible"),
            Map.entry("protection from white", "Protection contre le blanc"),
            Map.entry("protection from blue", "Protection contre le bleu"),
            Map.entry("protection from black", "Protection contre le noir"),
            Map.entry("protection from red", "Protection contre le rouge"),
            Map.entry("protection from green", "Protection contre le vert"),
            Map.entry("ward", "Parade"),
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
            Map.entry("dethrone", "Détrônement"),
            Map.entry("melee", "Mêlée"),
            Map.entry("battle cry", "Cri de guerre"),
            Map.entry("myriad", "Myriade"),
            Map.entry("evolve", "Évolution"),
            Map.entry("extort", "Extorsion"),
            Map.entry("provoke", "Provocation"),
            Map.entry("unleash", "Emportement"),
            Map.entry("decayed", "Décomposition"),
            Map.entry("partner", "Partenariat"),
            Map.entry("annihilator", "Annihilateur"),
            Map.entry("bushido", "Bushido"),
            Map.entry("toxic", "Toxique"),
            Map.entry("afflict", "Affliction"),
            Map.entry("afterlife", "Au-delà"),
            Map.entry("fabricate", "Fabrication"),
            Map.entry("rampage", "Sauvagerie"),
            Map.entry("modular", "Modularité"),
            Map.entry("renown", "Réputation"),
            Map.entry("bloodthirst", "Soif de sang"),
            Map.entry("dredge", "Dragage"),
            Map.entry("fading", "Évanescence"),
            Map.entry("vanishing", "Disparition"),
            Map.entry("cycling", "Recyclage"),
            Map.entry("flashback", "Flashback"),
            Map.entry("unearth", "Exhumation"),
            Map.entry("ninjutsu", "Ninjutsu"),
            Map.entry("dash", "Précipitation"),
            Map.entry("blitz", "Blitz"),
            Map.entry("evoke", "Évocation"),
            Map.entry("madness", "Folie"),
            Map.entry("embalm", "Embaumement"),
            Map.entry("eternalize", "Éternalisation"),
            Map.entry("encore", "Encore"),
            Map.entry("morph", "Mue"),
            Map.entry("disguise", "Déguisement"),
            Map.entry("scavenge", "Récupération"),
            Map.entry("outlast", "Résilience"),
            Map.entry("equip", "Équipement"),
            Map.entry("convoke", "Convocation"),
            Map.entry("delve", "Fouille"),
            Map.entry("improvise", "Improvisation"),
            Map.entry("storm", "Déluge"),
            Map.entry("split second", "Fraction de seconde"),
            Map.entry("rebound", "Rebond"));
    /** Mot-clé avec sa valeur, tel que Forge l'écrit (« Annihilator 2 », « Cycling {1}{U} », « Ward {3} »). */
    /** Ligne de mot-clé avec son texte de rappel (« Undying (When this creature dies, …) ») : le rappel en anglais tombe. */
    private static final Pattern REMINDER = Pattern.compile("^(.*?)\\s*\\((?:[^()]|\\([^()]*\\))*\\)$");
    private static final Pattern KEYWORD_VALUE = Pattern.compile("^(.+?)\\s+((?:\\{[^}]*\\})+|\\d+)$");
    private static final Pattern COUNTERS_LINE = Pattern.compile("^(.+) counters: (\\d+)$");

    /**
     * Texte d'une carte perso en partie, en français : Forge y ajoute en anglais les mots-clés qu'elle a ou qu'on
     * lui donne (« Haste, flying ») et ses marqueurs (« +1/+1 counters: 2 »).
     */
    static String frenchText(final String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        final StringBuilder out = new StringBuilder(text.length());
        // « Choisissez l'un — » : Forge écrit toujours en anglais la tête d'une capacité à modes.
        final String[] lines = text.replace("Choose one or more —", "Choisissez un ou plusieurs —").replace("choose one or more —", "choisissez un ou plusieurs —")
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
            final String[] parts = core.split(",\\s*");
            final List<String> fr = new ArrayList<>();
            for (final String part : parts) {
                String k = KEYWORDS_FR.get(part.trim().toLowerCase(Locale.ROOT));
                if (k == null) {
                    final java.util.regex.Matcher v = KEYWORD_VALUE.matcher(part.trim());
                    final String name = v.matches() ? KEYWORDS_FR.get(v.group(1).toLowerCase(Locale.ROOT)) : null;
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
        if (rules != null && rules.getMainPart() != null) {
            for (final Map.Entry<String, String> v : rules.getMainPart().getVariables()) {
                final String value = v.getValue() == null ? "" : v.getValue().trim();
                if (!FRAME_VALUE.matcher(value).matches()) {
                    continue;
                }
                switch (v.getKey()) {
                    case "AtelierFrame" -> frame = value;
                    case "AtelierFrameColor" -> color = value;
                    case "AtelierLang" -> lang = "en".equals(value) ? "en" : "fr";
                    case "AtelierFrameText" -> text = "light".equals(value) ? "light" : "dark";
                    case "AtelierFx" -> fx = value;
                    default -> { }
                }
            }
        }
        o.addProperty("frame", frame);
        o.addProperty("frameColor", color);
        o.addProperty("lang", lang);
        o.addProperty("frameText", text);
        o.addProperty("fx", fx);
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

    /** Ligne de type en français (Forge n'a pas de traduction pour une carte perso) : « Créature légendaire : Human X-Men ». */
    static String typeLine(final forge.card.CardTypeView type) {
        final List<String> core = new ArrayList<>();
        for (final CardType.CoreType c : type.getCoreTypes()) {
            core.add(switch (c) {
                case Creature -> "Créature";
                case Artifact -> "Artefact";
                case Enchantment -> "Enchantement";
                case Instant -> "Éphémère";
                case Sorcery -> "Rituel";
                case Land -> "Terrain";
                case Battle -> "Bataille";
                case Kindred -> "Tribal";
                default -> c.name();
            });
        }
        final StringBuilder sb = new StringBuilder(String.join(" ", core));
        for (final CardType.Supertype st : type.getSupertypes()) {
            sb.append(switch (st) {
                case Legendary -> " légendaire";
                case Basic -> " de base";
                case Snow -> " neigeux";
                case World -> " du monde";
                default -> " " + st.name().toLowerCase(Locale.ROOT);
            });
        }
        if (!type.getSubtypes().isEmpty()) {
            // Comme sur les cartes françaises : « Créature : elfe et druide » (un type inventé reste tel quel).
            final List<String> subs = new ArrayList<>();
            for (final String t : type.getSubtypes()) {
                final String fr = French.creatureTypesFr().get(t);
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
