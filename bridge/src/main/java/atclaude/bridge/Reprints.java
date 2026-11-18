package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.card.CardDb;
import forge.card.CardRarity;
import forge.card.CardRules;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;
import forge.model.FModel;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Réimpressions de l'Atelier : une carte officielle (Sol Ring…) avec une illustration perso, rangée dans une extension
 * perso, avec sa rareté, son artiste et son cadre dessiné. Les règles restent celles de Forge : chaque réimpression est
 * une vraie impression de la carte dans l'édition « ATRP » (déclarée au démarrage, datée de 1990 : elle ne devient jamais
 * l'impression par défaut d'une carte), avec son numéro d'illustration ; elle se choisit dans le deck builder comme les
 * autres impressions et se joue en partie avec son illustration.
 */
final class Reprints {

    static final String EDITION = "ATRP";
    static final String ART_PREFIX = "reprint:";
    private static final Pattern ID = Pattern.compile("[a-z0-9]{1,20}");
    private static final Pattern FRAME_VALUE = Pattern.compile("[A-Za-z0-9_-]{1,20}");
    private static final Pattern IMAGE_KEY = Pattern.compile("\\|" + EDITION + "\\|(\\d+)");
    /** Le rappel de mana d'un terrain de base (« ({T}: Add {W}.) », ou déjà en français). */
    static final Pattern BASIC_REMINDER = Pattern.compile("^\\(\\{T\\}\\s?: (?:Add|Ajoutez) ((?:\\{[WUBRGCS]\\})+)(?: à votre réserve)?\\.\\)$");

    /** Mana d'un terrain de base d'après son nom (« Plains », « Snow-Covered Forest »…), ou null. */
    static String basicMana(final String name) {
        return switch (name.replaceFirst("^Snow-Covered ", "")) {
            case "Plains" -> "{W}";
            case "Island" -> "{U}";
            case "Swamp" -> "{B}";
            case "Mountain" -> "{R}";
            case "Forest" -> "{G}";
            case "Wastes" -> "{C}";
            default -> null;
        };
    }

    private static volatile List<JsonObject> cache;

    private Reprints() { }

    // ------------------------------------------------------------------ fichiers

    private static File file() {
        return new File(ForgeConstants.USER_CUSTOM_DIR, "reprints.json");
    }

    private static File artDir() {
        return new File(ForgeConstants.USER_CUSTOM_DIR, "reprints");
    }

    private static File artFile(final String id) {
        return new File(artDir(), id + ".jpg");
    }

