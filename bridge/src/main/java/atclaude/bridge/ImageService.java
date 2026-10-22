package atclaude.bridge;

import forge.ImageKeys;
import forge.gui.GuiBase;
import forge.item.PaperCard;
import forge.item.PaperToken;
import forge.util.ImageUtil;

import java.io.File;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Images de cartes pour l'interface : servies depuis le cache de Forge, téléchargées depuis
 * Scryfall au premier affichage. Forge choisit l'édition, la face et le nom de fichier.
 *
 * Le téléchargeur de Forge exige d'être appelé depuis un fil d'interface et n'est pas protégé
 * contre les accès concurrents : tout passe donc par un fil unique, que le pont déclare comme
 * fil d'interface (voir {@link BridgeGuiBase#isGuiThread}).
 */
public final class ImageService {

    /** Après un échec, on ne redemande pas l'image avant ce délai. */
    private static final long RETRY_AFTER_MS = 5 * 60_000;

    private static volatile Thread imageThread;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-images");
        t.setDaemon(true);
        imageThread = t;
        return t;
    });
    private static final Map<String, Long> FAILED = new ConcurrentHashMap<>();

    /** Prévient l'interface qu'une image d'abord servie en anglais existe maintenant dans sa langue. */
    static volatile Consumer<String> onLateImage = key -> { };

    private ImageService() { }

    /**
     * Image servie à l'interface : le fichier, sa langue réelle, et si le navigateur peut la garder
     * (non quand l'anglais n'est qu'un remplaçant en attendant la version traduite).
     */
    public record Served(File file, String lang, boolean cacheable) { }

    /**
     * Image dans la langue demandée (« fr » : impression française sur Scryfall), sinon l'image anglaise
     * de Forge. Null si aucune image n'est trouvée dans le délai.
     */
    public static Served image(final String imageKey, final String lang, final long timeoutMs) {
        if (!ForgeRuntime.isReady() || imageKey == null || imageKey.isEmpty() || ImageKeys.HIDDEN_CARD.equals(imageKey)) {
            return null;
        }
        final long deadline = System.currentTimeMillis() + timeoutMs;
        boolean cacheable = true;
        File en = null;
        if (lang != null && LocalizedImages.SUPPORTED.contains(lang)) {
            // L'image anglaise déjà en cache est servie tout de suite ; la française la remplacera si elle existe.
            en = cached(imageKey);
            final LocalizedImages.Outcome o = LocalizedImages.forLang(lang)
                    .get(imageKey, en != null ? 0 : timeoutMs * 2 / 3, () -> onLateImage.accept(imageKey));
            if (o.file() != null) {
                return new Served(o.file(), lang, true);
            }
            // Pas de version traduite : l'anglais est la bonne réponse. En attente ou en erreur : anglais provisoire.
            cacheable = o.status() == LocalizedImages.Status.ABSENT;
        }
        if (en == null) {
            en = image(imageKey, Math.max(2_000, deadline - System.currentTimeMillis()));
        }
        return en == null ? null : new Served(en, "en", cacheable);
    }

    static boolean isImageThread() {
        return Thread.currentThread() == imageThread;
    }

    static void runOnImageThread(final Runnable task) {
        EXECUTOR.execute(() -> {
            try {
                task.run();
            } catch (final RuntimeException e) {
                e.printStackTrace();
            }
        });
    }

    /** Fichier image de la clé Forge donnée, ou null si elle est introuvable dans le délai. */
    public static File image(final String imageKey, final long timeoutMs) {
        if (!ForgeRuntime.isReady() || imageKey == null || imageKey.isEmpty() || ImageKeys.HIDDEN_CARD.equals(imageKey)) {
            return null;
        }
        File file = cached(imageKey);
        if (file != null) {
            return file;
        }
        final Long failedAt = FAILED.get(imageKey);
        if (failedAt != null && System.currentTimeMillis() - failedAt < RETRY_AFTER_MS) {
            // L'image a pu être ajoutée au cache depuis l'échec : Forge doit oublier qu'elle manquait.
            ImageKeys.clearMissingCards();
            return cached(imageKey);
        }
        final CountDownLatch done = new CountDownLatch(1);
        runOnImageThread(() -> GuiBase.getInterface().getImageFetcher().fetchImage(imageKey, done::countDown));
        try {
            done.await(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (final InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        // Forge garde en mémoire les images manquantes : on oublie cette liste après un téléchargement.
        ImageKeys.clearMissingCards();
        file = cached(imageKey);
        if (file == null) {
            FAILED.put(imageKey, System.currentTimeMillis());
        } else {
            FAILED.remove(imageKey);
        }
        return file;
    }

    private static File cached(final String imageKey) {
        final File file = ImageKeys.getImageFile(fileKey(imageKey));
        return file != null && file.isFile() && file.length() > 0 ? file : null;
    }

    /**
     * Clé du fichier dans le cache, à partir de la clé d'image d'une carte en jeu
     * (« c:Nom|SET|numéro », avec « $alt » pour le verso), comme le fait l'interface mobile de Forge.
     */
    static String fileKey(final String imageKey) {
        String key = imageKey;
        final boolean back = key.endsWith(ImageKeys.BACKFACE_POSTFIX);
        if (back) {
            key = key.substring(0, key.length() - ImageKeys.BACKFACE_POSTFIX.length());
        }
        if (key.startsWith(ImageKeys.CARD_PREFIX)) {
            final PaperCard card = ImageUtil.getPaperCardFromImageKey(key);
            if (card != null) {
                return back ? card.getCardAltImageKey() : card.getCardImageKey();
            }
        } else if (key.startsWith(ImageKeys.TOKEN_PREFIX)) {
            final PaperToken token = ImageUtil.getPaperTokenFromImageKey(key);
            if (token != null) {
                return token.getCardImageKey();
            }
        }
        return key;
    }

    public static String contentType(final File file) {
        final String name = file.getName().toLowerCase();
        return name.endsWith(".png") ? "image/png" : "image/jpeg";
    }
}
