package atclaude.desktop;

import atclaude.bridge.Presence;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.Closeable;
import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.net.StandardProtocolFamily;
import java.net.URLEncoder;
import java.net.UnixDomainSocketAddress;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Présence riche Discord : ce que fait le joueur (menus, partie, deck, points de vie...) s'affiche sur son profil.
 * Discord tourne sur le même ordinateur et écoute sur une connexion locale (tube nommé « discord-ipc-N » sous Windows,
 * socket Unix ailleurs) ; chaque message est un en-tête (opération, longueur, en petit-boutiste) suivi de JSON.
 * Discord limite les mises à jour (environ une toutes les 4 secondes) : seule la dernière activité en attente part.
 * Sans Discord ouvert, on réessaie de temps en temps, sans rien bloquer.
 */
final class DiscordRpc implements Presence.Sink {

    private static final int HANDSHAKE = 0;
    private static final int FRAME = 1;
    private static final int CLOSE = 2;
    private static final long MIN_GAP_MS = 4000;
    private static final long RETRY_MS = 20000;
    /** Logo de l'application (dépôt public), et page pour récupérer l'application. */
    private static final String LOGO = "https://raw.githubusercontent.com/willssj007/atclaude/main/ui/img/icon-512.png";
    private static final String HOME = "https://github.com/willssj007/atclaude";

