package atclaude.bridge;

import forge.gui.GuiBase;
import forge.localinstance.properties.ForgeConstants;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

/**
 * Dos de carte Magic, pour l'apparence « Magic » des cartes cachées et de la bibliothèque.
 * Il n'est pas fourni avec Forge : téléchargé une fois depuis Scryfall (comme les images de cartes), puis gardé en cache.
 * Sans réseau, l'interface dessine un dos de remplacement.
 */
final class CardBacks {

    static final String PREFIX = "back:";
    /** Dos standard des cartes Magic chez Scryfall (identifiant « card_back_id » des cartes normales). */
    private static final String MAGIC_URL = System.getProperty("atclaude.cardBackUrl",
            "https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg");
    private static final long RETRY_AFTER_MS = 5 * 60_000;
    private static volatile long failedAt;

    private CardBacks() { }

    /** Fichier du dos demandé (« back:magic »), téléchargé au besoin ; null s'il n'est pas disponible. */
    static synchronized File file(final String key) {
        if (!(PREFIX + "magic").equals(key)) {
            return null;
        }
        final File file = new File(ForgeConstants.CACHE_DIR, "pics" + File.separator + "backs" + File.separator + "magic.jpg");
        if (file.isFile() && file.length() > 0) {
            return file;
        }
        if (System.currentTimeMillis() - failedAt < RETRY_AFTER_MS) {
            return null;
        }
        try {
            download(MAGIC_URL, file);
            return file;
        } catch (final IOException | RuntimeException e) {
            failedAt = System.currentTimeMillis();
            System.err.println("Dos de carte indisponible : " + e.getMessage());
            return null;
        }
    }

    private static void download(final String url, final File dest) throws IOException {
        final HttpURLConnection c = Net.open(url);
        c.setRequestProperty("User-Agent", GuiBase.getInterface().getUserAgent());
        c.setRequestProperty("Accept", "image/*");
        c.setConnectTimeout(10_000);
        c.setReadTimeout(20_000);
        final int code = c.getResponseCode();
        if (code != 200) {
            c.disconnect();
            throw new IOException("HTTP " + code + " pour " + url);
        }
        dest.getParentFile().mkdirs();
        final File tmp = new File(dest.getPath() + ".tmp");
        try (InputStream in = c.getInputStream()) {
            Io.copy(in, tmp);
        }
        if (tmp.length() == 0) {
            tmp.delete();
            throw new IOException("image vide " + url);
        }
        Files.move(tmp.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }
}
