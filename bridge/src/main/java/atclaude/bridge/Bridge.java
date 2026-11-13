package atclaude.bridge;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

/**
 * Point d'entrée unique entre l'interface web et Forge.
 *
 * L'interface envoie des messages JSON par {@link #receive(String)} ; le pont répond par le
 * {@link Transport} fourni par la plateforme (serveur HTTP local sur desktop, WebView sur Android).
 *
 * Trois fils d'exécution se croisent ici :
 * - le fil du transport, qui appelle receive() ;
 * - le fil « EDT » du pont, où sont traitées les actions de l'interface, comme le fil Swing de Forge desktop ;
 * - les fils de partie de Forge, qui appellent les dialogues bloquants.
 * Les réponses aux dialogues sont traitées directement sur le fil du transport : un dialogue ouvert depuis
 * l'EDT (choix d'une capacité, par exemple) ne bloque donc jamais sa propre réponse.
 */
public final class Bridge {

    /** Envoie un message JSON à l'interface. Doit accepter des appels depuis n'importe quel fil. */
    public interface Transport {
        void send(String json);
    }

    static final Gson GSON = new Gson();

    /** Version de l'application (Android : celle de l'APK ; Windows : celle que jpackage donne au moteur). */
    private static volatile String appVersion = System.getProperty("jpackage.app-version", "");

    public static void setAppVersion(final String version) {
        appVersion = version == null ? "" : version;
    }

    /** iPhone et iPad : la préparation du démarrage ne retient pas les écrans du menu (voir {@link #warmUp}). */
    private static volatile boolean ios;

    public static void setIos(final boolean value) {
        ios = value;
    }

    private final Transport transport;
    private final ExecutorService edt;
    private volatile Thread edtThread;
    private final Map<Integer, CompletableFuture<JsonElement>> pendingDialogs = new ConcurrentHashMap<>();
    private final Map<Integer, JsonObject> openDialogs = new ConcurrentHashMap<>();
    private final AtomicInteger dialogIds = new AtomicInteger();
    private final Catalog catalog = new Catalog();

    {
        CustomCards.onChanged = catalog::invalidateIndex;
        CustomCards.officialFrench = catalog::officialFrench;
    }
    private final Account account = new Account(this, catalog);
    private volatile MatchSession session;

    public Bridge(final Transport transport) {
        this.transport = transport;
        this.edt = Executors.newSingleThreadExecutor(r -> {
            final Thread t = new Thread(r, "atclaude-edt");
            t.setDaemon(true);
            edtThread = t;
            return t;
        });
    }

    // ------------------------------------------------------------------ fils

    boolean isEdt() {
        return Thread.currentThread() == edtThread;
    }

    void runOnEdt(final Runnable task) {
        edt.execute(() -> {
            try {
                task.run();
            } catch (final Throwable e) {
                reportError(e);
            }
        });
    }

    /** Comme {@link #runOnEdtAndWait}, en relançant telle quelle l'erreur de la tâche (son message reste lisible). */
    void callOnEdt(final Runnable task) {
        try {
            runOnEdtAndWait(task);
        } catch (final RuntimeException e) {
            if (e.getClass() == RuntimeException.class && e.getCause() instanceof RuntimeException) {
                throw (RuntimeException) e.getCause();
            }
            throw e;
        }
    }

