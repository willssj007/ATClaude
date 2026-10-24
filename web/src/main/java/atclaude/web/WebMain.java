package atclaude.web;

import atclaude.bridge.Bridge;
import atclaude.bridge.ForgeRuntime;
import atclaude.bridge.ImageService;
import atclaude.bridge.Net;
import com.google.gson.JsonObject;

import java.io.File;
import java.util.Map;

/**
 * Version iPhone (PWA) : Forge tourne dans la page, sur la machine Java de CheerpJ (WebAssembly).
 *
 * Il n'y a ni serveur ni WebView : l'interface (ui/js/pwa.js) appelle {@link #receive} sur l'objet que
 * {@link #nativeReady} lui confie, et le pont lui répond par la méthode native {@link #deliver}. Java ne peut
 * joindre que son propre site : les requêtes vers Scryfall, GitHub... passent par le fetch du navigateur
 * ({@link FetchHandler}). Les ressources de Forge sont installées une fois dans /files/ (stockage persistant
 * du navigateur), comme sur Android.
 *
 * Arguments : dossier du site vu par CheerpJ (« /app/ATClaude/ »), version de l'application, chemin de
 * res.zip dans le site, son empreinte et sa taille.
 */
public final class WebMain {

    /** Racine des données dans le stockage persistant du navigateur. */
    static final String ROOT = "/files/atclaude/";

    // ------------------------------------------------------------------ méthodes natives (ui/js/pwa.js)

    /** Confie l'application à JavaScript ; ne rend jamais la main (garde ce fil vivant pour les appels de la page). */
    private static native void nativeReady(WebMain app);

    /** Un message du pont pour l'interface. */
    static native void deliver(String json);

    /** Requête HTTP par fetch : renvoie {"id", "status", "headers"} (status 0 : réseau injoignable). */
    static native String fetchStart(String method, String url, String headers, byte[] body, int timeoutMs);

    /** Corps de la réponse {@code id} (une seule fois). */
    static native byte[] fetchBody(int id);

    // ------------------------------------------------------------------

    private final Bridge bridge;

    private WebMain() {
        bridge = new Bridge(json -> {
            try {
                deliver(json);
            } catch (final RuntimeException e) {
                e.printStackTrace();
            }
        });
    }

    /** Message de l'interface (appelé par la page). */
    public void receive(final String json) {
        bridge.receive(json);
    }

    /**
     * Image d'une carte pour le service worker : {"path", "lang", "cacheable", "type"}, ou "" si elle est
     * introuvable. La page lit ensuite le fichier dans /files/ (cjFileBlob).
     */
    public String imageInfo(final String key, final String lang, final boolean exact) {
        final ImageService.Served img = ImageService.image(key, lang, 20_000, exact);
        if (img == null) {
            return "";
        }
        final JsonObject o = new JsonObject();
        o.addProperty("path", img.file().getAbsolutePath());
        o.addProperty("lang", img.lang());
        o.addProperty("cacheable", img.cacheable());
        o.addProperty("type", ImageService.contentType(img.file()));
        return o.toString();
    }

    /** Pile d'appels de chaque fil Java, pour comprendre un blocage (depuis la page : AT_WEB.threads()). */
    public String threads() {
        final StringBuilder sb = new StringBuilder();
        try {
            for (final Map.Entry<Thread, StackTraceElement[]> e : Thread.getAllStackTraces().entrySet()) {
                sb.append('"').append(e.getKey().getName()).append("\" ").append(e.getKey().getState()).append('\n');
                for (final StackTraceElement el : e.getValue()) {
                    sb.append("    at ").append(el).append('\n');
                }
            }
        } catch (final RuntimeException | Error e) {
            sb.append("Piles indisponibles : ").append(e);
        }
        return sb.toString();
    }

    /** Diagnostic : création de cartes pas à pas, hors partie (voir {@link Probe}). */
    public String probe() {
        return Probe.run();
    }

    public static void main(final String[] args) {
        final String site = args.length > 0 ? args[0] : "/app/";
        final String version = args.length > 1 ? args[1] : "";
        final String resPath = args.length > 2 ? args[2] : "forge/res.zip";
        final String resHash = args.length > 3 ? args[3] : version;
        final long resSize = args.length > 4 ? parseLong(args[4]) : -1;

        Net.setHandler(new FetchHandler());
        Bridge.setAppVersion(version);
        final WebMain app = new WebMain();
        // Ce fil reste dans nativeReady : tant qu'il vit, le programme aussi (CheerpJ s'arrête quand il n'y a plus
        // de fil utilisateur, comme une JVM).
        final Thread js = new Thread(() -> nativeReady(app), "atclaude-js");
        js.start();

        final Thread loader = new Thread(() -> {
            try {
                final File assets = ResInstall.ensure(site + resPath, new File(ROOT + "forge"), resHash, resSize,
                        percent -> app.bridge.notifyLoading("Installation des cartes dans le navigateur (une seule fois)…", percent));
                // Mise en route avant d'annoncer Forge prêt : voir Probe.warmUp.
                ForgeRuntime.init(app.bridge, new ForgeRuntime.Paths(assets.getPath(), ROOT + "data", ROOT + "cache"), false,
                        Probe::warmUp);
                System.out.println("Forge prêt.");
            } catch (final Throwable e) {
                e.printStackTrace();
                app.bridge.notifyFatal("Échec du chargement de Forge dans le navigateur : " + e);
            }
        }, "atclaude-loader");
        loader.start();
        try {
            js.join();
        } catch (final InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static long parseLong(final String s) {
        try {
            return Long.parseLong(s);
        } catch (final NumberFormatException e) {
            return -1;
        }
    }
}
