package atclaude.bridge;

import forge.gui.GuiBase;
import forge.localinstance.properties.ForgeConstants;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Visuels des vrais boosters (« booster:BLB », « booster:M10_2 » quand l'extension a plusieurs couvertures).
 * Forge en donne la liste (res/lists/booster-images.txt) et les fait télécharger depuis son dépôt forge-extras :
 * on fait pareil, une fois par image, puis elles restent en cache. Sans image, l'interface dessine le booster.
 */
final class BoosterArt {

    static final String PREFIX = "booster:";
    private static final String BASE = System.getProperty("atclaude.boosterArtUrl", ForgeConstants.GITHUB_ASSETS_BASE + "images/boosters/");
    private static final long RETRY_AFTER_MS = 10 * 60_000;
    private static final Map<String, Long> FAILED = new ConcurrentHashMap<>();
    private static volatile Map<String, String> files;

    private BoosterArt() { }

    /** Nom de l'image (sans extension) → nom du fichier, d'après la liste de Forge. */
    private static Map<String, String> files() {
        Map<String, String> m = files;
        if (m != null) {
            return m;
        }
        m = new HashMap<>();
        try {
            final List<String> lines = java.nio.file.Files.readAllLines(new File(ForgeConstants.IMAGE_LIST_QUEST_BOOSTERS_FILE).toPath());
            for (final String raw : lines) {
                final String line = raw.trim();
                final int dot = line.lastIndexOf('.');
                if (dot > 0 && !line.startsWith("#") && !line.contains("/")) {
                    m.put(line.substring(0, dot), line);
                }
            }
        } catch (final IOException e) {
            System.err.println("Liste des boosters illisible : " + e.getMessage());
        }
        files = m;
        return m;
    }

    /** L'extension a-t-elle au moins un visuel de booster ? */
    static boolean has(final String code) {
        return files().containsKey(code) || files().containsKey(code + "_1");
    }

    /** Image du booster demandé, téléchargée au besoin ; null si elle n'existe pas ou si le réseau manque. */
    static File file(final String key) {
        String name = key.substring(PREFIX.length());
        if (!name.matches("[A-Za-z0-9_]{1,24}")) {
            return null;
        }
        String file = files().get(name);
        if (file == null) {
            file = files().get(name + "_1");
        }
        if (file == null && name.contains("_")) {
            file = files().get(name.substring(0, name.lastIndexOf('_')));
        }
        if (file == null) {
            return null;
        }
        final File dest = new File(ForgeConstants.CACHE_BOOSTER_PICS_DIR, file);
        if (dest.isFile() && dest.length() > 0) {
            return dest;
        }
        final Long failedAt = FAILED.get(file);
        if (failedAt != null && System.currentTimeMillis() - failedAt < RETRY_AFTER_MS) {
            return null;
        }
        synchronized (BoosterArt.class) {
            if (dest.isFile() && dest.length() > 0) {
                return dest;
            }
            try {
                download(BASE + file, dest);
                return dest;
            } catch (final IOException | RuntimeException e) {
                FAILED.put(file, System.currentTimeMillis());
                System.err.println("Visuel de booster indisponible (" + file + ") : " + e.getMessage());
                return null;
            }
        }
    }

    private static void download(final String url, final File dest) throws IOException {
        final HttpURLConnection c = (HttpURLConnection) URI.create(url).toURL().openConnection();
        c.setRequestProperty("User-Agent", GuiBase.getInterface().getUserAgent());
        c.setRequestProperty("Accept", "image/*");
        c.setConnectTimeout(10_000);
        c.setReadTimeout(20_000);
        final int code = c.getResponseCode();
        if (code != 200) {
            c.disconnect();
            throw new IOException("HTTP " + code);
        }
        dest.getParentFile().mkdirs();
        final File tmp = new File(dest.getPath() + ".tmp");
        try (InputStream in = c.getInputStream()) {
            Files.copy(in, tmp.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
        if (tmp.length() == 0) {
            tmp.delete();
            throw new IOException("image vide");
        }
        Files.move(tmp.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }
}
