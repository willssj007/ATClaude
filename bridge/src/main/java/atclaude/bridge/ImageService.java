package atclaude.bridge;

import forge.ImageKeys;
import forge.gui.GuiBase;
import forge.item.PaperCard;
import forge.item.PaperToken;
import forge.util.ImageUtil;

import java.io.File;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
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
        return image(imageKey, lang, timeoutMs, false);
    }

    /** {@code exact} : cette impression précise (choix d'illustration), jamais une autre impression traduite. */
    public static Served image(final String imageKey, final String lang, final long timeoutMs, final boolean exact) {
        if (!ForgeRuntime.isReady() || imageKey == null || imageKey.isEmpty() || ImageKeys.HIDDEN_CARD.equals(imageKey)) {
            return null;
        }
        if (imageKey.startsWith(CardBacks.PREFIX)) {
            final File back = CardBacks.file(imageKey);
            return back == null ? null : new Served(back, "en", true);
        }
        if (imageKey.startsWith(BoosterArt.PREFIX)) {
            final File pack = BoosterArt.file(imageKey);
            return pack == null ? null : new Served(pack, "en", true);
        }
        final long deadline = System.currentTimeMillis() + timeoutMs;
        boolean cacheable = true;
        File en = null;
        CompletableFuture<File> english = null;
        if (lang != null && LocalizedImages.SUPPORTED.contains(lang)) {
            // L'image anglaise déjà en cache est servie tout de suite ; la française la remplacera si elle existe.
            en = cached(imageKey);
            // Sinon on laisse un court instant à la recherche française ; si elle traîne, l'anglaise est téléchargée
            // pour patienter (la française la remplacera dès qu'elle sera là).
            final LocalizedImages.Outcome o = LocalizedImages.forLang(lang)
                    .get(imageKey, en != null ? 0 : Math.min(1_500, timeoutMs / 3), () -> onLateImage.accept(imageKey), exact);
            if (o.file() != null) {
                return new Served(o.file(), lang, true);
            }
            english = en == null ? englishAsync(imageKey) : null;
            // Pas de version traduite : l'anglais est la bonne réponse. En attente ou en erreur : anglais provisoire.
            cacheable = o.status() == LocalizedImages.Status.ABSENT;
        }
        if (en == null) {
            en = await(english != null ? english : englishAsync(imageKey), imageKey, Math.max(2_000, deadline - System.currentTimeMillis()));
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
        return await(englishAsync(imageKey), imageKey, timeoutMs);
    }

    /** Téléchargement de l'image anglaise par Forge, lancé tout de suite ; le résultat arrive plus tard. */
    private static CompletableFuture<File> englishAsync(final String imageKey) {
        final File file = cached(imageKey);
        if (file != null) {
            return CompletableFuture.completedFuture(file);
        }
        final Long failedAt = FAILED.get(imageKey);
        if (failedAt != null && System.currentTimeMillis() - failedAt < RETRY_AFTER_MS) {
            // L'image a pu être ajoutée au cache depuis l'échec : Forge doit oublier qu'elle manquait.
            ImageKeys.clearMissingCards();
            return CompletableFuture.completedFuture(cached(imageKey));
        }
        final CompletableFuture<File> done = new CompletableFuture<>();
        runOnImageThread(() -> GuiBase.getInterface().getImageFetcher().fetchImage(imageKey, () -> done.complete(null)));
        return done;
    }

    /** Attend l'image anglaise au plus {@code timeoutMs}, puis note la réussite ou l'échec. */
    private static File await(final CompletableFuture<File> download, final String imageKey, final long timeoutMs) {
        try {
            final File f = download.get(timeoutMs, TimeUnit.MILLISECONDS);
            if (f != null) {
                return f;
            }
        } catch (final InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (final java.util.concurrent.ExecutionException | java.util.concurrent.TimeoutException e) {
            // pas encore là
        }
        // Forge garde en mémoire les images manquantes : on oublie cette liste après un téléchargement.
        ImageKeys.clearMissingCards();
        final File file = cached(imageKey);
        if (file == null) {
            FAILED.put(imageKey, System.currentTimeMillis());
        } else {
            FAILED.remove(imageKey);
        }
        return file;
    }

    // ------------------------------------------------------------------ préchargement

    private static final java.util.concurrent.atomic.AtomicInteger PREFETCH_GENERATION = new java.util.concurrent.atomic.AtomicInteger();
    private static final ExecutorService PREFETCHER = Executors.newSingleThreadExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-prefetch");
        t.setDaemon(true);
        t.setPriority(Thread.MIN_PRIORITY);
        return t;
    });

    /**
     * Télécharge à l'avance les images d'une partie (le deck du joueur, les commandants adverses), une à la fois :
     * les images demandées par l'écran passent toujours devant. Un nouvel appel (ou {@link #cancelPrefetch}) arrête le précédent.
     */
    public static void prefetch(final java.util.List<String> imageKeys, final String lang) {
        final int generation = PREFETCH_GENERATION.incrementAndGet();
        PREFETCHER.execute(() -> {
            int fetched = 0;
            for (final String key : imageKeys) {
                if (PREFETCH_GENERATION.get() != generation || !ForgeRuntime.isReady()) {
                    return;
                }
                try {
                    boolean done = false;
                    if (lang != null && LocalizedImages.SUPPORTED.contains(lang)) {
                        done = LocalizedImages.forLang(lang).prefetch(key, 30_000).status() == LocalizedImages.Status.FOUND;
                    }
                    if (!done && cached(key) == null) {
                        image(key, 20_000);
                    }
                    fetched++;
                } catch (final RuntimeException e) {
                    // image suivante
                }
            }
            System.out.println("Images préchargées : " + fetched + "/" + imageKeys.size());
        });
    }

    public static void cancelPrefetch() {
        PREFETCH_GENERATION.incrementAndGet();
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