    private final String clientId;
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-discord");
        t.setDaemon(true);
        return t;
    });
    private Pipe pipe;
    private JsonObject pending;
    private boolean hasPending;
    private boolean scheduled;
    private long lastSentAt;
    private long nextRetryAt;

    DiscordRpc(final String clientId) {
        this.clientId = clientId;
    }

    /** Identifiant de l'application Discord : réglage -Datclaude.discordId, ou variable ATCLAUDE_DISCORD_ID. */
    static String configuredId(final String builtIn) {
        final String prop = System.getProperty("atclaude.discordId");
        if (prop != null && !prop.isBlank()) {
            return prop.trim();
        }
        final String env = System.getenv("ATCLAUDE_DISCORD_ID");
        if (env != null && !env.isBlank()) {
            return env.trim();
        }
        return builtIn;
    }

    @Override
    public synchronized void update(final JsonObject activity) {
        pending = activity;
        hasPending = true;
        if (!scheduled) {
            scheduled = true;
            final long wait = Math.max(0, lastSentAt + MIN_GAP_MS - System.currentTimeMillis());
            worker.schedule(this::flush, wait, TimeUnit.MILLISECONDS);
        }
    }

    private void flush() {
        final JsonObject activity;
        synchronized (this) {
            scheduled = false;
            if (!hasPending) {
                return;
            }
            activity = pending;
            hasPending = false;
        }
        try {
            if (pipe == null) {
                if (System.currentTimeMillis() < nextRetryAt) {
                    retryLater(activity);
                    return;
                }
                pipe = connect();
                if (pipe == null) {
                    nextRetryAt = System.currentTimeMillis() + RETRY_MS;
                    retryLater(activity);
                    return;
                }
            }
            final JsonObject args = new JsonObject();
            args.addProperty("pid", ProcessHandle.current().pid());
            if (activity != null) {
                args.add("activity", toDiscord(activity));
            }
            final JsonObject cmd = new JsonObject();
            cmd.addProperty("cmd", "SET_ACTIVITY");
            cmd.add("args", args);
            cmd.addProperty("nonce", Long.toHexString(System.nanoTime()));
            pipe.write(FRAME, cmd.toString());
            pipe.read();
            lastSentAt = System.currentTimeMillis();
        } catch (final IOException | RuntimeException e) {
            // Discord fermé ou redémarré : on se reconnectera plus tard avec la dernière activité.
            closePipe();
            nextRetryAt = System.currentTimeMillis() + RETRY_MS;
            retryLater(activity);
        }
    }

    /** L'activité reste en attente (sauf si une plus récente est arrivée) et repart au prochain essai. */
    private synchronized void retryLater(final JsonObject activity) {
        if (!hasPending) {
            pending = activity;
            hasPending = true;
        }
        if (!scheduled) {
            scheduled = true;
            worker.schedule(this::flush, Math.max(1000, nextRetryAt - System.currentTimeMillis()), TimeUnit.MILLISECONDS);
        }
    }

    /** Activité au format de Discord : deux lignes, temps écoulé, illustration du commandant, logo, lien. */
    private static JsonObject toDiscord(final JsonObject a) {
        final JsonObject o = new JsonObject();
        o.addProperty("details", clip(str(a, "details")));
        o.addProperty("state", clip(str(a, "state")));
        if (a.has("since")) {
            final JsonObject ts = new JsonObject();
            ts.addProperty("start", a.get("since").getAsLong());
            o.add("timestamps", ts);
        }
        final JsonObject assets = new JsonObject();
        final String card = str(a, "image");
        if (!card.isEmpty()) {
            // Illustration du commandant (Scryfall), le logo de l'application en petit.
            assets.addProperty("large_image", "https://api.scryfall.com/cards/named?format=image&version=art_crop&exact="
                    + URLEncoder.encode(card, StandardCharsets.UTF_8).replace("+", "%20"));
            assets.addProperty("large_text", clip(str(a, "imageText")));
            assets.addProperty("small_image", LOGO);
            assets.addProperty("small_text", "planeswalker".equals(str(a, "mode")) ? "Mode Planeswalker" : "Mode Sandbox");
        } else {
            assets.addProperty("large_image", LOGO);
            assets.addProperty("large_text", "Arcane Table");
        }
        o.add("assets", assets);
        final JsonArray buttons = new JsonArray();
        final JsonObject b = new JsonObject();
        b.addProperty("label", "Arcane Table");
        b.addProperty("url", HOME);
        buttons.add(b);
        o.add("buttons", buttons);
        o.addProperty("instance", false);
        return o;
    }

    private static String str(final JsonObject o, final String k) {
        return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : "";
    }

    /** Discord refuse les textes de plus de 128 caractères (et de moins de 2). */
    private static String clip(final String s) {
        final String t = s.length() > 127 ? s.substring(0, 126) + "…" : s;
        return t.length() < 2 ? t + "  " : t;
    }

    // ------------------------------------------------------------------ connexion locale

    private Pipe connect() {
        for (final Pipe.Opener open : openers()) {
            try {
                final Pipe p = open.open();
                if (p == null) {
                    continue;
                }
                final JsonObject hello = new JsonObject();
                hello.addProperty("v", 1);
                hello.addProperty("client_id", clientId);
                p.write(HANDSHAKE, hello.toString());
                final String ready = p.read();
                if (ready.contains("\"READY\"")) {
                    return p;
                }
                System.err.println("Discord a refusé la connexion : " + ready);
                p.close();
            } catch (final IOException | RuntimeException e) {
                // Pas de Discord à cette adresse : on essaie la suivante.
            }
        }
        return null;
    }

    private void closePipe() {
        if (pipe != null) {
            try {
                pipe.close();
            } catch (final IOException e) {
                // déjà fermé
            }
            pipe = null;
        }
    }

    /** Adresses où Discord peut écouter : discord-ipc-0 à 9, dans les dossiers habituels selon le système. */
    private static List<Pipe.Opener> openers() {
        final List<Pipe.Opener> list = new ArrayList<>();
        final boolean windows = System.getProperty("os.name", "").toLowerCase().contains("win");
        for (int i = 0; i < 10; i++) {
            final String name = "discord-ipc-" + i;
            if (windows) {
                list.add(() -> new FilePipe(new RandomAccessFile("\\\\.\\pipe\\" + name, "rw")));
            } else {
                for (final String dir : unixDirs()) {
                    for (final String sub : new String[] {"", "app/com.discordapp.Discord/", "snap.discord/", ".flatpak/com.discordapp.Discord/xdg-run/"}) {
                        final File f = new File(dir, sub + name);
                        list.add(() -> f.exists() ? new SocketPipe(f) : null);
                    }
                }
            }
        }
        return list;
    }

    private static List<String> unixDirs() {
        final List<String> dirs = new ArrayList<>();
        for (final String env : new String[] {"XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"}) {
            final String v = System.getenv(env);
            if (v != null && !v.isBlank() && !dirs.contains(v)) {
                dirs.add(v);
            }
        }
        dirs.add("/tmp");
        return dirs;
    }

    /** Une connexion à Discord : messages en trames (opération, longueur, JSON). */
    private abstract static class Pipe implements Closeable {
        interface Opener {
            Pipe open() throws IOException;
        }

        abstract void writeBytes(byte[] b) throws IOException;

        abstract void readFully(byte[] b) throws IOException;

        void write(final int op, final String json) throws IOException {
            final byte[] body = json.getBytes(StandardCharsets.UTF_8);
            final ByteBuffer b = ByteBuffer.allocate(8 + body.length).order(ByteOrder.LITTLE_ENDIAN);
            b.putInt(op).putInt(body.length).put(body);
            writeBytes(b.array());
        }

        /** Lit une trame ; une trame CLOSE (Discord met fin à la connexion) lève une erreur. */
        String read() throws IOException {
            final byte[] head = new byte[8];
            readFully(head);
            final ByteBuffer h = ByteBuffer.wrap(head).order(ByteOrder.LITTLE_ENDIAN);
            final int op = h.getInt();
            final int len = h.getInt();
            if (len < 0 || len > 1 << 20) {
                throw new IOException("Trame Discord invalide");
            }
            final byte[] body = new byte[len];
            readFully(body);
            final String json = new String(body, StandardCharsets.UTF_8);
            if (op == CLOSE) {
                throw new IOException("Discord a fermé la connexion : " + json);
            }
            // Erreur de commande (activité refusée) : on la signale sans couper la connexion.
            if (json.contains("\"evt\":\"ERROR\"")) {
                System.err.println("Discord : " + JsonParser.parseString(json).getAsJsonObject().get("data"));
            }
            return json;
        }
    }

    /** Windows : tube nommé, ouvert comme un fichier. */
    private static final class FilePipe extends Pipe {
        private final RandomAccessFile file;

        FilePipe(final RandomAccessFile file) {
            this.file = file;
        }

        @Override
        void writeBytes(final byte[] b) throws IOException {
            file.write(b);
        }

        @Override
        void readFully(final byte[] b) throws IOException {
            file.readFully(b);
        }

        @Override
        public void close() throws IOException {
            file.close();
        }
    }

    /** Linux et macOS : socket Unix. */
    private static final class SocketPipe extends Pipe {
        private final SocketChannel channel;

        SocketPipe(final File path) throws IOException {
            channel = SocketChannel.open(StandardProtocolFamily.UNIX);
            channel.connect(UnixDomainSocketAddress.of(path.toPath()));
        }

        @Override
        void writeBytes(final byte[] b) throws IOException {
            final ByteBuffer buf = ByteBuffer.wrap(b);
            while (buf.hasRemaining()) {
                channel.write(buf);
            }
        }

        @Override
        void readFully(final byte[] b) throws IOException {
            final ByteBuffer buf = ByteBuffer.wrap(b);
            while (buf.hasRemaining()) {
                if (channel.read(buf) < 0) {
                    throw new IOException("Connexion Discord fermée");
                }
            }
        }

        @Override
        public void close() throws IOException {
            channel.close();
        }
    }
}
