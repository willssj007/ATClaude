package atclaude.android;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.DisplayCutout;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import atclaude.bridge.Bridge;
import atclaude.bridge.ForgeRuntime;
import atclaude.bridge.ImageService;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * L'application Android : une WebView qui affiche l'interface (assets/ui) et le moteur Forge
 * qui tourne dans le même processus. Les deux échangent des messages JSON par le pont.
 *
 * L'interface est servie sous https://appassets.androidplatform.net/ (adresse réservée aux
 * contenus locaux) pour que les modules JavaScript se chargent comme sur un vrai site.
 */
public class MainActivity extends Activity {

    private static final String TAG = "ArcaneTable";
    private static final String HOST = "appassets.androidplatform.net";
    private static final Map<String, String> TYPES = new HashMap<>();

    static {
        TYPES.put("html", "text/html");
        TYPES.put("js", "text/javascript");
        TYPES.put("css", "text/css");
        TYPES.put("svg", "image/svg+xml");
        TYPES.put("png", "image/png");
        TYPES.put("jpg", "image/jpeg");
        TYPES.put("json", "application/json");
        TYPES.put("webmanifest", "application/manifest+json");
        TYPES.put("woff2", "font/woff2");
    }

    /** Le pont et Forge vivent aussi longtemps que le processus, même si l'activité est recréée. */
    private static Bridge bridge;
    private static MainActivity current;
    private static boolean started;
    /** Dossier res/ des ressources installées (musiques et sons servis à l'interface). */
    private static volatile File resRoot;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final List<String> outbox = new ArrayList<>();
    private boolean pageReady;
    private boolean flushPosted;
    private WebView web;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(final Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = this;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0D0F1A);
        final WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setTextZoom(100);
        WebView.setWebContentsDebuggingEnabled(true);
        web.addJavascriptInterface(new JsApi(), "AndroidBridge");
        web.setWebViewClient(new LocalClient());
        // Barres système masquées, mais l'encoche de la caméra reste : la page s'arrête à son bord
        // (sinon des cartes ou des boutons passent dessous en paysage).
        final FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0D0F1A);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                final DisplayCutout cutout = insets.getDisplayCutout();
                if (cutout != null) {
                    v.setPadding(cutout.getSafeInsetLeft(), cutout.getSafeInsetTop(), cutout.getSafeInsetRight(), cutout.getSafeInsetBottom());
                } else {
                    v.setPadding(0, 0, 0, 0);
                }
            }
            return insets;
        });
        setContentView(root);
        hideSystemBars();

        if (bridge == null) {
            bridge = new Bridge(MainActivity::deliver);
        }
        web.loadUrl("https://" + HOST + "/index.html");
        if (!started) {
            started = true;
            startForge();
        }
    }

    /** Installe les ressources puis démarre Forge, en arrière-plan : cela prend de quelques secondes à une minute. */
    private void startForge() {
        final File filesDir = getFilesDir();
        final File external = getExternalFilesDir(null);
        final Thread loader = new Thread(() -> {
            try {
                final File assets = ResInstaller.ensure(this, percent -> bridge.notifyLoading("Installation des cartes…", percent));
                resRoot = new File(assets, "res");
                final File cache = external != null ? new File(external, "cache") : new File(filesDir, "cache");
                ForgeRuntime.init(bridge, new ForgeRuntime.Paths(
                        assets.getAbsolutePath(), new File(filesDir, "data").getAbsolutePath(), cache.getAbsolutePath()), false);
            } catch (final Throwable e) {
                Log.e(TAG, "Échec du démarrage de Forge", e);
                bridge.notifyFatal("Échec du démarrage de Forge : " + e);
            }
        }, "arcane-loader");
        loader.start();
    }

    // ------------------------------------------------------------------ messages vers l'interface

    /** Appelé par le pont depuis n'importe quel fil : les messages sont regroupés et envoyés à la WebView. */
    private static void deliver(final String json) {
        final MainActivity activity = current;
        if (activity == null) {
            return;
        }
        synchronized (activity.outbox) {
            activity.outbox.add(json);
            if (activity.flushPosted) {
                return;
            }
            activity.flushPosted = true;
        }
        activity.ui.postDelayed(activity::flush, 16);
    }

    private void flush() {
        final List<String> batch;
        synchronized (outbox) {
            flushPosted = false;
            if (!pageReady || outbox.isEmpty()) {
                return;
            }
            batch = new ArrayList<>(outbox);
            outbox.clear();
        }
        final StringBuilder js = new StringBuilder("window.__atReceiveMany && window.__atReceiveMany([");
        for (int i = 0; i < batch.size(); i++) {
            if (i > 0) {
                js.append(',');
            }
            js.append(JSONObject.quote(batch.get(i)));
        }
        js.append("])");
        web.evaluateJavascript(js.toString(), null);
    }

    /** Messages de l'interface : appelés par la WebView sur un fil à elle. */
    private static final class JsApi {
        @JavascriptInterface
        public void send(final String json) {
            bridge.receive(json);
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            final MainActivity activity = current;
            if (activity != null) {
                activity.ui.post(() -> activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))));
            }
        }
    }

    // ------------------------------------------------------------------ contenus locaux

    private final class LocalClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(final WebView view, final WebResourceRequest request) {
            final Uri url = request.getUrl();
            if (!HOST.equals(url.getHost())) {
                return null;
            }
            final String path = url.getPath() == null || url.getPath().equals("/") ? "/index.html" : url.getPath();
            if (path.equals("/cardimg")) {
                return cardImage(url.getQueryParameter("key"), url.getQueryParameter("lang"));
            }
            if (path.startsWith("/audio/")) {
                return audio(path.substring("/audio/".length()));
            }
            try {
                final InputStream in = getAssets().open("ui" + path);
                final String ext = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : "";
                final String type = TYPES.containsKey(ext) ? TYPES.get(ext) : "application/octet-stream";
                final WebResourceResponse response = new WebResourceResponse(type, "utf-8", in);
                final Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-cache");
                response.setResponseHeaders(headers);
                return response;
            } catch (final IOException e) {
                return notFound();
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(final WebView view, final WebResourceRequest request) {
            final Uri url = request.getUrl();
            if (HOST.equals(url.getHost())) {
                return false;
            }
            // Liens externes (Scryfall, Moxfield...) : ouverts dans le navigateur.
            startActivity(new Intent(Intent.ACTION_VIEW, url));
            return true;
        }

        @Override
        public void onPageFinished(final WebView view, final String url) {
            synchronized (outbox) {
                pageReady = true;
            }
            flush();
        }
    }

    private static WebResourceResponse cardImage(final String key, final String lang) {
        final ImageService.Served img = ImageService.image(key, lang, 15_000);
        if (img == null) {
            return notFound();
        }
        try {
            final File file = img.file();
            final WebResourceResponse response = new WebResourceResponse(ImageService.contentType(file), null, new FileInputStream(file));
            final Map<String, String> headers = new HashMap<>();
            // L'anglais servi en attendant la version française ne doit pas rester dans le cache.
            headers.put("Cache-Control", img.cacheable() ? "max-age=604800" : "no-store");
            response.setResponseHeaders(headers);
            return response;
        } catch (final IOException e) {
            return notFound();
        }
    }

    /** Musiques et sons fournis avec Forge, dans les ressources installées (res/music, res/sound). */
    private static WebResourceResponse audio(final String rel) {
        final File root = resRoot;
        if (root == null || !(rel.startsWith("sound/") || rel.startsWith("music/"))) {
            return notFound();
        }
        try {
            final File file = new File(root, rel).getCanonicalFile();
            if (!file.getPath().startsWith(root.getCanonicalPath()) || !file.isFile()) {
                return notFound();
            }
            final WebResourceResponse response = new WebResourceResponse("audio/mpeg", null, new FileInputStream(file));
            final Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "max-age=604800");
            response.setResponseHeaders(headers);
            return response;
        } catch (final IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    // ------------------------------------------------------------------ cycle de vie

    @Override
    public void onBackPressed() {
        // L'interface ferme d'abord ses fenêtres ; sinon l'application passe en arrière-plan
        // (la partie continue au lieu d'être perdue).
        web.evaluateJavascript("window.__atBack ? window.__atBack() : false", value -> {
            if (!"true".equals(value)) {
                moveTaskToBack(true);
            }
        });
    }

    @Override
    public void onWindowFocusChanged(final boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            final WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (current == this) {
            current = null;
        }
        web.destroy();
        super.onDestroy();
    }
}
