package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.ImageKeys;
import forge.StaticData;
import forge.card.CardEdition;
import forge.card.CardRules;
import forge.card.CardSplitType;
import forge.gui.GuiBase;
import forge.item.IPaperCard;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;
import forge.util.ImageUtil;
import forge.util.ScryfallRateLimiter;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.io.Writer;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

/**
 * Images de cartes dans une autre langue que l'anglais, prises sur Scryfall et rangées dans un
 * cache à part ({@code <cache>/pics/cards-<langue>/}) : elles n'écrasent ni ne masquent jamais les
 * images anglaises que le téléchargeur de Forge range dans {@code <cache>/pics/cards/}.
 *
 * Ordre : même impression dans la langue, puis n'importe quelle impression de la carte dans la
 * langue, sinon rien (l'appelant sert alors l'image anglaise). « Rien » est retenu sur disque.
 *
 * N'appelle jamais l'ImageFetcher de Forge, donc n'a pas besoin du fil d'images (celui que
 * {@link BridgeGuiBase#isGuiThread} déclare) et ne le bloque pas. Un seul fil de travail par langue
 * fait toutes les requêtes ; {@link ScryfallRateLimiter}, global, espace les appels à
 * api.scryfall.com avec ceux du téléchargeur anglais de Forge.
 */
final class LocalizedImages {

    /** Langues proposées par l'interface, au format Scryfall (et non « fr-FR »). */
    static final Set<String> SUPPORTED = Set.of("fr");

    private static final long ABSENT_TTL_MS = 30L * 24 * 3600_000; // pas de version : on revérifie dans 30 jours
    private static final long ERROR_RETRY_MS = 5 * 60_000;         // réseau, 429, 5xx : on réessaie dans 5 minutes

    enum Status { FOUND, ABSENT, PENDING, ERROR }

    record Outcome(Status status, File file) {
        static final Outcome ABSENT = new Outcome(Status.ABSENT, null);
        static final Outcome PENDING = new Outcome(Status.PENDING, null);
        static final Outcome ERROR = new Outcome(Status.ERROR, null);
    }

    /** Une face de carte telle que Scryfall la connaît. */
    record CardRef(String fileKey, String set, String printPath, boolean back, String searchName) {

        /** Null pour ce qui ne peut pas exister dans la langue : jetons, cartes perso, faces Alchemy... */
        static CardRef of(final String imageKey, final String lang) {
            if (imageKey == null || !imageKey.startsWith(ImageKeys.CARD_PREFIX)) {
                return null; // jetons : image anglaise de Forge
            }
            String key = imageKey;
            final boolean back = key.endsWith(ImageKeys.BACKFACE_POSTFIX);
            if (back) {
                key = key.substring(0, key.length() - ImageKeys.BACKFACE_POSTFIX.length());
            }
            if (key.indexOf('$') >= 0) {
                return null; // faces « spécialisées » d'Alchemy : numériques, jamais traduites
            }
            final PaperCard pc = ImageUtil.getPaperCardFromImageKey(key);
            if (pc == null || pc.getRules().isCustom() || IPaperCard.NO_COLLECTOR_NUMBER.equals(pc.getCollectorNumber())) {
                return null;
            }
            final CardEdition ed = StaticData.instance().getEditions().get(pc.getEdition());
            if (ed == null || ed.getScryfallCode() == null || ed.getScryfallCode().isEmpty()) {
                return null;
            }
            final String set = ed.getScryfallCode();
            // Même construction que Forge : préfixes OHOP/OPCA, numéros « F12 », verso « 15b » des cartes melded...
            final String path = ImageUtil.getScryfallDownloadUrl(pc, back ? "back" : "", set, lang, false);
            final int q = path.indexOf('?');
            final CardRules rules = pc.getRules();
            final boolean meld = rules.getSplitType() == CardSplitType.Meld;
            // Nom exact de Scryfall : « Recto // Verso » pour les cartes à deux parties (doubles, partagées,
            // aventures, retournables) ; la carte assemblée d'un meld est une carte à part entière.
            final String searchName = back && meld ? ImageUtil.getNameToUse(pc, "back")
                    : rules.getOtherPart() != null && !meld ? rules.getMainPart().getName() + " // " + rules.getOtherPart().getName()
                    : pc.getName();
            return new CardRef(
                    ImageService.fileKey(imageKey),
                    set,
                    q < 0 ? path : path.substring(0, q),           // « tdc/45/fr »
                    path.contains("face=back"),                     // verso d'une carte double
                    searchName);
        }
    }

    private static final Map<String, LocalizedImages> BY_LANG = new ConcurrentHashMap<>();

