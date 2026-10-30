package atclaude.ios;

import atclaude.bridge.Bridge;
import atclaude.bridge.ForgeRuntime;
import org.robovm.apple.foundation.NSAutoreleasePool;
import org.robovm.apple.foundation.NSBundle;
import org.robovm.apple.foundation.NSSearchPathDirectory;
import org.robovm.apple.foundation.NSSearchPathDomainMask;
import org.robovm.apple.foundation.NSPathUtilities;
import org.robovm.apple.foundation.NSString;
import org.robovm.apple.foundation.NSTimeZone;
import org.robovm.apple.uikit.UIApplication;
import org.robovm.apple.uikit.UIApplicationDelegateAdapter;
import org.robovm.apple.uikit.UIApplicationLaunchOptions;
import org.robovm.apple.uikit.UIInterfaceOrientationMask;
import org.robovm.apple.uikit.UIScreen;
import org.robovm.apple.uikit.UIWindow;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.util.SimpleTimeZone;
import java.util.TimeZone;

/**
 * Application iPhone et iPad : la même interface que sur Android et Windows, dans une WKWebView ({@link WebController}),
 * avec Forge dans le même processus (compilé en code natif par MobiVM). L'interface parle au pont par
 * window.webkit.messageHandlers ; le pont lui répond en exécutant window.__atReceiveMany dans la page.
 *
 * Les ressources de Forge (res/, dont cardsfolder.zip) et l'interface (ui/) sont dans le paquet de l'application, en
 * lecture seule ; decks, carrière et réglages vont dans Application Support, les images des cartes dans Caches.
 */
public final class Main extends UIApplicationDelegateAdapter {

    private static Bridge bridge;
    private WebController controller;

    @Override
    public boolean didFinishLaunching(final UIApplication application, final UIApplicationLaunchOptions options) {
        application.setIdleTimerDisabled(true);
        controller = new WebController();
        final UIWindow window = new UIWindow(UIScreen.getMainScreen().getBounds());
        window.setRootViewController(controller);
        window.makeKeyAndVisible();
        setWindow(window);
        if (bridge == null) {
            bridge = new Bridge(controller::deliver);
            controller.setBridge(bridge);
            final Object version = NSBundle.getMainBundle().getInfoDictionaryObject("CFBundleShortVersionString");
            if (version instanceof NSString) {
                Bridge.setAppVersion(version.toString());
            }
            startForge();
        }
        return true;
    }

    /** Paysage partout, portrait aussi sur les écrans des decks (voir {@link WebController#setAnyOrientation}). */
    @Override
    public UIInterfaceOrientationMask getSupportedInterfaceOrientations(final UIApplication application, final UIWindow window) {
        return controller == null ? UIInterfaceOrientationMask.Landscape : controller.getSupportedInterfaceOrientations();
    }

    @Override
    public void didReceiveMemoryWarning(final UIApplication application) {
        System.gc();
    }

    /** Forge charge sa base de cartes en arrière-plan : de quelques secondes à une minute. */
    private static void startForge() {
        // Images, prix, EDHREC, synchronisation : par le réseau d'iOS (voir AppleHttpConnection).
        atclaude.bridge.Net.setTransport(AppleHttpConnection::new);
        final Thread loader = new Thread(() -> {
            try {
                final String assets = NSBundle.getMainBundle().getBundlePath() + "/forge";
                final File support = new File(directory(NSSearchPathDirectory.ApplicationSupportDirectory), "atclaude");
                final File caches = new File(directory(NSSearchPathDirectory.CachesDirectory), "atclaude");
                ForgeRuntime.init(bridge, new ForgeRuntime.Paths(assets, new File(support, "data").getPath(),
                        new File(caches, "cache").getPath()), false);
            } catch (final Throwable e) {
                e.printStackTrace();
                bridge.notifyFatal("Échec du démarrage de Forge : " + e);
            }
        }, "arcane-loader");
        loader.start();
    }

    private static String directory(final NSSearchPathDirectory which) {
        return NSPathUtilities.getSearchPathForDirectoriesInDomains(which, NSSearchPathDomainMask.UserDomainMask, true).get(0);
    }

    /**
     * Sorties de Java (System.out, System.err) recopiées dans Application Support/atclaude/app.log, refait à chaque
     * lancement : le journal d'iOS masque les messages des applications, ce fichier sert au diagnostic.
     */
    private static void logToFile() {
        try {
            final File dir = new File(directory(NSSearchPathDirectory.ApplicationSupportDirectory), "atclaude");
            dir.mkdirs();
            final OutputStream file = new FileOutputStream(new File(dir, "app.log"));
            System.setOut(new PrintStream(new Tee(System.out, file), true, "UTF-8"));
            System.setErr(new PrintStream(new Tee(System.err, file), true, "UTF-8"));
        } catch (final IOException | RuntimeException e) {
            e.printStackTrace();
        }
    }

    /** Écrit dans deux flux à la fois. */
    private static final class Tee extends OutputStream {
        private final OutputStream a;
        private final OutputStream b;

        Tee(final OutputStream a, final OutputStream b) {
            this.a = a;
            this.b = b;
        }

        @Override
        public void write(final int c) throws IOException {
            a.write(c);
            b.write(c);
        }

        @Override
        public void write(final byte[] buf, final int off, final int len) throws IOException {
            a.write(buf, off, len);
            b.write(buf, off, len);
        }

        @Override
        public void flush() throws IOException {
            a.flush();
            b.flush();
        }
    }

    public static void main(final String[] args) {
        logToFile();
        // Le fuseau horaire de l'appareil, sans lire /usr/share/zoneinfo (interdit par le bac à sable d'iOS).
        try {
            final NSTimeZone tz = NSTimeZone.getSystemTimeZone();
            final String name = tz == null || tz.getName() == null ? "UTC" : tz.getName();
            final int offset = tz == null ? 0 : (int) (tz.getSecondsFromGMT() * 1000);
            System.setProperty("user.timezone", name);
            TimeZone.setDefault(new SimpleTimeZone(offset, name));
        } catch (final Throwable e) {
            TimeZone.setDefault(new SimpleTimeZone(0, "UTC"));
        }
        // Mémo des capacités statiques de Forge, prévu pour iOS : moins d'allocations, IA plus rapide.
        System.setProperty("forge.staticMemo", "on");
        try (NSAutoreleasePool pool = new NSAutoreleasePool()) {
            UIApplication.main(args, null, Main.class);
        }
    }
}
