package atclaude.bridge;

import forge.ImageKeys;
import forge.gui.GuiBase;
import forge.item.PaperCard;
import forge.item.PaperToken;
import forge.util.ImageUtil;

import java.io.File;
import java.io.IOException;
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

    /**
     * Attente maximale d'une image demandée par l'écran. Au-delà, la demande se termine (l'écran garde le cadre dessiné)
     * et l'image est annoncée quand elle arrive : une image à télécharger ne bloque plus celles qui sont déjà prêtes
     * (le navigateur ne fait que quelques demandes à la fois).
     */
    public static final long IMAGE_WAIT_MS = 4_000;

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

    // ------------------------------------------------------------------ petites images

    /**
     * Fabrique une petite version d'une image (la plateforme sait décoder et réduire : Android, ordinateur). Renvoie
     * faux si elle ne sait pas faire ; l'image entière est alors servie.
     */
    public interface Thumbnailer {
        boolean write(File source, File target, int width) throws IOException;
    }

    /** Null : pas de petites images (iPhone), l'image entière sert partout. */
    public static volatile Thumbnailer thumbnailer;

    /** Largeur des petites images : la moitié d'une image Scryfall (488 px), assez pour une carte du plateau. */
    public static final int SMALL_WIDTH = 244;

    /**
     * La petite version de l'image servie (cartes et jetons du plateau), fabriquée une fois puis gardée dans le cache :
     * quatre fois moins de pixels à décoder et à garder en mémoire pour chaque carte affichée. L'agrandissement d'une
     * carte demande toujours l'image entière.
     */
    public static Served small(final String imageKey, final Served full) {
        final Thumbnailer t = thumbnailer;
        if (t == null || full == null || imageKey == null
                || !(imageKey.startsWith(ImageKeys.CARD_PREFIX) || imageKey.startsWith(ImageKeys.TOKEN_PREFIX))) {
            return full;
        }
        final File src = full.file();
        // Déjà petite (jeton généré, image basse définition) : rien à gagner.
        if (src.length() < 30_000) {
            return full;
        }
        try {
            final File dir = new File(forge.localinstance.properties.ForgeConstants.CACHE_DIR, "thumbs");
            final String name = Integer.toHexString(src.getAbsolutePath().hashCode()) + "-" + Long.toHexString(src.length())
                    + "-" + Long.toHexString(src.lastModified() / 1000) + ".jpg";
            final File small = new File(dir, name);
            if (!small.isFile() || small.length() == 0) {
                dir.mkdirs();
                final File tmp = new File(dir, name + "." + Thread.currentThread().getId() + ".tmp");
                if (!t.write(src, tmp, SMALL_WIDTH) || !tmp.renameTo(small)) {
                    tmp.delete();
                    return full;
                }
            }
            return new Served(small, full.lang(), full.cacheable());
        } catch (final IOException | RuntimeException | OutOfMemoryError e) {
            return full;
        }
    }

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
        final long t0 = System.nanoTime();
        final Served served = serve(imageKey, lang, timeoutMs, exact);
        if (imageKey != null && (imageKey.startsWith(ImageKeys.CARD_PREFIX) || imageKey.startsWith(ImageKeys.TOKEN_PREFIX))) {
            Perf.IMAGE_MS.add((System.nanoTime() - t0) / 1_000_000);
            if (served == null) {
                Perf.IMAGE_MISSING.incrementAndGet();
            }
        }
        return served;
    }

    private static Served serve(final String imageKey, final String lang, final long timeoutMs, final boolean exact) {
        if (!ForgeRuntime.isReady() || imageKey == null || imageKey.isEmpty() || ImageKeys.HIDDEN_CARD.equals(imageKey)) {
            return null;
        }
        if (imageKey.startsWith(CardBacks.PREFIX)) {
            final File back = CardBacks.file(imageKey);
            return back == null ? null : new Served(back, "en", true);
        }
        if (imageKey.startsWith(CustomCards.FRAME_PREFIX)) {
            final File frame = CustomCards.frameImage(imageKey);
            return frame == null ? null : new Served(frame, "en", false);
        }
        if (imageKey.startsWith(CustomCards.SET_PREFIX)) {
            final File logo = CustomCards.setLogoFile(imageKey);
            return logo == null ? null : new Served(logo, "en", true);
        }
        if (imageKey.startsWith(Reprints.ART_PREFIX)) {
            final File art = Reprints.art(imageKey);
            return art == null ? null : new Served(art, "en", true);
        }
        if (imageKey.startsWith(CustomCards.ART_PREFIX)) {
            final File art = CustomCards.art(imageKey);
            return art == null ? null : new Served(art, "en", false);
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

    /**
     * Adresses Scryfall de l'image (dans la langue demandée, et en anglais), calculées sans réseau : si le pont n'a
     * pas pu télécharger une image, la page de l'iPhone la charge elle-même par le réseau d'iOS.
     */
    public static com.google.gson.JsonObject directUrls(final String imageKey, final String lang) {
        final com.google.gson.JsonObject o = new com.google.gson.JsonObject();
        if (!ForgeRuntime.isReady() || imageKey == null || imageKey.isEmpty() || ImageKeys.HIDDEN_CARD.equals(imageKey)
                || imageKey.startsWith(CardBacks.PREFIX) || imageKey.startsWith(BoosterArt.PREFIX)) {
            return o;
        }
        String key = imageKey;
        final boolean back = key.endsWith(ImageKeys.BACKFACE_POSTFIX);
        if (back) {
            key = key.substring(0, key.length() - ImageKeys.BACKFACE_POSTFIX.length());
        }
        final PaperCard pc = key.indexOf('$') >= 0 ? null : ImageUtil.getPaperCardFromImageKey(key);
        if (pc == null) {
            return o;
        }
        final forge.card.CardEdition ed = forge.StaticData.instance().getEditions().get(pc.getEdition());
        final String set = ed != null && ed.getScryfallCode() != null && !ed.getScryfallCode().isEmpty()
                ? ed.getScryfallCode() : pc.getEdition().toLowerCase(java.util.Locale.ROOT);
        final String base = forge.localinstance.properties.ForgeConstants.URL_PIC_SCRYFALL_DOWNLOAD;
        if (pc.getRules().isCustom() || forge.item.IPaperCard.NO_COLLECTOR_NUMBER.equals(pc.getCollectorNumber())) {
            o.addProperty("en", base + "named?format=image&version=normal&exact="
                    + java.net.URLEncoder.encode(pc.getName(), java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20"));
            return o;
        }
        final String face = back ? "back" : "";
        o.addProperty("en", base + ImageUtil.getScryfallDownloadUrl(pc, face, set, "en", false));
        if (lang != null && LocalizedImages.SUPPORTED.contains(lang)) {
            o.addProperty("local", base + ImageUtil.getScryfallDownloadUrl(pc, face, set, lang, false));
        }
        return o;
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
        } catch (final java.util.concurrent.ExecutionException e) {
            // pas encore là
        } catch (final java.util.concurrent.TimeoutException e) {
            // Pas encore là : la demande de l'écran se termine (elle ne bloque pas les images déjà prêtes derrière
            // elle), et l'écran est prévenu dès que le téléchargement aboutit (il recharge alors cette image).
            download.thenRun(() -> {
                ImageKeys.clearMissingCards();
                if (cached(imageKey) != null) {
                    FAILED.remove(imageKey);
                    onLateImage.accept(imageKey);
                }
            });
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