    static LocalizedImages forLang(final String lang) {
        return BY_LANG.computeIfAbsent(lang, l -> new LocalizedImages(l,
                new File(ForgeConstants.CACHE_DIR, "pics" + File.separator + "cards-" + l),
                "https://api.scryfall.com/", ForgeConstants.URL_SCRYFALL_CDN,
                () -> GuiBase.getInterface().getUserAgent()));
    }

    private final String lang;
    private final File dir;
    private final File indexFile;
    private final String apiBase;
    private final String cdnPrefix;
    private final Supplier<String> userAgent;

    /** Clé → date de la dernière réponse « n'existe pas » (persisté). */
    private final Map<String, Long> absent = new ConcurrentHashMap<>();
    /** Nom de carte (+ face) → image trouvée par la recherche, réutilisée pour ses autres impressions (persisté). */
    private final Map<String, String> named = new ConcurrentHashMap<>();
    /** Face → date de la dernière erreur passagère (en mémoire seulement). */
    private final Map<String, Long> errors = new ConcurrentHashMap<>();
    private final Map<String, Task> inflight = new ConcurrentHashMap<>();
    private final LinkedBlockingDeque<Runnable> queue = new LinkedBlockingDeque<>();

    LocalizedImages(final String lang, final File dir, final String apiBase, final String cdnPrefix, final Supplier<String> userAgent) {
        this.lang = lang;
        this.dir = dir;
        this.indexFile = new File(dir, "_index.json");
        this.apiBase = apiBase;
        this.cdnPrefix = cdnPrefix;
        this.userAgent = userAgent;
        loadIndex();
        final Thread worker = new Thread(this::work, "atclaude-images-" + lang);
        worker.setDaemon(true);
        worker.start();
    }

    /** Fichier de la face dans ce cache (qu'il existe ou non). */
    File file(final String fileKey) {
        return new File(dir, fileKey + ".jpg");
    }

    /** Image dans la langue de la clé d'image Forge donnée, en attendant au plus {@code timeoutMs}. */
    Outcome get(final String imageKey, final long timeoutMs) {
        final File f = file(ImageService.fileKey(imageKey));
        if (f.isFile() && f.length() > 0) {
            return new Outcome(Status.FOUND, f); // chemin rapide, sans toucher à la base de cartes
        }
        final CardRef ref = CardRef.of(imageKey, lang);
        return ref == null ? Outcome.ABSENT : get(ref, timeoutMs);
    }

