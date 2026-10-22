package atclaude.bridge;

import forge.ImageKeys;
import forge.gui.GuiBase;

import java.io.File;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Images de cartes pour l'interface : servies depuis le cache de Forge, téléchargées depuis
 * Scryfall au premier affichage. Forge choisit l'édition, la face et le nom de fichier.
 */
public final class ImageService {

    private ImageService() { }

    /** Fichier image de la clé Forge donnée, ou null si elle est introuvable dans le délai. */
    public static File image(final String imageKey, final long timeoutMs) {
        if (!ForgeRuntime.isReady() || imageKey == null || imageKey.isEmpty() || ImageKeys.HIDDEN_CARD.equals(imageKey)) {
            return null;
        }
        File file = cached(imageKey);
        if (file != null) {
            return file;
        }
        final CountDownLatch done = new CountDownLatch(1);
        GuiBase.getInterface().getImageFetcher().fetchImage(imageKey, done::countDown);
        try {
            done.await(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (final InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        // Forge garde en mémoire les images manquantes : on oublie cette liste après un téléchargement.
        ImageKeys.clearMissingCards();
        return cached(imageKey);
    }

    private static File cached(final String imageKey) {
        final File file = ImageKeys.getImageFile(imageKey);
        return file != null && file.isFile() && file.length() > 0 ? file : null;
    }

    public static String contentType(final File file) {
        final String name = file.getName().toLowerCase();
        return name.endsWith(".png") ? "image/png" : "image/jpeg";
    }
}
