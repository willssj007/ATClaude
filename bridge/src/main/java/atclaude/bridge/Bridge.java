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

    private final Transport transport;
    private final ExecutorService edt;
    private volatile Thread edtThread;
    private final Map<Integer, CompletableFuture<JsonElement>> pendingDialogs = new ConcurrentHashMap<>();
    private final Map<Integer, JsonObject> openDialogs = new ConcurrentHashMap<>();
    private final AtomicInteger dialogIds = new AtomicInteger();
    private final Catalog catalog = new Catalog();
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
        if (NETWORK_REQUESTS.contains(type)) {
            // Appels réseau (GitHub) : sur leur propre fil, pour ne pas figer la partie pendant l'attente.
            network.execute(() -> dispatch(type, message));
            return;
        }
        if ("deckSummaries".equals(type)) {
            // Analyse de nombreux decks : à part, pour ne pas retarder le reste de l'interface.
            analyzer.execute(() -> dispatch(type, message));
            return;
        }
        if ("edhrec".equals(type)) {
            // Lecture d'EDHREC : à part, pour ne pas attendre derrière une synchronisation.
            web.execute(() -> dispatch(type, message));
            return;
        }
        runOnEdt(() -> dispatch(type, message));
    }

    private static final java.util.Set<String> NETWORK_REQUESTS = java.util.Set.of("sync", "linkGithub");
    private final java.util.concurrent.ExecutorService network = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-net");
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

    private JsonElement handle(final String type, final JsonObject m) {
        switch (type) {
            case "hello":
                return hello();
            case "searchCards":
                return catalog.search(m.getAsJsonObject("query"));
            case "cardInfo":
                return catalog.cardInfo(m.get("name").getAsString());
            case "listDecks":
                return catalog.listDecks();
            case "loadDeck":
                return catalog.loadDeck(m.get("name").getAsString());
            case "saveDeck": {
                final JsonObject deck = m.getAsJsonObject("deck");
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
            case "audioFiles":
                return Audio.files();
            case "trophies":
                return Trophies.all();
            case "stats":
                return Stats.load();
            case "edhrec": {
                final List<String> names = new java.util.ArrayList<>();
                for (final JsonElement e : m.getAsJsonArray("commanders")) {
                    names.add(e.getAsString());
                }
                final JsonObject raw = Edhrec.fetch(names);
                final JsonObject[] out = new JsonObject[1];
                callOnEdt(() -> out[0] = Edhrec.present(catalog, raw));
                return out[0];
            }
            case "clearStats":
                Stats.clear();
                return null;
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
        o.addProperty("ready", ForgeRuntime.isReady());
        o.addProperty("status", ForgeRuntime.status());
        o.addProperty("inMatch", session != null);
        if (ForgeRuntime.isReady()) {
            final com.google.gson.JsonArray profiles = new com.google.gson.JsonArray();
            forge.ai.AiProfileUtil.getProfilesDisplayList().forEach(profiles::add);
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
