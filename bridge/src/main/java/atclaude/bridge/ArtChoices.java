package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;
import forge.util.ImageUtil;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Illustrations choisies dans le deck builder : ces impressions s'affichent telles quelles (en français si cette
 * impression existe en français, sinon en anglais), jamais remplacées par une autre impression traduite.
 * La liste suit le compte (fusionnée lors de la synchronisation).
 */
final class ArtChoices {

    private static final Set<String> KEYS = ConcurrentHashMap.newKeySet();
    private static volatile boolean loaded;

    private ArtChoices() { }

    static File file() {
        return new File(ForgeConstants.USER_DIR, "atclaude-arts.json");
    }

    private static void ensureLoaded() {
        if (loaded) {
            return;
        }
        synchronized (ArtChoices.class) {
            if (loaded) {
                return;
            }
            final File f = file();
            if (f.isFile()) {
                try {
                    final JsonObject o = JsonParser.parseString(Io.read(f)).getAsJsonObject();
                    for (final JsonElement e : o.getAsJsonArray("prints")) {
                        KEYS.add(e.getAsString());
                    }
                } catch (final IOException | RuntimeException e) {
                    System.err.println("Choix d'illustrations illisibles : " + e.getMessage());
                }
            }
            loaded = true;
        }
    }

    /** Fichier d'image (clé de cache de Forge) d'une impression choisie. */
    static boolean isChosen(final String fileKey) {
        ensureLoaded();
        return fileKey != null && KEYS.contains(fileKey);
    }

    /** Retient l'impression de cette clé d'image (« c:Nom|SET|art »), recto et verso. */
    static void choose(final String imageKey) {
        ensureLoaded();
        final PaperCard pc = ImageUtil.getPaperCardFromImageKey(imageKey);
        if (pc == null) {
            throw new IllegalArgumentException("Impression inconnue : " + imageKey);
        }
        boolean changed = KEYS.add(pc.getCardImageKey());
        if (pc.hasBackFace()) {
            changed |= KEYS.add(pc.getCardAltImageKey());
        }
        if (changed) {
            store();
        }
    }

    static JsonArray json() {
        ensureLoaded();
        final JsonArray a = new JsonArray();
        KEYS.stream().sorted().forEach(a::add);
        return a;
    }

    /** Ajoute les choix venus d'un autre appareil ; renvoie le nombre de nouveaux. */
    static int mergeIn(final JsonArray other) {
        ensureLoaded();
        int added = 0;
        if (other != null) {
            for (final JsonElement e : other) {
                if (e.isJsonPrimitive() && KEYS.add(e.getAsString())) {
                    added++;
                }
            }
        }
        if (added > 0) {
            store();
        }
        return added;
    }

    /** Union de deux listes (synchronisation). */
    static JsonArray merge(final JsonArray a, final JsonArray b) {
        final java.util.TreeSet<String> all = new java.util.TreeSet<>();
        for (final JsonArray list : new JsonArray[] {a, b}) {
            if (list != null) {
                list.forEach(e -> all.add(e.getAsString()));
            }
        }
        final JsonArray out = new JsonArray();
        all.forEach(out::add);
        return out;
    }

    private static synchronized void store() {
        final JsonObject o = new JsonObject();
        o.addProperty("version", 1);
        o.add("prints", json());
        try {
            final File f = file();
            f.getParentFile().mkdirs();
            final File tmp = new File(f.getPath() + ".tmp");
            Io.write(tmp, o.toString());
            Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (final IOException e) {
            System.err.println("Choix d'illustrations non enregistrés : " + e.getMessage());
        }
    }
}