    Outcome get(final CardRef ref, final long timeoutMs) {
        final File f = file(ref.fileKey());
        if (f.isFile() && f.length() > 0) {
            return new Outcome(Status.FOUND, f);
        }
        if (isAbsent(printKey(ref)) && isAbsent(nameKey(ref)) && !named.containsKey(nameKey(ref))) {
            return Outcome.ABSENT;
        }
        final Long failedAt = errors.get(ref.fileKey());
        if (failedAt != null && System.currentTimeMillis() - failedAt < ERROR_RETRY_MS) {
            return Outcome.ERROR;
        }
        try {
            return submit(ref, true).future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (final TimeoutException e) {
            return Outcome.PENDING; // la recherche continue : la prochaine demande trouvera le fichier
        } catch (final InterruptedException e) {
            Thread.currentThread().interrupt();
            return Outcome.PENDING;
        } catch (final ExecutionException e) {
            return Outcome.ERROR;
        }
    }

    /** Lance {@code then} si l'image en cours de recherche finit par être trouvée (pour prévenir l'interface). */
    void whenFound(final String imageKey, final Runnable then) {
        final Task t = inflight.get(ImageService.fileKey(imageKey));
        if (t != null) {
            t.future.thenAccept(o -> {
                if (o.status() == Status.FOUND) {
                    then.run();
                }
            });
        }
    }

    /** Prépare en arrière-plan les images d'un deck (après les demandes de l'écran). */
    void prefetch(final Collection<String> imageKeys) {
        for (final String key : imageKeys) {
            final CardRef ref = CardRef.of(key, lang);
            if (ref != null && !file(ref.fileKey()).isFile()) {
                submit(ref, false);
            }
        }
    }

    // ------------------------------------------------------------------ file de travail

    private final class Task implements Runnable {
        final CardRef ref;
        final CompletableFuture<Outcome> future = new CompletableFuture<>();
        final AtomicBoolean started = new AtomicBoolean();

        Task(final CardRef ref) {
            this.ref = ref;
        }

        @Override
        public void run() {
            if (!started.compareAndSet(false, true)) {
                return; // déjà faite (tâche remise en tête de file par une demande urgente)
            }
            Outcome o;
            try {
                o = resolve(ref);
            } catch (final RuntimeException e) {
                e.printStackTrace();
                o = Outcome.ERROR;
            }
            inflight.remove(ref.fileKey(), this);
            future.complete(o);
        }
    }

    private Task submit(final CardRef ref, final boolean urgent) {
        final Task created = new Task(ref);
        final Task existing = inflight.putIfAbsent(ref.fileKey(), created);
        final Task task = existing != null ? existing : created;
        if (urgent) {
            queue.offerFirst(task); // une préparation en attente passe devant ; le doublon sera ignoré
        } else if (existing == null) {
            queue.offerLast(task);
        }
        return task;
    }

    private void work() {
        while (true) {
            try {
                queue.takeFirst().run();
            } catch (final InterruptedException e) {
                return;
            } catch (final RuntimeException e) {
                e.printStackTrace();
            }
        }
    }

    // ------------------------------------------------------------------ résolution (fil de travail)

    private String printKey(final CardRef ref) {
        return "print:" + ref.printPath() + (ref.back() ? "#back" : "");
    }

    private String nameKey(final CardRef ref) {
        return "name:" + lang + ":" + ref.searchName().toLowerCase(Locale.ROOT) + (ref.back() ? "#back" : "");
    }

    private Outcome resolve(final CardRef ref) {
        final File dest = file(ref.fileKey());
        if (dest.isFile() && dest.length() > 0) {
            return new Outcome(Status.FOUND, dest);
        }
        try {
            String url = null;
            // 1. La même impression dans la langue : GET /cards/{set}/{numéro}/{langue}
            final String printKey = printKey(ref);
            if (!isAbsent(printKey)) {
                final JsonObject card = getJson(apiBase + "cards/" + ref.printPath());
                url = card == null ? null : imageUrl(card, ref.back());
                if (url == null) {
                    markAbsent(printKey);
                }
            }
            // 2. N'importe quelle impression de la carte dans la langue (la plus récente, de préférence du même set).
            if (url == null) {
                final String nameKey = nameKey(ref);
                url = named.get(nameKey);
                if (url == null && !isAbsent(nameKey)) {
                    url = searchAnyPrint(ref);
                    if (url == null) {
                        markAbsent(nameKey);
                    } else {
                        named.put(nameKey, url);
                        saveIndex();
                    }
                }
            }
            if (url == null) {
                return Outcome.ABSENT;
            }
            download(url, dest);
            errors.remove(ref.fileKey());
            return new Outcome(Status.FOUND, dest);
        } catch (final IOException e) {
            errors.put(ref.fileKey(), System.currentTimeMillis());
            System.err.println("Image " + lang + " indisponible pour " + ref.fileKey() + " : " + e.getMessage());
            return Outcome.ERROR;
        }
    }

    private String searchAnyPrint(final CardRef ref) throws IOException {
        final String name = ref.searchName();
        if (name == null || name.isEmpty() || name.indexOf('"') >= 0) {
            return null;
        }
        final String query = "!\"" + name + "\" lang:" + lang;
        final JsonObject page = getJson(apiBase + "cards/search?unique=prints&include_multilingual=true&order=released&dir=desc&q="
                + URLEncoder.encode(query, "UTF-8"));
        if (page == null || !page.has("data") || !page.get("data").isJsonArray()) {
            return null;
        }
        // Une seule page (175 impressions, les plus récentes d'abord) suffit, même pour les terrains de base.
        String best = null;
        int bestScore = -1;
        for (final JsonElement el : page.getAsJsonArray("data")) {
            final JsonObject c = el.getAsJsonObject();
            if (!lang.equals(str(c, "lang"))) {
                continue;
            }
            final String u = imageUrl(c, ref.back());
            if (u == null) {
                continue;
            }
            int score = 0;
            if (ref.set().equals(str(c, "set"))) {
                score += 4;
            }
            if ("highres_scan".equals(str(c, "image_status"))) {
                score += 2;
            }
            if (!"gold".equals(str(c, "border_color")) && !bool(c, "oversized")) {
                score += 1;
            }
            if (score > bestScore) { // à égalité, la première (la plus récente) gagne
                best = u;
                bestScore = score;
            }
        }
        return best;
    }

    /** Image « normal » de la face voulue, ou null si Scryfall n'a pas (encore) de scan. */
    String imageUrl(final JsonObject card, final boolean back) {
        final String status = str(card, "image_status");
        if ("missing".equals(status) || "placeholder".equals(status)) {
            return null;
        }
        JsonObject uris = null;
        if (card.has("card_faces") && card.get("card_faces").isJsonArray()) {
            final JsonArray faces = card.getAsJsonArray("card_faces");
            final int i = back && faces.size() > 1 ? 1 : 0;
            if (faces.size() > i) {
                final JsonObject face = faces.get(i).getAsJsonObject();
                if (face.has("image_uris") && face.get("image_uris").isJsonObject()) {
                    uris = face.getAsJsonObject("image_uris");
                }
            }
        }
        if (uris == null && card.has("image_uris") && card.get("image_uris").isJsonObject()) {
            uris = card.getAsJsonObject("image_uris"); // cartes partagées, à retourner, aventures : une seule image
        }
        final String url = uris == null ? null : str(uris, "normal");
        return url != null && url.startsWith(cdnPrefix) ? url : null;
    }

    // ------------------------------------------------------------------ HTTP

    private HttpURLConnection open(final String url, final String accept) throws IOException {
        final HttpURLConnection c = (HttpURLConnection) URI.create(url).toURL().openConnection();
        // Scryfall exige un User-Agent et un Accept explicites.
        c.setRequestProperty("User-Agent", userAgent.get());
        c.setRequestProperty("Accept", accept);
        c.setConnectTimeout(10_000);
        c.setReadTimeout(20_000);
        return c;
    }

    /** JSON de l'API, ou null si Scryfall répond « introuvable » (404) ou « requête invalide » (400). */
    private JsonObject getJson(final String url) throws IOException {
        if (ScryfallRateLimiter.shouldSkip(url)) {
            throw new IOException("Scryfall en pause après un 429");
        }
        ScryfallRateLimiter.acquire(url); // 100 ms entre appels, 500 ms pour /cards/search
        final HttpURLConnection c = open(url, "application/json");
        final int code = c.getResponseCode();
        if (code == 404 || code == 400) {
            c.disconnect();
            return null;
        }
        if (code != 200) {
            ScryfallRateLimiter.noteIfRateLimited(code, url, c.getHeaderField("Retry-After"));
            c.disconnect();
            throw new IOException("HTTP " + code + " pour " + url);
        }
        try (Reader r = new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8)) {
            return JsonParser.parseReader(r).getAsJsonObject();
        }
    }

