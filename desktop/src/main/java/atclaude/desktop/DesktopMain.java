package atclaude.desktop;

import atclaude.bridge.Bridge;
import atclaude.bridge.ForgeRuntime;
import atclaude.bridge.ImageService;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.awt.Desktop;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Version ordinateur : Forge tourne dans ce processus et l'interface s'ouvre dans le navigateur,
 * sur http://127.0.0.1:PORT. Rien n'écoute en dehors de la machine.
 *
 * Options : --assets DOSSIER (contient res/), --data DOSSIER, --ui DOSSIER, --port N, --no-browser,
 * --mobile (démarre Forge comme sur Android, pour tester ce chemin sur ordinateur), --no-window
 */
public final class DesktopMain {

    private static final Map<String, String> TYPES = Map.of(
            "html", "text/html; charset=utf-8", "js", "text/javascript; charset=utf-8",
            "css", "text/css; charset=utf-8", "svg", "image/svg+xml", "png", "image/png",
            "jpg", "image/jpeg", "json", "application/json", "webmanifest", "application/manifest+json",
            "woff2", "font/woff2", "ico", "image/x-icon");

    /** Un onglet connecté au flux d'événements. */
    private static final class Client {
        final BlockingQueue<String> queue = new LinkedBlockingQueue<>();
    }

    private static final List<Client> CLIENTS = new CopyOnWriteArrayList<>();

    private DesktopMain() { }

    public static void main(final String[] args) throws IOException {
        // Par défaut, forge/ et ui/ sont à côté du jar : c'est la disposition du paquet Windows.
        final File home = appHome();
        final String assets = option(args, "--assets", new File(home, "forge").getPath());
        final String data = option(args, "--data", System.getProperty("user.home") + File.separator + ".atclaude");
        final File ui = new File(option(args, "--ui", new File(home, "ui").getPath()));
        final int port = Integer.parseInt(option(args, "--port", "8765"));
        final boolean openBrowser = !List.of(args).contains("--no-browser");
        final boolean mobile = List.of(args).contains("--mobile");

        if (!new File(assets, "res").isDirectory()) {
            System.err.println("Ressources Forge introuvables : " + new File(assets, "res").getAbsolutePath());
            System.exit(1);
        }

        final Bridge bridge = new Bridge(json -> {
            for (final Client c : CLIENTS) {
                c.queue.offer(json);
            }
        });

        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/api/events", DesktopMain::events);
        server.createContext("/api/send", exchange -> {
            if (!"POST".equals(exchange.getRequestMethod())) {
                reply(exchange, 405, "text/plain", new byte[0]);
                return;
            }
            final String body;
            try (InputStream in = exchange.getRequestBody()) {
                body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
            bridge.receive(body);
            reply(exchange, 204, "text/plain", null);
        });
        server.createContext("/cardimg", exchange -> {
            final String key = query(exchange.getRequestURI(), "key");
            final ImageService.Served img = ImageService.image(key, query(exchange.getRequestURI(), "lang"), 15_000);
            if (img == null) {
                reply(exchange, 404, "text/plain", new byte[0]);
                return;
            }
            // L'anglais servi en attendant la version française ne doit pas rester dans le cache du navigateur.
            exchange.getResponseHeaders().add("Cache-Control", img.cacheable() ? "max-age=604800" : "no-store");
            exchange.getResponseHeaders().add("Content-Language", img.lang());
            reply(exchange, 200, ImageService.contentType(img.file()), Files.readAllBytes(img.file().toPath()));
        });
        server.createContext("/", exchange -> serveStatic(exchange, ui));
        server.start();

        final String url = "http://127.0.0.1:" + port + "/";
        System.out.println("Arcane Table : " + url);
        if (openBrowser) {
            browse(url);
        }
        if (!java.awt.GraphicsEnvironment.isHeadless() && !List.of(args).contains("--no-window")) {
            ControlWindow.show(url, DesktopMain::browse);
        }

        final ForgeRuntime.Paths paths = new ForgeRuntime.Paths(
                new File(assets).getAbsolutePath(),
                new File(data, "data").getAbsolutePath(),
                new File(data, "cache").getAbsolutePath());
        final Thread loader = new Thread(() -> {
            try {
                ForgeRuntime.init(bridge, paths, !mobile);
                System.out.println("Forge prêt.");
            } catch (final Throwable e) {
                e.printStackTrace();
                bridge.notifyFatal("Échec du chargement de Forge : " + e);
            }
        }, "atclaude-loader");
        loader.start();
    }

    /** Flux Server-Sent Events : un message JSON par événement. */
    private static void events(final HttpExchange exchange) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", "text/event-stream; charset=utf-8");
        exchange.getResponseHeaders().add("Cache-Control", "no-cache");
        exchange.sendResponseHeaders(200, 0);
        final Client client = new Client();
        CLIENTS.add(client);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(": ok\n\n".getBytes(StandardCharsets.UTF_8));
            out.flush();
            while (true) {
                final String json = client.queue.poll(15, TimeUnit.SECONDS);
                final String frame = json == null ? ": ping\n\n" : "data: " + json.replace("\n", "\ndata: ") + "\n\n";
                out.write(frame.getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
        } catch (final IOException | InterruptedException e) {
            // onglet fermé
        } finally {
            CLIENTS.remove(client);
        }
    }

    private static void serveStatic(final HttpExchange exchange, final File root) throws IOException {
        String path = URLDecoder.decode(exchange.getRequestURI().getPath(), StandardCharsets.UTF_8);
        if (path.endsWith("/")) {
            path += "index.html";
        }
        final File file = new File(root, path).getCanonicalFile();
        if (!file.getPath().startsWith(root.getCanonicalPath()) || !file.isFile()) {
            reply(exchange, 404, "text/plain", "Introuvable".getBytes(StandardCharsets.UTF_8));
            return;
        }
        final String name = file.getName();
        final String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1) : "";
        exchange.getResponseHeaders().add("Cache-Control", "no-cache");
        reply(exchange, 200, TYPES.getOrDefault(ext, "application/octet-stream"), Files.readAllBytes(file.toPath()));
    }

    private static void reply(final HttpExchange exchange, final int code, final String type, final byte[] body) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", type);
        if (body == null || body.length == 0) {
            exchange.sendResponseHeaders(code, -1);
        } else {
            exchange.sendResponseHeaders(code, body.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        }
        exchange.close();
    }

    private static String query(final URI uri, final String key) {
        final String q = uri.getRawQuery();
        if (q == null) {
            return null;
        }
        for (final String part : q.split("&")) {
            final int eq = part.indexOf('=');
            if (eq > 0 && part.substring(0, eq).equals(key)) {
                return URLDecoder.decode(part.substring(eq + 1), StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    static void browse(final String url) {
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(URI.create(url));
                return;
            }
        } catch (final Exception e) {
            // on affiche l'adresse ci-dessous
        }
        System.out.println("Ouvre " + url + " dans ton navigateur.");
    }

    /** Dossier du jar (ou dossier courant si on lance depuis les classes compilées). */
    private static File appHome() {
        try {
            final File jar = new File(DesktopMain.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            if (jar.isFile()) {
                return jar.getParentFile();
            }
        } catch (final Exception e) {
            // dossier courant
        }
        return new File(".");
    }

    private static String option(final String[] args, final String name, final String fallback) {
        for (int i = 0; i < args.length - 1; i++) {
            if (args[i].equals(name)) {
                return args[i + 1];
            }
        }
        return fallback;
    }
}
