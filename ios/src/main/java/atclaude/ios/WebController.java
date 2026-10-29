package atclaude.ios;

import atclaude.bridge.Bridge;
import com.google.gson.Gson;
import org.robovm.apple.dispatch.DispatchQueue;
import org.robovm.apple.foundation.NSProcessInfo;
import org.robovm.apple.foundation.NSURL;
import org.robovm.apple.foundation.NSURLRequest;
import org.robovm.apple.uikit.UIApplication;
import org.robovm.apple.uikit.UIApplicationOpenURLOptions;
import org.robovm.apple.uikit.UIColor;
import org.robovm.apple.uikit.UIDevice;
import org.robovm.apple.uikit.UIEdgeInsets;
import org.robovm.apple.uikit.UIInterfaceOrientationMask;
import org.robovm.apple.uikit.UIScreen;
import org.robovm.apple.uikit.UIScrollViewContentInsetAdjustmentBehavior;
import org.robovm.apple.uikit.UIViewController;
import org.robovm.apple.webkit.WKAudiovisualMediaTypes;
import org.robovm.apple.webkit.WKNavigation;
import org.robovm.apple.webkit.WKNavigationAction;
import org.robovm.apple.webkit.WKNavigationActionPolicy;
import org.robovm.apple.webkit.WKNavigationDelegateAdapter;
import org.robovm.apple.webkit.WKScriptMessage;
import org.robovm.apple.webkit.WKScriptMessageHandlerAdapter;
import org.robovm.apple.webkit.WKUserContentController;
import org.robovm.apple.webkit.WKUserScript;
import org.robovm.apple.webkit.WKUserScriptInjectionTime;
import org.robovm.apple.webkit.WKWebView;
import org.robovm.apple.webkit.WKWebViewConfiguration;
import org.robovm.objc.block.VoidBlock1;

import java.util.ArrayList;
import java.util.List;

/**
 * La page de l'application : une WKWebView plein écran qui charge l'interface depuis le paquet (atclaude://app/,
 * voir {@link LocalScheme}). Messages de la page vers le pont : gestionnaire « atclaude » ; liens externes :
 * « atclaudeUrl » (Safari) ; orientation permise : « atclaudeOrientation ».
 */
final class WebController extends UIViewController {

    static final String SCHEME = "atclaude";
    private static final Gson GSON = new Gson();

    private WKWebView web;
    private Bridge bridge;
    private boolean anyOrientation;
    /** Messages du pont en attente : regroupés, puis envoyés à la page une fois chargée. */
    private final List<String> outbox = new ArrayList<>();
    private boolean pageReady;
    private boolean flushPosted;

    void setBridge(final Bridge b) {
        bridge = b;
    }

    @Override
    public void loadView() {
        final WKUserContentController content = new WKUserContentController();
        final WKScriptMessageHandlerAdapter messages = new WKScriptMessageHandlerAdapter() {
            @Override
            public void didReceiveScriptMessage(final WKUserContentController controller, final WKScriptMessage message) {
                final String body = String.valueOf(message.getBody());
                switch (message.getName()) {
                    case "atclaude" -> {
                        if (bridge != null) {
                            bridge.receive(body);
                        }
                    }
                    case "atclaudeUrl" -> openExternal(body);
                    case "atclaudeOrientation" -> setAnyOrientation("any".equals(body));
                    case "atclaudeLog" -> System.out.println("[page] " + body);
                    default -> { }
                }
            }
        };
        for (final String name : new String[] {"atclaude", "atclaudeUrl", "atclaudeOrientation", "atclaudeLog"}) {
            content.addScriptMessageHandler(messages, name);
        }
        // Erreurs de la page dans le journal de l'application (app.log).
        content.addUserScript(new WKUserScript("(function(){var h=window.webkit.messageHandlers.atclaudeLog;"
                + "window.addEventListener('error',function(e){h.postMessage('erreur : '+e.message+' ('+e.filename+':'+e.lineno+')');});"
                + "window.addEventListener('unhandledrejection',function(e){h.postMessage('promesse rejetée : '+(e.reason&&e.reason.message||e.reason));});"
                + "var ce=console.error;console.error=function(){h.postMessage('console : '+Array.prototype.join.call(arguments,' '));ce.apply(console,arguments);};})();",
                WKUserScriptInjectionTime.AtDocumentStart, true));

        final WKWebViewConfiguration config = new WKWebViewConfiguration();
        config.setUserContentController(content);
        config.setURLSchemeHandler(new LocalScheme(), SCHEME);
        config.setAllowsInlineMediaPlayback(true);
        config.setMediaTypesRequiringUserActionForPlayback(WKAudiovisualMediaTypes.None);

        web = new WKWebView(UIScreen.getMainScreen().getBounds(), config);
        web.setBackgroundColor(new UIColor(0x0d / 255.0, 0x0f / 255.0, 0x1a / 255.0, 1));
        web.setOpaque(false);
        // La page va jusqu'aux bords de l'écran : elle écarte elle-même ce qui tomberait sous l'encoche.
        web.getScrollView().setContentInsetAdjustmentBehavior(UIScrollViewContentInsetAdjustmentBehavior.Never);
        web.getScrollView().setBounces(false);
        web.getScrollView().setScrollEnabled(false);
        if (atLeast(16, 4)) {
            web.setInspectable(true); // inspecteur web de Safari (Mac), pour le diagnostic
        }
        web.setNavigationDelegate(new WKNavigationDelegateAdapter() {
            @Override
            public void decidePolicyForNavigationAction(final WKWebView view, final WKNavigationAction action,
                                                        final VoidBlock1<WKNavigationActionPolicy> decision) {
                final NSURL url = action.getRequest().getURL();
                if (url == null || SCHEME.equals(url.getScheme()) || "about".equals(url.getScheme())) {
                    decision.invoke(WKNavigationActionPolicy.Allow);
                } else {
                    // Liens externes (Scryfall, Moxfield, GitHub...) : ouverts dans Safari.
                    openExternal(url.getAbsoluteString());
                    decision.invoke(WKNavigationActionPolicy.Cancel);
                }
            }

            @Override
            public void didFinishNavigation(final WKWebView view, final WKNavigation navigation) {
                synchronized (outbox) {
                    pageReady = true;
                }
                sendInsets();
                flush();
            }
        });
        setView(web);
        // « -autotest » (essai dans le simulateur, scripts/ios-sim-test.sh) : la page joue seule une partie.
        final boolean autotest = NSProcessInfo.getSharedProcessInfo().getArguments().contains("-autotest");
        web.loadRequest(new NSURLRequest(new NSURL(SCHEME + "://app/index.html" + (autotest ? "?autotest=1" : ""))));
    }