    void runOnEdtAndWait(final Runnable task) {
        if (isEdt()) {
            task.run();
            return;
        }
        try {
            edt.submit(task).get();
        } catch (final InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (final ExecutionException e) {
            throw new RuntimeException(e.getCause());
        }
    }

    // ------------------------------------------------------------------ messages

    public void send(final JsonObject message) {
        transport.send(GSON.toJson(message));
    }

    /** Message déjà mis en JSON (photo de la partie, dont on a voulu connaître la taille). */
    void sendJson(final String json) {
        transport.send(json);
    }

    /**
     * Photo complète de la partie ? Dans un lot de messages encore à livrer à la page, seule la dernière photo compte :
     * les précédentes, déjà dépassées, sont retirées (Android, iPhone et ordinateur).
     */
    public static boolean isState(final String json) {
        return json.startsWith("{\"type\":\"state\"");
    }

    /** Retire d'un lot les photos de la partie dépassées par une plus récente, dans l'ordre d'arrivée. */
    public static java.util.List<String> dropStaleStates(final java.util.List<String> batch) {
        int last = -1;
        for (int i = batch.size() - 1; i >= 0 && last < 0; i--) {
            if (isState(batch.get(i))) {
                last = i;
            }
        }
        if (last < 0) {
            return batch;
        }
        final java.util.List<String> out = new java.util.ArrayList<>(batch.size());
        for (int i = 0; i < batch.size(); i++) {
            if (i == last || !isState(batch.get(i))) {
                out.add(batch.get(i));
            }
        }
        return out;
    }

    void sendEvent(final String type, final Consumer<JsonObject> body) {
        final JsonObject message = new JsonObject();
        message.addProperty("type", type);
        body.accept(message);
        send(message);
    }

    /** Progression affichée par l'écran de chargement de l'interface (pourcentage de 0 à 100, ou -1). */
    public void notifyLoading(final String text, final int percent) {
        sendEvent("loading", m -> {
            m.addProperty("text", text);
            m.addProperty("percent", percent);
        });
    }

    /** Erreur bloquante au démarrage : l'interface l'affiche à la place du chargement. */
    public void notifyFatal(final String text) {
        sendEvent("fatal", m -> m.addProperty("message", text));
    }

    void reportError(final Throwable e) {
        e.printStackTrace();
        sendEvent("error", m -> m.addProperty("message", String.valueOf(e.getMessage() != null ? e.getMessage() : e)));
    }

    /** Message reçu de l'interface. Appelé par le transport, sur son propre fil. */
    public void receive(final String json) {
        final JsonObject message;
        try {
            message = JsonParser.parseString(json).getAsJsonObject();
        } catch (final RuntimeException e) {
            reportError(new IllegalArgumentException("Message illisible : " + json));
            return;
        }
        final String type = message.has("type") ? message.get("type").getAsString() : "";
        if ("answer".equals(type)) {
            answerDialog(message);
            return;
        }
        if ("presence".equals(type)) {
            Presence.fromInterface(message);
            return;
        }
        if ("hello".equals(type)) {
            // Lecture seule : jamais en attente derrière un dialogue ouvert depuis l'EDT (page rechargée pendant une question).
            dispatch(type, message);
            return;
        }
        if ("leaveMatch".equals(type) || "startMatch".equals(type) || "resumeSaved".equals(type)) {
            // Un dialogue ouvert depuis l'EDT (choix d'une capacité) le bloque : on le ferme d'abord, l'EDT repart.
            cancelDialogs();
        }
        if (CATALOG_REQUESTS.contains(type)) {
            // Decks, cartes, compte : sur leur propre fil, jamais en attente derrière la partie (ni derrière un
            // dialogue de Forge resté ouvert) ; un seul fil, pour que enregistrer puis relire un deck restent dans l'ordre.
            catalogThread.execute(() -> dispatch(type, message));
            return;
        }
        if (NETWORK_REQUESTS.contains(type)) {
            // Appels réseau (GitHub) : sur leur propre fil, pour ne pas figer la partie pendant l'attente.
            network.execute(() -> dispatch(type, message));
            return;
        }
        if (type.startsWith("replay")) {
            // Replays : lecture de fichiers, à part de la partie en cours et des decks.
            replayThread.execute(() -> dispatch(type, message));
            return;
        }
                if ("deckSummaries".equals(type)) {
            // Analyse de nombreux decks : à part, pour ne pas retarder le reste de l'interface.
            analyzer.execute(() -> dispatch(type, message));
            return;
        }
        if ("edhrec".equals(type) || "deckPrices".equals(type) || "fetchMoxfield".equals(type)) {
            // Lecture d'EDHREC : à part, pour ne pas attendre derrière une synchronisation.
            web.execute(() -> dispatch(type, message));
            return;
        }
        runOnEdt(() -> dispatch(type, message));
    }

    private static final java.util.Set<String> NETWORK_REQUESTS = java.util.Set.of("sync", "linkGithub", "updateCheck", "updateDownload", "updateInstall");
    private static final java.util.Set<String> CATALOG_REQUESTS = java.util.Set.of(
            "searchCards", "cardInfo", "prints", "chooseArt", "editions", "listDecks", "loadDeck", "saveDeck", "deleteDeck",
            "parseDeck", "validateDeck", "analyzeDeck", "randomCommanderDeck", "profile", "updateProfile", "trophies", "stats",
            "clearStats", "savedGame", "career", "careerStart", "careerReset", "boosterSets", "buyBooster", "openBooster", "openBoosters",
            "careerStartChoices", "careerDeckChoices", "careerChooseDeck", "careerBuyDeck", "careerDuel", "careerBuyCard", "careerAdjust", "careerBuyCosmetic",
            "careerSwapChallenge", "creatureTypes", "customCards", "customValidate", "customSave", "customDelete", "customTypes",
            "customSets", "customSetSave", "customSetDelete", "reprintSave", "reprintDelete", "limitedSets", "limitedSealed", "draftStart",
            "draftState", "draftPick", "limitedPool", "limitedAuto", "limitedSetup", "puzzles", "frenchCards", "shareExport", "shareImport", "shareImage", "whatsNew");
    private final java.util.concurrent.ExecutorService catalogThread = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-catalog");
        t.setDaemon(true);
        return t;
    });
    private final java.util.concurrent.ExecutorService network = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-net");
        t.setDaemon(true);
        return t;
    });

    private final java.util.concurrent.ExecutorService replayThread = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-replay");
        t.setDaemon(true);
        return t;
    });

    private final java.util.concurrent.ExecutorService web = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-web");
        t.setDaemon(true);
        return t;
    });

    private final java.util.concurrent.ExecutorService analyzer = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-analyze");
        t.setDaemon(true);
        return t;
    });

    /**
     * Juste après le démarrage : prépare en fond ce que les premiers écrans demandent (index de recherche, liste des
     * decks, analyse des préconstruits pour les duels Planeswalker, decks aléatoires des parties rapides), une étape à
     * la fois sur le fil du catalogue :
     * une demande de l'interface passe entre deux étapes, et chaque écran s'ouvre ensuite sans attendre.
     */
    void warmUp() {
        if (ios) {
            // iPhone : l'analyse des préconstruits dure plus d'une minute ; sur le fil du catalogue, le profil, les
            // decks et les statistiques du menu attendaient derrière. Elle se fait donc sur un fil à elle.
            warmStep(java.util.List.of(
                    () -> catalog.search(new JsonObject()),
                    catalog::listDecks,
                    Career::boosterSets,
                    () -> catalog.refillRandomPool(0)), 0);
            final Thread precons = new Thread(() -> {
                try {
                    Precons.all();
                } catch (final RuntimeException e) {
                    // simple préparation : le premier écran qui en a besoin refera l'analyse
                }
            }, "atclaude-precons");
            precons.setDaemon(true);
            precons.setPriority(Thread.MIN_PRIORITY);
            precons.start();
            return;
        }
        final java.util.List<Runnable> steps = java.util.List.of(
                () -> catalog.search(new JsonObject()),
                catalog::listDecks,
                Precons::all,
                Career::boosterSets,
                () -> catalog.refillRandomPool(0));
        warmStep(steps, 0);
    }

    private void warmStep(final java.util.List<Runnable> steps, final int i) {
        if (i >= steps.size()) {
            return;
        }
        catalogThread.execute(() -> {
            final Thread t = Thread.currentThread();
            t.setPriority(Thread.MIN_PRIORITY);
            final long started = System.nanoTime();
            try {
                steps.get(i).run();
            } catch (final RuntimeException e) {
                // simple préparation : l'écran refera le calcul et montrera l'erreur s'il y en a une
            } finally {
                t.setPriority(Thread.NORM_PRIORITY);
                System.out.println("Préparation " + (i + 1) + "/" + steps.size() + " : " + (System.nanoTime() - started) / 1_000_000 + " ms");
            }
            warmStep(steps, i + 1);
        });
    }

    /** Chaîne facultative d'un message : null si absente ou nulle. */
    private static String optString(final JsonObject m, final String key) {
        return m.has(key) && !m.get(key).isJsonNull() ? m.get(key).getAsString() : null;
    }

    private void dispatch(final String type, final JsonObject message) {
        final JsonElement rid = message.get("rid");
        try {
            final JsonElement result = handle(type, message);
            if (rid != null) {
                final JsonObject response = new JsonObject();
                response.addProperty("type", "response");
                response.add("rid", rid);
                response.add("data", result == null ? JsonNull.INSTANCE : result);
                send(response);
            }
        } catch (final Throwable e) {
            if (rid == null) {
                reportError(e);
                return;
            }
            e.printStackTrace();
            final JsonObject response = new JsonObject();
            response.addProperty("type", "response");
            response.add("rid", rid);
            response.addProperty("error", String.valueOf(e.getMessage() != null ? e.getMessage() : e));
            send(response);
        }
    }

    /** Mises à jour : vérifier la dernière version, la télécharger (avec sa progression), l'installer (Windows). */
    private JsonElement updates(final String type, final JsonObject m) throws java.io.IOException {
        if ("updateCheck".equals(type)) {
            return Updates.check(appVersion, System.getProperty("atclaude.channel", ""), ios);
        }
        if ("updateDownload".equals(type)) {
            // Le téléchargement avance : l'interface montre une barre (updateProgress).
            final java.io.File file = Updates.download(m.get("url").getAsString(), m.has("name") ? m.get("name").getAsString() : "", (done, total) -> {
                final JsonObject p = new JsonObject();
                p.addProperty("type", "updateProgress");
                p.addProperty("done", done);
                p.addProperty("total", total);
                send(p);
            });
            final JsonObject o = new JsonObject();
            o.addProperty("file", file.getAbsolutePath());
            return o;
        }
        // Windows : la nouvelle version remplace l'appli, qui se relance (Android : c'est l'appli qui installe l'APK).
        Updates.installWindows(new java.io.File(m.get("file").getAsString()));
        return new JsonObject();
    }

    /** Fichier de partage des cartes perso choisies (names) ou d'extensions entières (sets) : son chemin, et son contenu. */
    private JsonElement shareExport(final JsonObject m) {
        final java.util.Set<String> names = new java.util.LinkedHashSet<>();
        final java.util.Set<String> sets = new java.util.LinkedHashSet<>();
        if (m.has("names") && m.get("names").isJsonArray()) {
            m.getAsJsonArray("names").forEach(e -> names.add(e.getAsString()));
        }
        if (m.has("sets") && m.get("sets").isJsonArray()) {
            m.getAsJsonArray("sets").forEach(e -> sets.add(e.getAsString()));
        }
        final JsonObject data = CustomCards.shareExport(names, sets);
        final String label = optString(m, "label").replaceAll("[^\\p{L}\\p{N} _-]", "").trim();
        final String name = "ArcaneTable-" + (label.isEmpty() ? "cartes" : label.replace(' ', '-')) + ".atcards";
        final JsonObject o = shareFile(name, data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8), true);
        o.addProperty("count", data.getAsJsonObject("cards").size());
        return o;
    }

    /**
     * Écrit un fichier à partager dans le dossier que l'appli sait partager (Android : le dossier des mises à jour, servi
     * par son fournisseur de fichiers) ; withData : renvoie aussi son contenu (ordinateur : téléchargement par la page).
     */
    private JsonObject shareFile(final String name, final byte[] bytes, final boolean text) {
        final String safe = name == null || name.isEmpty() ? "partage" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        final java.io.File dir = new java.io.File(System.getProperty("atclaude.updatesDir",
                new java.io.File(System.getProperty("java.io.tmpdir"), "arcane-table-partage").getPath()));
        dir.mkdirs();
        final java.io.File f = new java.io.File(dir, safe);
        try {
            java.nio.file.Files.write(f.toPath(), bytes);
        } catch (final java.io.IOException e) {
            throw new IllegalStateException("Fichier de partage impossible à écrire : " + e.getMessage());
        }
        final JsonObject o = new JsonObject();
        o.addProperty("path", f.getAbsolutePath());
        o.addProperty("name", safe);
        o.addProperty("size", bytes.length);
        // Ordinateur (ni Android, qui donne son dossier des mises à jour, ni iPhone) : la page télécharge le contenu.
        if (System.getProperty("atclaude.updatesDir") == null && !ios) {
            o.addProperty(text ? "text" : "base64", text ? new String(bytes, java.nio.charset.StandardCharsets.UTF_8)
                    : B64.encode(bytes));
        }
        return o;
    }

    /** Les nouveautés de cette version (première section des notes de version livrées avec l'appli). */
    private JsonElement whatsNew() {
        final JsonObject o = new JsonObject();
        o.addProperty("version", appVersion);
        String notes = "";
        try (java.io.InputStream in = Bridge.class.getResourceAsStream("PATCH-NOTES.md")) {
            if (in != null) {
                final String md = new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                final int start = md.indexOf("\n## ");
                final int end = start < 0 ? -1 : md.indexOf("\n## ", start + 4);
                notes = start < 0 ? "" : md.substring(start + 1, end < 0 ? md.length() : end).trim();
            }
        } catch (final java.io.IOException e) {
            notes = "";
        }
        o.addProperty("notes", notes);
        return o;
    }

    private JsonElement handle(final String type, final JsonObject m) {
        switch (type) {
            case "imageDirect":
                return ImageService.directUrls(m.has("key") ? m.get("key").getAsString() : null, m.has("lang") ? m.get("lang").getAsString() : null);
            case "hello":
                return hello();
            case "whatsNew":
                return whatsNew();
            case "searchCards":
                return catalog.search(m.getAsJsonObject("query"));
            case "creatureTypes":
                return catalog.creatureTypes();
            case "tokenList":
                return Catalog.tokenList();
            case "customCards":
                return CustomCards.state();
            case "shareExport":
                return shareExport(m);
            case "shareImport":
                return CustomCards.shareImport(com.google.gson.JsonParser.parseString(m.get("data").getAsString()).getAsJsonObject());
            case "shareImage":
                return shareFile(optString(m, "name"), B64.decode(m.get("png").getAsString()), false);
            case "customValidate":
                return CustomCards.validate(m.get("script").getAsString(), optString(m, "previous"));
            case "customSave":
                return CustomCards.save(m.get("script").getAsString(), optString(m, "previous"), optString(m, "art"),
                        m.has("form") && !m.get("form").isJsonNull() ? m.get("form").toString() : null, optString(m, "frameImage"),
                        optString(m, "backArt"));
            case "customDelete":
                return CustomCards.delete(m.get("name").getAsString());
            case "customTypes":
                return CustomCards.setTypes(m.getAsJsonArray("types"));
            case "customSets":
                return CustomCards.sets();
            case "customSetSave":
                return CustomCards.saveSet(m);
            case "reprintSave":
                return Reprints.save(m);
            case "reprintDelete":
                return Reprints.delete(m.get("id").getAsString());
            case "customSetDelete":
                return CustomCards.deleteSet(m.get("id").getAsString());
            case "cardInfo":
                return catalog.cardInfo(m.get("name").getAsString());
            case "prints":
                return catalog.prints(m.get("name").getAsString());
            case "chooseArt":
                ArtChoices.choose(m.get("image").getAsString());
                return null;
            case "editions":
                return catalog.editions();
            case "listDecks":
                return m.has("career") && m.get("career").getAsBoolean() ? careerDecks() : catalog.listDecks();
            case "loadDeck":
                return catalog.loadDeck(m.get("name").getAsString());
            case "saveDeck": {
                final JsonObject deck = m.getAsJsonObject("deck");
                if (deck.has("career") && deck.get("career").getAsBoolean()) {
                    final JsonElement saved = Career.saveDeck(catalog, deck);
                    final String before = deck.has("previousName") ? deck.get("previousName").getAsString() : "";
                    if (!before.isEmpty() && deck.has("name") && !before.equals(deck.get("name").getAsString())) {
                        Stats.renameDeck(Career.KEY_PREFIX + before, Career.KEY_PREFIX + deck.get("name").getAsString(), deck.get("name").getAsString());
                    }
                    return saved;
                }
                final JsonElement saved = catalog.saveDeck(deck);
                final String previous = deck.has("previousName") ? deck.get("previousName").getAsString() : "";
                if (!previous.isEmpty() && deck.has("name") && !previous.equals(deck.get("name").getAsString())) {
                    final String format = deck.has("format") ? deck.get("format").getAsString() : "commander";
                    account.deckDeleted(format, previous);
                    // Le deck renommé garde ses statistiques.
                    Stats.renameDeck(format + ":" + previous, format + ":" + deck.get("name").getAsString(), deck.get("name").getAsString());
                }
                return saved;
            }
            case "deleteDeck": {
                final String key = m.get("name").getAsString();
                if (key.startsWith(Career.KEY_PREFIX)) {
                    Career.deleteDeck(key.substring(Career.KEY_PREFIX.length()));
                    return null;
                }
                catalog.deleteDeck(key);
                account.deckDeleted(key.substring(0, key.indexOf(':')), key.substring(key.indexOf(':') + 1));
                return null;
            }
            case "profile":
                return account.profile();
            case "updateProfile":
                return account.updateProfile(m.getAsJsonObject("profile"));
            case "linkGithub":
                return account.link(m.has("token") ? m.get("token").getAsString() : "");
            case "unlinkGithub":
                return account.unlink();
            case "updateCheck":
            case "updateDownload":
            case "updateInstall":
                try {
                    return updates(type, m);
                } catch (final java.io.IOException e) {
                    throw new IllegalStateException("Mise à jour impossible : " + e.getMessage(), e);
                }
            case "sync":
                return account.sync(m.has("prefs") && m.get("prefs").isJsonObject() ? m.getAsJsonObject("prefs") : new JsonObject(),
                        m.has("prefsAt") ? m.get("prefsAt").getAsLong() : 0, () -> session != null);
            case "parseDeck":
                return catalog.parseDeckText(m.get("text").getAsString(), m.has("name") ? m.get("name").getAsString() : "");
            case "fetchMoxfield":
                return catalog.fetchMoxfield(m.get("url").getAsString());
            case "validateDeck":
                return catalog.validate(m.getAsJsonObject("deck"));
            case "analyzeDeck":
                return catalog.analyze(m);
            case "deckSummaries":
                return catalog.deckSummaries(m.getAsJsonArray("keys"));
            case "randomCommanderDeck":
                return catalog.randomCommanderDeck();
            case "trophies":
                return Trophies.all();
            case "stats":
                return Stats.load();
            case "edhrec": {
                final List<String> names = new java.util.ArrayList<>();
                for (final JsonElement e : m.getAsJsonArray("commanders")) {
                    names.add(e.getAsString());
                }
                return Edhrec.present(catalog, Edhrec.fetch(names));
            }
            case "deckPrices":
                try {
                    return Prices.forCards(m.getAsJsonArray("cards"));
                } catch (final java.io.IOException e) {
                    throw new IllegalStateException("Prix indisponibles (" + e.getMessage() + "). Il faut Internet pour les lire chez Scryfall.");
                }
            case "clearStats":
                Stats.clear(m.has("career") ? m.get("career").getAsBoolean() : null);
                return null;
            case "career":
                return Career.summary(catalog);
            case "careerStartChoices":
                return Career.startChoices();
            case "careerStart":
                return Career.start(catalog, m.get("key").getAsString());
            case "careerDeckChoices":
                return Career.deckChoices();
            case "careerChooseDeck":
                return Career.chooseDeck(catalog, m.get("key").getAsString());
            case "careerBuyDeck":
                return Career.buyDeck(catalog, m.get("key").getAsString());
            case "careerDuel": {
                final String deck = m.get("deck").getAsString();
                return Career.duelInfo(catalog, deck.startsWith(Career.KEY_PREFIX) ? deck.substring(Career.KEY_PREFIX.length()) : deck);
            }
            case "careerBuyCard":
                return Career.buyCard(catalog, m.get("name").getAsString(), m.has("set") ? m.get("set").getAsString() : "",
                        m.has("art") ? m.get("art").getAsInt() : 0);
            case "careerAdjust":
                return Career.adjust(catalog, m);
            case "careerBuyCosmetic":
                return Career.buyCosmetic(catalog, m.get("id").getAsString());
            case "careerSwapChallenge":
                return Career.swapChallenge(catalog, m.get("id").getAsString());
            case "replays":
                return Replays.list();
            case "replayOpen":
                try {
                    return Replays.open(m.get("id").getAsString());
                } catch (final java.io.IOException e) {
                    throw new IllegalStateException("Replay illisible : " + e.getMessage());
                }
            case "replayFrame":
                try {
                    return Replays.frame(m.get("id").getAsString(), m.get("i").getAsInt());
                } catch (final java.io.IOException e) {
                    throw new IllegalStateException("Replay illisible : " + e.getMessage());
                }
            case "replayDelete":
                Replays.delete(m.get("id").getAsString());
                return Replays.list();
            case "careerReset":
                // Un duel gardé en cours (retour au menu) n'a plus de sens : il est abandonné avec la carrière.
                if (session != null && session.isCareer()) {
                    endSession();
                }
                SaveGame.deleteCareer();
                Career.reset();
                return Career.summary(catalog);
            case "boosterSets":
                return Career.boosterSets();
            case "puzzles":
                return Puzzles.list();
            case "frenchCards":
                return m.has("refresh") ? FrenchCards.refresh(m.has("force") && m.get("force").getAsBoolean(), () -> {
                    catalog.invalidateIndex();
                    sendEvent("frenchCards", e -> e.add("status", FrenchCards.status()));
                }) : FrenchCards.status();
            case "limitedSets": {
                final JsonObject o = new JsonObject();
                o.add("sets", Career.boosterSets());
                o.add("custom", Limited.customSets());
                o.add("cubes", Limited.cubes());
                return o;
            }
            case "limitedSealed":
                return Limited.sealed(m.get("set").getAsString());
            case "draftStart":
                return Limited.draftStart(m.get("set").getAsString());
            case "draftState":
                return Limited.draftState();
            case "draftPick":
                return Limited.draftPick(m.get("name").getAsString());
            case "limitedPool":
                return Limited.pool();
            case "limitedAuto":
                return Limited.autoDeck();
            case "limitedSetup":
                return Limited.setup(m.getAsJsonArray("cards"), m.getAsJsonObject("lands"), optString(m, "name"));
            case "buyBooster":
                return Career.buy(catalog, m.get("set").getAsString());
            case "openBooster":
                return Career.open(m.get("id").getAsString());
            case "openBoosters":
                return Career.openMany(m.getAsJsonArray("ids"));
            case "startMatch":
                startMatch(m.getAsJsonObject("setup"));
                return null;
            case "leaveMatch":
                endSession();
                return null;
            case "savedGame":
                return SaveGame.summary();
            case "resumeSaved": {
                final JsonObject save = SaveGame.read();
                if (save == null) {
                    throw new IllegalStateException("Aucune partie sauvegardée.");
                }
                endSession();
                session = MatchSession.resume(this, catalog, save);
                return null;
            }
            case "deleteSaved":
                SaveGame.delete(null);
                return null;
            case "rewind": {
                // Sandbox : la partie reprend depuis la photo d'avant (début de la phase précédente, à peu près).
                final MatchSession cur = session;
                if (cur == null) {
                    throw new IllegalStateException("Aucune partie en cours.");
                }
                final java.util.List<JsonObject> older = new java.util.ArrayList<>();
                final JsonObject target = cur.rewindTarget(older);
                if (target == null) {
                    throw new IllegalStateException("Rien à annuler pour l'instant : la partie n'a pas encore d'étape précédente.");
                }
                endSession();
                session = MatchSession.resume(this, catalog, target);
                session.keepHistory(older);
                return null;
            }
            default:
                final MatchSession current = session;
                if (current == null) {
                    throw new IllegalStateException("Aucune partie en cours (" + type + ").");
                }
                return current.handle(type, m);
        }
    }

    private JsonElement hello() {
        final JsonObject o = new JsonObject();
        o.addProperty("version", ForgeRuntime.version());
        o.addProperty("appVersion", appVersion);
        o.addProperty("channel", System.getProperty("atclaude.channel", ""));
        o.addProperty("ready", ForgeRuntime.isReady());
        o.addProperty("status", ForgeRuntime.status());
        o.addProperty("inMatch", session != null);
        if (ForgeRuntime.isReady()) {
            final com.google.gson.JsonArray profiles = new com.google.gson.JsonArray();
            AiLevels.displayList().forEach(profiles::add);
            o.add("aiProfiles", profiles);
        }
        if (session != null) {
            session.requestFullState();
        }
        // Les dialogues encore ouverts sont renvoyés : l'interface a pu être rechargée pendant une question.
        for (final JsonObject dialog : openDialogs.values()) {
            send(dialog);
        }
        return o;
    }

    /** Decks de la carrière (mode Planeswalker), au même format que ceux du mode Sandbox. */
    private JsonElement careerDecks() {
        final JsonObject o = new JsonObject();
        o.add("decks", Career.summary(catalog).getAsJsonArray("decks"));
        o.add("precons", new com.google.gson.JsonArray());
        return o;
    }

    private void startMatch(final JsonObject setup) {
        endSession();
        session = MatchSession.start(this, catalog, setup);
    }

    void endSession() {
        final MatchSession old = session;
        session = null;
        ImageService.cancelPrefetch();
        cancelDialogs();
        if (old != null) {
            old.close();
        }
    }

    void sessionFinished(final MatchSession finished) {
        if (session == finished) {
            session = null;
        }
    }

    // ------------------------------------------------------------------ dialogues

    /**
     * Pose une question à l'interface et bloque le fil appelant jusqu'à la réponse.
     * Renvoie JsonNull si la partie est abandonnée entre-temps.
     */
    JsonElement ask(final String kind, final JsonObject dialog) {
        final int id = dialogIds.incrementAndGet();
        dialog.addProperty("type", "dialog");
        dialog.addProperty("kind", kind);
        dialog.addProperty("id", id);
        final CompletableFuture<JsonElement> future = new CompletableFuture<>();
        pendingDialogs.put(id, future);
        openDialogs.put(id, dialog);
        send(dialog);
        try {
            return future.get();
        } catch (final InterruptedException e) {
            Thread.currentThread().interrupt();
            return JsonNull.INSTANCE;
        } catch (final ExecutionException e) {
            return JsonNull.INSTANCE;
        } finally {
            pendingDialogs.remove(id);
            openDialogs.remove(id);
        }
    }

    private void answerDialog(final JsonObject message) {
        final int id = message.get("id").getAsInt();
        final CompletableFuture<JsonElement> future = pendingDialogs.get(id);
        if (future != null) {
            future.complete(message.has("value") ? message.get("value") : JsonNull.INSTANCE);
        }
    }

    private void cancelDialogs() {
        for (final CompletableFuture<JsonElement> future : pendingDialogs.values()) {
            future.complete(JsonNull.INSTANCE);
        }
        for (final Integer id : openDialogs.keySet()) {
            sendEvent("dialogClosed", m -> m.addProperty("id", id));
        }
    }

    Catalog catalog() {
        return catalog;
    }
}
