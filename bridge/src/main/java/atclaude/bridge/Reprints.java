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
     * extension perso, rareté, artiste. Le nom, le type et le texte restent ceux de la carte officielle, en français.
     */
    static void addDisplay(final JsonObject o, final JsonObject r) {
        if (!o.has("custom")) {
            // Carte officielle : le cadre dessiné de l'Atelier, texte en français. Une carte perso a déjà le sien.
            o.addProperty("custom", true);
            o.addProperty("image", "");
            o.addProperty("lang", "fr");
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
        if (o.has("text") && !o.get("text").isJsonNull() && !"en".equals(str(r, "lang"))) {
            o.addProperty("text", CustomCards.frenchText(o.get("text").getAsString()));
        }
        // Terrain de base : le rappel de mana en français, un grand symbole de mana, ou rien. En partie, Forge ne donne pas
        // de texte aux terrains de base : leur mana vient alors de leur nom.
        final String text = o.has("text") && !o.get("text").isJsonNull() ? o.get("text").getAsString().trim() : "";
        final Matcher m = BASIC_REMINDER.matcher(text);
        final String mana = m.matches() ? m.group(1) : text.isEmpty() ? basicMana(str(r, "name")) : null;
        if (mana != null) {
            switch (str(r, "landText")) {
                case "symbol" -> {
                    o.addProperty("text", "");
                    o.addProperty("landSymbol", mana);
                }
                case "none" -> o.addProperty("text", "");
                default -> o.addProperty("text", "({T} : Ajoutez " + mana + ".)");
            }
        }
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