    /** Copie l'image du CDN (sans limite de débit) ; fichier temporaire puis renommage atomique. */
    private void download(final String url, final File dest) throws IOException {
        final HttpURLConnection c = open(url, "image/*");
        final int code = c.getResponseCode();
        if (code != 200) {
            c.disconnect();
            throw new IOException("HTTP " + code + " pour " + url);
        }
        dest.getParentFile().mkdirs();
        final File tmp = new File(dest.getPath() + ".tmp");
        try (InputStream in = c.getInputStream()) {
            Files.copy(in, tmp.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
        if (tmp.length() == 0) {
            tmp.delete();
            throw new IOException("image vide " + url);
        }
        Files.move(tmp.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }

    // ------------------------------------------------------------------ cache négatif

    private boolean isAbsent(final String key) {
        final Long at = absent.get(key);
        return at != null && System.currentTimeMillis() - at < ABSENT_TTL_MS;
    }

    private void markAbsent(final String key) {
        absent.put(key, System.currentTimeMillis());
        saveIndex();
    }

    private void loadIndex() {
        if (!indexFile.isFile()) {
            return;
        }
        try (Reader r = Files.newBufferedReader(indexFile.toPath(), StandardCharsets.UTF_8)) {
            final JsonObject o = JsonParser.parseReader(r).getAsJsonObject();
            if (o.has("absent")) {
                o.getAsJsonObject("absent").entrySet().forEach(e -> absent.put(e.getKey(), e.getValue().getAsLong()));
            }
            if (o.has("named")) {
                o.getAsJsonObject("named").entrySet().forEach(e -> named.put(e.getKey(), e.getValue().getAsString()));
            }
        } catch (final IOException | RuntimeException e) {
            System.err.println("Index des images " + lang + " illisible, on repart de zéro : " + e.getMessage());
        }
    }

    private synchronized void saveIndex() {
        final JsonObject o = new JsonObject();
        final JsonObject a = new JsonObject();
        absent.forEach(a::addProperty);
        final JsonObject n = new JsonObject();
        named.forEach(n::addProperty);
        o.add("absent", a);
        o.add("named", n);
        try {
            dir.mkdirs();
            final File tmp = new File(dir, "_index.json.tmp");
            try (Writer w = Files.newBufferedWriter(tmp.toPath(), StandardCharsets.UTF_8)) {
                w.write(o.toString());
            }
            Files.move(tmp.toPath(), indexFile.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (final IOException e) {
            System.err.println("Index des images " + lang + " non enregistré : " + e.getMessage());
        }
    }

    private static String str(final JsonObject o, final String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : null;
    }

    private static boolean bool(final JsonObject o, final String key) {
        return o.has(key) && !o.get(key).isJsonNull() && o.get(key).getAsBoolean();
    }
}
