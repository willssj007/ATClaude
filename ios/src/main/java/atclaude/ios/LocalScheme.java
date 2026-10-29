package atclaude.ios;

import atclaude.bridge.ImageService;
import org.robovm.apple.dispatch.DispatchQueue;
import org.robovm.apple.foundation.NSBundle;
import org.robovm.apple.foundation.NSData;
import org.robovm.apple.foundation.NSError;
import org.robovm.apple.foundation.NSHTTPURLResponse;
import org.robovm.apple.foundation.NSURL;
import org.robovm.apple.webkit.WKURLSchemeHandlerAdapter;
import org.robovm.apple.webkit.WKURLSchemeTask;
import org.robovm.apple.webkit.WKWebView;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Contenus de la page sous atclaude://app/ : les fichiers de l'interface (dossier ui/ du paquet) et les images des
 * cartes (« cardimg?key=... », servies par le pont, téléchargées au besoin). Les réponses partent sur le fil
 * principal ; une requête abandonnée par la page entre-temps n'en reçoit pas.
 */
final class LocalScheme extends WKURLSchemeHandlerAdapter {

    private static final Map<String, String> TYPES = new HashMap<>();

    static {
        TYPES.put("html", "text/html; charset=utf-8");
        TYPES.put("js", "text/javascript; charset=utf-8");
        TYPES.put("css", "text/css; charset=utf-8");
        TYPES.put("svg", "image/svg+xml");
        TYPES.put("png", "image/png");
        TYPES.put("jpg", "image/jpeg");
        TYPES.put("json", "application/json");
        TYPES.put("webmanifest", "application/manifest+json");
        TYPES.put("woff2", "font/woff2");
        TYPES.put("mp3", "audio/mpeg");
    }

    private final File ui = new File(NSBundle.getMainBundle().getBundlePath(), "ui");
    /** Requêtes en cours : WebKit refuse toute réponse à une requête qu'il a arrêtée. */
    private final Set<WKURLSchemeTask> live = Collections.newSetFromMap(new IdentityHashMap<>());
    /** Lecture des fichiers et téléchargement des images, hors du fil principal. */
    private final ExecutorService workers = Executors.newFixedThreadPool(6);

    @Override
    public void startURLSchemeTask(final WKWebView view, final WKURLSchemeTask task) {
        synchronized (live) {
            live.add(task);
        }
        final NSURL url = task.getRequest().getURL();
        final String path = url.getPath() == null || url.getPath().isEmpty() || "/".equals(url.getPath()) ? "/index.html" : url.getPath();
        workers.execute(() -> serve(task, url, path));
    }

    @Override
    public void stopURLSchemeTask(final WKWebView view, final WKURLSchemeTask task) {
        synchronized (live) {
            live.remove(task);
        }
    }

    private void serve(final WKURLSchemeTask task, final NSURL url, final String path) {
        try {
            if ("/cardimg".equals(path)) {
                final Map<String, String> q = query(url.getQuery());
                final ImageService.Served img = ImageService.image(q.get("key"), q.get("lang"), 15_000, "1".equals(q.get("exact")));
                if (img == null) {
                    respond(task, url, 404, "text/plain", new byte[0], "no-store");
                    return;
                }
                // L'anglais servi en attendant la version française ne doit pas rester dans le cache.
                respond(task, url, 200, ImageService.contentType(img.file()), read(img.file()),
                        img.cacheable() ? "max-age=604800" : "no-store");
                return;
            }
            final File file = new File(ui, path.substring(1));
            if (!file.getCanonicalPath().startsWith(ui.getCanonicalPath()) || !file.isFile()) {
                respond(task, url, 404, "text/plain", new byte[0], "no-store");
                return;
            }
            final String name = file.getName();
            final String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1) : "";
            respond(task, url, 200, TYPES.containsKey(ext) ? TYPES.get(ext) : "application/octet-stream", read(file), "no-cache");
        } catch (final IOException | RuntimeException e) {
            fail(task, e);
        }
    }

    private void respond(final WKURLSchemeTask task, final NSURL url, final int status, final String type,
                         final byte[] body, final String cache) {
        final Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", type);
        headers.put("Content-Length", Integer.toString(body.length));
        headers.put("Cache-Control", cache);
        headers.put("Access-Control-Allow-Origin", "*");
        DispatchQueue.getMainQueue().async(() -> {
            synchronized (live) {
                if (!live.remove(task)) {
                    return;
                }
            }
            task.didReceiveResponse(new NSHTTPURLResponse(url, status, "HTTP/1.1", headers));
            if (body.length > 0) {
                task.didReceiveData(new NSData(body));
            }
            task.didFinish();
        });
    }

    private void fail(final WKURLSchemeTask task, final Exception e) {
        DispatchQueue.getMainQueue().async(() -> {
            synchronized (live) {
                if (!live.remove(task)) {
                    return;
                }
            }
            task.didFail(new NSError("ArcaneTable", 1, null));
        });
        e.printStackTrace();
    }

    private static byte[] read(final File file) throws IOException {
        try (InputStream in = new FileInputStream(file)) {
            final ByteArrayOutputStream out = new ByteArrayOutputStream((int) Math.max(16, file.length()));
            final byte[] buf = new byte[65536];
            for (int n; (n = in.read(buf)) > 0; ) {
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }

    private static Map<String, String> query(final String q) {
        final Map<String, String> m = new HashMap<>();
        if (q == null) {
            return m;
        }
        for (final String part : q.split("&")) {
            final int eq = part.indexOf('=');
            final String k = eq < 0 ? part : part.substring(0, eq);
            final String v = eq < 0 ? "" : part.substring(eq + 1);
            try {
                m.put(URLDecoder.decode(k, "UTF-8"), URLDecoder.decode(v, "UTF-8"));
            } catch (final UnsupportedEncodingException e) {
                m.put(k, v);
            }
        }
        return m;
    }
}