    /**
     * Avant le chargement de Forge : l'édition des réimpressions, dans les éditions perso que Forge lit au démarrage
     * (sans carte : chaque réimpression est ajoutée ensuite, avec son numéro d'illustration).
     */
    static void prepareEdition(final File editionsDir) {
        final String text = "[metadata]\nCode=" + EDITION + "\nDate=1990-01-01\nName=Atelier - réimpressions\nType=Other\n\n[cards]\n";
        try {
            editionsDir.mkdirs();
            final File f = new File(editionsDir, EDITION + ".txt");
            if (!f.isFile() || !text.equals(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8))) {
                Files.write(f.toPath(), text.getBytes(StandardCharsets.UTF_8));
            }
        } catch (final IOException e) {
            System.err.println("Édition des réimpressions non écrite : " + e.getMessage());
        }
    }

    /** Les réimpressions enregistrées (copie de la liste). */
    static List<JsonObject> all() {
        List<JsonObject> list = cache;
        if (list == null) {
            synchronized (Reprints.class) {
                list = cache;
                if (list == null) {
                    list = new ArrayList<>();
                    final File f = file();
                    if (f.isFile()) {
                        try {
                            final JsonObject o = JsonParser.parseString(Io.read(f)).getAsJsonObject();
                            for (final JsonElement e : o.getAsJsonArray("reprints")) {
                                if (e.isJsonObject() && ID.matcher(str(e.getAsJsonObject(), "id")).matches()) {
                                    list.add(e.getAsJsonObject());
                                }
                            }
                        } catch (final IOException | RuntimeException e) {
                            System.err.println("Réimpressions illisibles : " + e.getMessage());
                        }
                    }
                    cache = list;
                }
            }
        }
        return new ArrayList<>(list);
    }

    private static void write(final List<JsonObject> list) {
        final JsonArray a = new JsonArray();
        list.forEach(a::add);
        final JsonObject o = new JsonObject();
        o.add("reprints", a);
        try {
            file().getParentFile().mkdirs();
            Files.write(file().toPath(), o.toString().getBytes(StandardCharsets.UTF_8));
        } catch (final IOException e) {
            throw new IllegalStateException("Réimpressions non enregistrées : " + e.getMessage());
        }
        cache = list;
    }

    /** Date de la dernière modification (synchronisation). */
    static long at() {
        return file().isFile() ? file().lastModified() : 0;
    }

    static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : "";
    }

    private static int art(final JsonObject r) {
        try {
            return r.has("art") ? r.get("art").getAsInt() : 0;
        } catch (final RuntimeException e) {
            return 0;
        }
    }

    // ------------------------------------------------------------------ Forge

    /** Après le chargement de Forge : chaque réimpression devient une impression de sa carte. */
    static void init() {
        for (final JsonObject r : all()) {
            register(r);
        }
    }

    private static CardRarity rarity(final String r) {
        return switch (r) {
            case "C" -> CardRarity.Common;
            case "U" -> CardRarity.Uncommon;
            case "R" -> CardRarity.Rare;
            case "M" -> CardRarity.MythicRare;
            default -> CardRarity.Special;
        };
    }

    /**
     * Les règles d'une carte qu'on peut réimprimer : une carte officielle, ou une carte perso de l'Atelier (une autre
     * illustration sans doublon renommé). Null pour un jeton ou un nom inconnu. Une carte perso modifiée garde le même
     * objet de règles (Forge le met à jour sur place) : ses réimpressions suivent.
     */
    private static CardRules official(final String name) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        if (CustomCards.isCustom(name)) {
            return CustomCards.isToken(name) ? null : CustomCards.rules(name);
        }
        final CardRules r = FModel.getMagicDb().getCommonCards().getRules(name, false);
        return r == null || r.isCustom() ? null : r;
    }

    /** Une carte perso renommée : ses réimpressions la suivent. */
    static synchronized void renamed(final String before, final String after) {
        final List<JsonObject> list = all();
        boolean changed = false;
        for (final JsonObject r : list) {
            if (str(r, "name").equals(before)) {
                r.addProperty("name", after);
                changed = true;
            }
        }
        if (changed) {
            write(list);
            list.forEach(Reprints::register);
        }
    }

    private static void register(final JsonObject r) {
        final CardRules rules = official(str(r, "name"));
        final int art = art(r);
        if (rules == null || art <= 0) {
            return;
        }
        final CardDb db = FModel.getMagicDb().getCommonCards();
        if (exact(rules.getName(), art) == null) {
            try {
                db.addCard(new PaperCard(rules, EDITION, rarity(str(r, "rarity")), art, false, "", str(r, "artist"), ""));
            } catch (final RuntimeException e) {
                System.err.println("Réimpression non ajoutée (" + rules.getName() + ") : " + e);
            }
        }
    }

    /** Une impression de la carte qui n'est pas une réimpression de l'Atelier (null s'il n'y en a pas). */
    private static PaperCard plain(final String name) {
        for (final PaperCard pc : FModel.getMagicDb().getCommonCards().getAllCards(name)) {
            if (!EDITION.equals(pc.getEdition())) {
                return pc;
            }
        }
        return null;
    }

    /** L'impression Forge d'une réimpression (null si la carte n'existe plus). */
    static PaperCard paper(final JsonObject r) {
        final CardRules rules = official(str(r, "name"));
        return rules == null ? null : exact(rules.getName(), art(r));
    }

    /**
     * L'impression « ATRP » de ce numéro d'illustration, ou null (getCard de Forge renverrait une autre impression de la
     * carte quand celle-ci n'existe pas).
     */
    private static PaperCard exact(final String name, final int art) {
        for (final PaperCard pc : FModel.getMagicDb().getCommonCards().getAllCards(name)) {
            if (EDITION.equals(pc.getEdition()) && pc.getArtIndex() == art) {
                return pc;
            }
        }
        return null;
    }

    /** La réimpression de cette impression de Forge (null si ce n'en est pas une, ou si elle a été supprimée). */
    static JsonObject of(final PaperCard pc) {
        return pc == null || !EDITION.equals(pc.getEdition()) ? null : find(pc.getName(), pc.getArtIndex());
    }

    /** La réimpression d'une carte en partie, d'après sa clé d'image (« c:Sol Ring|ATRP|2 »). */
    static JsonObject ofImageKey(final String name, final String imageKey) {
        if (imageKey == null || !imageKey.contains("|" + EDITION + "|")) {
            return null;
        }
        final Matcher m = IMAGE_KEY.matcher(imageKey);
        return m.find() ? find(name, Integer.parseInt(m.group(1))) : null;
    }

    private static JsonObject find(final String name, final int art) {
        for (final JsonObject r : all()) {
            if (str(r, "name").equalsIgnoreCase(name) && art(r) == art) {
                return r;
            }
        }
        return null;
    }

    static JsonObject byId(final String id) {
        for (final JsonObject r : all()) {
            if (str(r, "id").equals(id)) {
                return r;
            }
        }
        return null;
    }

    /** Une réimpression de cette carte rangée dans cette extension perso (son impression Forge), ou null. */
    static PaperCard inSet(final String setId, final String name) {
        for (final JsonObject r : all()) {
            if (str(r, "set").equals(setId) && str(r, "name").equalsIgnoreCase(name)) {
                final PaperCard pc = paper(r);
                if (pc != null) {
                    return pc;
                }
            }
        }
        return null;
    }

    /** Clé d'index de la réimpression (numéros des extensions perso). */
    static String indexKey(final JsonObject r) {
        return ART_PREFIX + str(r, "id");
    }

    /** Illustration d'une réimpression (clé « reprint:id:date »), ou null. */
    static File art(final String key) {
        final String rest = key.startsWith(ART_PREFIX) ? key.substring(ART_PREFIX.length()) : key;
        final int colon = rest.indexOf(':');
        final String id = colon < 0 ? rest : rest.substring(0, colon);
        if (!ID.matcher(id).matches()) {
            return null;
        }
        final File f = artFile(id);
        return f.isFile() ? f : null;
    }

    private static String artKey(final JsonObject r) {
        final File f = artFile(str(r, "id"));
        return f.isFile() ? ART_PREFIX + str(r, "id") + ":" + f.lastModified() : null;
    }

    /**
     * Présentation d'une réimpression, ajoutée à la carte (catalogue, partie) : cadre dessiné avec son illustration,
     * extension perso, rareté, artiste. Le nom, le type et le texte restent ceux de la carte officielle, en français (ou en
     * anglais : réimpression « en »).
     */
    static void addDisplay(final JsonObject o, final JsonObject r) {
        final boolean official = !o.has("custom");
        // Réimpression en anglais d'une carte officielle : son nom, son type et son texte anglais, comme imprimée.
        final boolean english = official && "en".equals(str(r, "lang"));
        if (official) {
            // Carte officielle : le cadre dessiné de l'Atelier, texte en français. Une carte perso a déjà le sien.
            o.addProperty("custom", true);
            o.addProperty("image", "");
            o.addProperty("lang", "fr");
        }
        if (english) {
            english(o, official(str(r, "name")));
        }
        o.addProperty("reprint", true);
        o.addProperty("reprintId", str(r, "id"));
        o.addProperty("frame", value(r, "frame", "modern"));
        o.addProperty("frameColor", value(r, "frameColor", "auto"));
        o.addProperty("frameText", "light".equals(str(r, "frameText")) ? "light" : "dark");
        o.addProperty("fx", value(r, "fx", "none"));
        final String rarity = str(r, "rarity");
        o.remove("crarity");
        if (rarity.matches("[CURMS]")) {
            o.addProperty("crarity", rarity);
        }
        final String artist = str(r, "artist");
        o.remove("artist");
        if (!artist.isEmpty()) {
            o.addProperty("artist", artist);
        }
        // Texte d'ambiance de la réimpression (sinon celui de la carte perso qu'elle réimprime, s'il y en a un).
        final String flavor = str(r, "flavor");
        if (!flavor.isEmpty()) {
            o.addProperty("flavor", flavor);
        }
        // Classe, affaire : les lignes que Forge écrit en anglais (rappel, « Level 2 », « Solved »), en français.
        if (o.has("text") && !o.get("text").isJsonNull() && !english && !"en".equals(str(o, "lang"))) {
            o.addProperty("text", CustomCards.frenchText(o.get("text").getAsString()));
        }
        // Terrain de base : le rappel de mana en français, un grand symbole de mana, ou rien. En partie, Forge ne donne pas
        // de texte aux terrains de base : leur mana vient alors de leur nom.
        final String text = o.has("text") && !o.get("text").isJsonNull() ? o.get("text").getAsString().trim() : "";
        final Matcher m = BASIC_REMINDER.matcher(text);
        // Un terrain de base garde son mana même si son texte est autre chose (ancien texte de Scryfall : « R »).
        final String basic = basicMana(str(r, "name"));
        final String mana = m.matches() ? m.group(1) : text.isEmpty() || basic != null ? basic : null;
        if (mana != null) {
            switch (str(r, "landText")) {
                case "symbol" -> {
                    o.addProperty("text", "");
                    o.addProperty("landSymbol", mana);
                }
                case "none" -> o.addProperty("text", "");
                default -> o.addProperty("text", english ? "({T}: Add " + mana + ".)" : "({T} : Ajoutez " + mana + ".)");
            }
        }
        altName(o, r);
        shownText(o, r);
        final JsonObject cs = CustomCards.csetJson(str(r, "set"), indexKey(r));
        o.remove("cset");
        if (cs != null) {
            o.add("cset", cs);
        }
        final String art = artKey(r);
        o.remove("customArt");
        if (art != null) {
            o.addProperty("customArt", art);
        }
    }

    /**
     * Autre nom (comme les cartes Universes Beyond : « Hérauts de Shredder » sur la carte, « Ardeur » en petit dessous) :
     * il s'affiche en titre, le nom officiel passe dans un bandeau sous le titre, et le texte de la carte cite l'autre
     * nom (sauf si la réimpression le refuse). Le nom officiel reste celui de la carte pour les règles, les decks et la
     * recherche.
     */
    private static void altName(final JsonObject o, final JsonObject r) {
        final String alt = str(r, "altName");
        if (alt.isEmpty()) {
            return;
        }
        final String shown = str(o, "nameFr").isEmpty() ? str(o, "name") : str(o, "nameFr");
        o.addProperty("altName", alt);
        o.addProperty("subName", shown);
        o.addProperty("nameFr", alt);
        if (!"no".equals(str(r, "altInText")) && o.has("text") && !o.get("text").isJsonNull()) {
            String text = o.get("text").getAsString();
            for (final String n : new java.util.LinkedHashSet<>(java.util.List.of(shown, str(o, "name"), str(r, "name")))) {
                if (n.length() >= 2) {
                    // « l'Ardeur », « la Ardeur » : l'article du nom officiel part avec lui (« l'Hérauts de Shredder » sonnerait faux).
                    text = Pattern.compile("(?<![\\p{L}\\p{N}])(?:[Ll](?:['’]|[ae] ))?" + Pattern.quote(n) + "(?![\\p{L}\\p{N}])")
                            .matcher(text).replaceAll(Matcher.quoteReplacement(alt));
                }
            }
            o.addProperty("text", text);
        }
    }

    /** Texte affiché choisi pour la réimpression (seulement ce que la carte montre : les règles ne changent pas). */
    private static void shownText(final JsonObject o, final JsonObject r) {
        final String shown = str(r, "shownText");
        if (!shown.isEmpty()) {
            o.addProperty("text", shown);
            o.remove("landSymbol");
        }
    }

    /** Autres noms des réimpressions, par carte officielle (normalisés pour la recherche : « shredder » trouve la carte). */
    static java.util.Map<String, String> altNameIndex() {
        final java.util.Map<String, String> out = new java.util.HashMap<>();
        for (final JsonObject r : all()) {
            final String alt = str(r, "altName");
            if (!alt.isEmpty()) {
                out.merge(str(r, "name"), Catalog.normalize(alt), (a, b) -> a + "\n" + b);
            }
        }
        return out;
    }

    /** La réimpression de cette carte dont l'autre nom correspond à ce qui est tapé (texte et mots normalisés), ou null. */
    static PaperCard byAltName(final String name, final String text, final String[] stems) {
        for (final JsonObject r : all()) {
            final String alt = Catalog.normalize(str(r, "altName"));
            if (alt.isEmpty() || !str(r, "name").equalsIgnoreCase(name)) {
                continue;
            }
            boolean hit = alt.contains(text);
            if (!hit) {
                hit = true;
                for (final String w : stems) {
                    hit &= alt.contains(w);
                }
            }
            if (hit) {
                return paper(r);
            }
        }
        return null;
    }

    /** « Stomp {1}{R} — Instant - Adventure » : le tiret de Forge devient le tiret long des cartes. */
    private static final Pattern ADVENTURE_HEAD = Pattern.compile("(?m)^(.+? — [A-Z][\\w ]*?) - ([A-Z].*)$");

    /**
     * Le nom, le type et le texte anglais de la carte. Catalogue : ceux que la carte donne déjà (nom, typeEn, textEn,
     * verso compris). En partie : ceux de la face visible (le verso d'une carte transformée).
     */
    private static void english(final JsonObject o, final CardRules rules) {
        if (rules == null) {
            return;
        }
        o.addProperty("lang", "en");
        if (o.has("textEn")) {
            englishCatalog(o);
            if (o.has("back") && o.get("back").isJsonObject()) {
                englishCatalog(o.getAsJsonObject("back"));
            }
            return;
        }
        final forge.card.ICardFace main = rules.getMainPart();
        final forge.card.ICardFace other = rules.getOtherPart();
        final forge.card.ICardFace face = other != null && str(o, "oracleName").equals(other.getName()) ? other : main;
        if (face == null) {
            return;
        }
        o.addProperty("name", face.getName());
        o.addProperty("nameFr", face.getName());
        o.addProperty("typeLine", CustomCards.typeLine(face.getType(), "en"));
        String text = face.getOracleText() == null ? "" : face.getOracleText();
        if (face == main && other != null && rules.getSplitType() == forge.card.CardSplitType.Adventure) {
            // Aventure : le sort imprimé sous le texte de la créature.
            final String cost = other.getManaCost() == null || other.getManaCost().isNoCost() ? "" : " " + other.getManaCost();
            text = (text.trim().isEmpty() ? "" : text + "\n\n") + other.getName() + cost + " — " + CustomCards.typeLine(other.getType(), "en")
                    + "\n" + (other.getOracleText() == null ? "" : other.getOracleText());
        }
        o.addProperty("text", text.replace("\\n", "\n").trim());
    }

    /** En partie, l'autre face d'une réimpression en anglais (verso transformable, sort d'aventure) : en anglais aussi. */
    static void englishBack(final JsonObject back, final String reprintId) {
        final JsonObject r = byId(reprintId);
        if (r != null && "en".equals(str(r, "lang"))) {
            english(back, official(str(r, "name")));
        }
    }

    private static void englishCatalog(final JsonObject o) {
        if (o.has("name")) {
            o.addProperty("nameFr", str(o, "name"));
        }
        if (o.has("typeEn")) {
            o.addProperty("typeLine", str(o, "typeEn").replace(" - ", " — "));
        }
        o.addProperty("text", ADVENTURE_HEAD.matcher(str(o, "textEn")).replaceAll("$1 — $2"));
    }

    private static String value(final JsonObject r, final String key, final String def) {
        final String v = str(r, key);
        return FRAME_VALUE.matcher(v).matches() ? v : def;
    }

    /** Les réimpressions pour l'Atelier : chacune avec la carte telle qu'elle s'affiche. */
    static JsonArray json() {
        final JsonArray out = new JsonArray();
        for (final JsonObject r : all()) {
            final PaperCard pc = paper(r);
            if (pc == null) {
                continue;
            }
            final JsonObject o = r.deepCopy();
            o.add("card", Catalog.paperJson(pc));
            o.addProperty("nameFr", French.cardName(pc.getName()));
            // La carte telle que la donne le catalogue (une impression qui n'est pas une réimpression) : son nom, son type
            // et son texte en français et en anglais, pour changer la langue d'une réimpression déjà enregistrée.
            final PaperCard plain = plain(pc.getName());
            if (plain != null) {
                o.add("base", Catalog.paperJson(plain));
            }
            out.add(o);
        }
        return out;
    }

    // ------------------------------------------------------------------ Atelier

    /**
     * Crée ou modifie une réimpression : {id (absent : nouvelle), name (la carte officielle), set, rarity, artist, frame,
     * frameColor, frameText, fx, art (JPEG en data URL ; "" la retire ; absent la garde)}.
     */
    static synchronized JsonObject save(final JsonObject m) {
        final String id = str(m, "id");
        JsonObject old = id.isEmpty() ? null : byId(id);
        if (!id.isEmpty() && old == null) {
            throw new IllegalArgumentException("Réimpression introuvable.");
        }
        final String name = old != null ? str(old, "name") : str(m, "name").trim();
        final CardRules rules = official(name);
        if (rules == null) {
            throw new IllegalArgumentException("« " + name + " » ne peut pas être réimprimée (carte inconnue ou jeton).");
        }
        final List<JsonObject> list = all();
        final JsonObject r = old != null ? old.deepCopy() : new JsonObject();
        if (old == null) {
            String nid;
            do {
                nid = Long.toString(System.nanoTime() & 0xFFFFFFFFFFL, 36);
            } while (byId(nid) != null);
            r.addProperty("id", nid);
            r.addProperty("name", rules.getName());
            // Le premier numéro d'illustration libre pour cette carte dans l'édition des réimpressions.
            final java.util.Set<Integer> used = new java.util.HashSet<>();
            for (final JsonObject x : list) {
                if (str(x, "name").equalsIgnoreCase(rules.getName())) {
                    used.add(art(x));
                }
            }
            int art = 1;
            while (used.contains(art)) {
                art++;
            }
            r.addProperty("art", art);
        }
        final String set = str(m, "set");
        r.addProperty("set", set.isEmpty() || ID.matcher(set).matches() ? set : "");
        r.addProperty("rarity", str(m, "rarity").matches("[CURMS]") ? str(m, "rarity") : "");
        r.addProperty("artist", str(m, "artist").replaceAll("[|\\r\\n]+", " ").replaceAll("\\s+", " ").trim());
        for (final String k : new String[] {"frame", "frameColor", "frameText", "fx"}) {
            final String v = str(m, k);
            r.addProperty(k, FRAME_VALUE.matcher(v).matches() ? v : "");
        }
        // Terrain de base : rappel de mana (par défaut), grand symbole ou rien ; texte d'ambiance (240 caractères au plus).
        r.addProperty("landText", str(m, "landText").matches("symbol|none") ? str(m, "landText") : "");
        // Langue du nom, du type et du texte d'une carte officielle réimprimée (« en » ; sinon le français).
        r.addProperty("lang", "en".equals(str(m, "lang")) ? "en" : "");
        // Autre nom (comme les cartes Universes Beyond), 60 caractères au plus ; « no » : le texte garde le nom officiel.
        final String alt = str(m, "altName").replaceAll("[|\\r\\n]+", " ").replaceAll("\\s+", " ").trim();
        r.addProperty("altName", alt.length() > 60 ? alt.substring(0, 60).trim() : alt);
        r.addProperty("altInText", "no".equals(str(m, "altInText")) ? "no" : "");
        // Texte affiché à la place du texte officiel (1500 caractères au plus) ; vide : le texte de la carte.
        final String shownText = str(m, "shownText").replace("\r", "").replace("|", "/").trim();
        r.addProperty("shownText", shownText.length() > 1500 ? shownText.substring(0, 1500) : shownText);
        final String flavor = str(m, "flavor").replace("\r", "").replace("|", "/").trim();
        r.addProperty("flavor", flavor.length() > 240 ? flavor.substring(0, 240) : flavor);
        r.addProperty("at", System.currentTimeMillis());
        if (m.has("art") && !m.get("art").isJsonNull()) {
            final String data = m.get("art").getAsString();
            try {
                if (data.isEmpty()) {
                    Files.deleteIfExists(artFile(str(r, "id")).toPath());
                } else {
                    final int comma = data.indexOf(',');
                    final byte[] bytes = B64.decode(comma >= 0 ? data.substring(comma + 1) : data);
                    if (bytes.length > 4_000_000) {
                        throw new IllegalArgumentException("Illustration trop lourde.");
                    }
                    artDir().mkdirs();
                    Files.write(artFile(str(r, "id")).toPath(), bytes);
                }
            } catch (final IOException e) {
                throw new IllegalStateException("Illustration non enregistrée : " + e.getMessage());
            }
        }
        list.removeIf(x -> str(x, "id").equals(str(r, "id")));
        list.add(r);
        list.sort(Collections.reverseOrder((a, b) -> Long.compare(a.has("at") ? a.get("at").getAsLong() : 0, b.has("at") ? b.get("at").getAsLong() : 0)));
        write(list);
        register(r);
        CustomCards.changed();
        final JsonObject state = CustomCards.state();
        state.addProperty("savedReprint", str(r, "id"));
        return state;
    }

    static synchronized JsonObject delete(final String id) {
        final List<JsonObject> list = all();
        if (list.removeIf(x -> str(x, "id").equals(id))) {
            write(list);
            try {
                Files.deleteIfExists(artFile(id).toPath());
            } catch (final IOException e) {
                // illustration orpheline : sans effet
            }
            CustomCards.changed();
        }
        return CustomCards.state();
    }

    // ------------------------------------------------------------------ synchronisation

    /** Les réimpressions avec leur illustration (synchronisation du compte). */
    static JsonArray export() {
        final JsonArray out = new JsonArray();
        for (final JsonObject r : all()) {
            final JsonObject o = r.deepCopy();
            final File f = artFile(str(r, "id"));
            if (f.isFile()) {
                try {
                    o.addProperty("artData", B64.encode(Files.readAllBytes(f.toPath())));
                } catch (final IOException e) {
                    // sans illustration
                }
            }
            out.add(o);
        }
        return out;
    }

    /** Remplace les réimpressions de cet appareil par celles d'une synchronisation plus récente. */
    static synchronized void apply(final JsonArray theirs, final long at) {
        final List<JsonObject> list = new ArrayList<>();
        final java.util.Set<String> kept = new java.util.HashSet<>();
        for (final JsonElement e : theirs) {
            if (!e.isJsonObject()) {
                continue;
            }
            final JsonObject r = e.getAsJsonObject().deepCopy();
            final String id = str(r, "id");
            if (!ID.matcher(id).matches() || kept.contains(id)) {
                continue;
            }
            kept.add(id);
            final String data = str(r, "artData");
            r.remove("artData");
            r.remove("card");
            r.remove("nameFr");
            try {
                if (data.isEmpty()) {
                    Files.deleteIfExists(artFile(id).toPath());
                } else {
                    artDir().mkdirs();
                    Files.write(artFile(id).toPath(), B64.decode(data));
                }
            } catch (final IOException | RuntimeException ex) {
                System.err.println("Illustration de réimpression non reprise : " + ex.getMessage());
            }
            list.add(r);
        }
        for (final JsonObject r : all()) {
            if (!kept.contains(str(r, "id"))) {
                try {
                    Files.deleteIfExists(artFile(str(r, "id")).toPath());
                } catch (final IOException e) {
                    // sans effet
                }
            }
        }
        write(list);
        file().setLastModified(at);
        list.forEach(Reprints::register);
        CustomCards.changed();
    }

}