    @Override
    public boolean prefersStatusBarHidden() {
        return true;
    }

    @Override
    public boolean prefersHomeIndicatorAutoHidden() {
        return true;
    }

    @Override
    public UIInterfaceOrientationMask getSupportedInterfaceOrientations() {
        return anyOrientation ? UIInterfaceOrientationMask.AllButUpsideDown : UIInterfaceOrientationMask.Landscape;
    }

    /** Écrans des decks : portrait permis ; ailleurs, retour au paysage. */
    void setAnyOrientation(final boolean any) {
        if (any == anyOrientation) {
            return;
        }
        anyOrientation = any;
        if (atLeast(16, 0)) {
            setNeedsUpdateOfSupportedInterfaceOrientations();
        } else {
            UIViewController.attemptRotationToDeviceOrientation();
        }
    }

    @Override
    public void viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange();
        sendInsets();
    }

    /** Marges de sécurité (encoche, coins arrondis) : la page les reçoit comme l'encoche d'Android. */
    private void sendInsets() {
        if (web == null) {
            return;
        }
        final UIEdgeInsets i = getView().getSafeAreaInsets();
        final String json = "{\"left\":" + i.getLeft() + ",\"top\":" + i.getTop() + ",\"right\":" + i.getRight()
                + ",\"bottom\":" + i.getBottom() + "}";
        web.evaluateJavaScript("window.__atCutout && window.__atCutout(" + json + ")", null);
    }

    private static void openExternal(final String url) {
        if (url == null || url.isEmpty()) {
            return;
        }
        DispatchQueue.getMainQueue().async(() ->
                UIApplication.getSharedApplication().openURL(new NSURL(url), new UIApplicationOpenURLOptions(), null));
    }

    // ------------------------------------------------------------------ messages vers la page

    /** Appelé par le pont depuis n'importe quel fil. */
    void deliver(final String json) {
        synchronized (outbox) {
            outbox.add(json);
            if (flushPosted) {
                return;
            }
            flushPosted = true;
        }
        DispatchQueue.getMainQueue().async(this::flush);
    }

    private void flush() {
        final List<String> batch;
        synchronized (outbox) {
            flushPosted = false;
            if (!pageReady || outbox.isEmpty()) {
                return;
            }
            batch = atclaude.bridge.Bridge.dropStaleStates(new ArrayList<>(outbox));
            outbox.clear();
        }
        final StringBuilder js = new StringBuilder("window.__atReceiveMany && window.__atReceiveMany([");
        for (int i = 0; i < batch.size(); i++) {
            if (i > 0) {
                js.append(',');
            }
            js.append(GSON.toJson(batch.get(i)));
        }
        js.append("])");
        web.evaluateJavaScript(js.toString(), null);
    }

    /** Version d'iOS au moins major.minor (les méthodes plus récentes manquent sur les anciennes). */
    private static boolean atLeast(final int major, final int minor) {
        try {
            final String[] parts = UIDevice.getCurrentDevice().getSystemVersion().split("\\.");
            final int ma = Integer.parseInt(parts[0]);
            final int mi = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
            return ma > major || (ma == major && mi >= minor);
        } catch (final RuntimeException e) {
            return false;
        }
    }
}
