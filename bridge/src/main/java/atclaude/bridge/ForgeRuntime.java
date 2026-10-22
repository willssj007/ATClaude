package atclaude.bridge;

import forge.gui.GuiBase;
import forge.gui.interfaces.IProgressBar;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.util.BuildInfo;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.util.Properties;

/**
 * Démarre Forge une seule fois par processus : dossiers, langue française, base de cartes.
 *
 * Forge lit ses dossiers dans des constantes statiques : tout doit être réglé avant le premier
 * accès à {@code ForgeConstants}, c'est-à-dire avant {@link GuiBase#setInterface}.
 */
public final class ForgeRuntime {

    /** Où Forge trouve ses ressources et où il écrit. */
    public record Paths(String assetsDir, String userDir, String cacheDir) {
        static String withSlash(final String dir) {
            return dir.endsWith(File.separator) ? dir : dir + File.separator;
        }
    }

    private static volatile boolean ready;
    private static volatile String status = "Démarrage";

    private ForgeRuntime() { }

    public static boolean isReady() {
        return ready;
    }

    public static String status() {
        return status;
    }

    public static String version() {
        try {
            return BuildInfo.getVersionString();
        } catch (final RuntimeException e) {
            return "?";
        }
    }

    /**
     * @param desktop vrai sur ordinateur ; faux sur Android, où Forge charge les cartes autrement.
     */
    public static synchronized void init(final Bridge bridge, final Paths paths, final boolean desktop) {
        if (ready) {
            return;
        }
        final String assets = Paths.withSlash(paths.assetsDir());
        final String user = Paths.withSlash(paths.userDir());
        final String cache = Paths.withSlash(paths.cacheDir());
        new File(user).mkdirs();
        new File(cache).mkdirs();

        if (desktop) {
            // Sur ordinateur, Forge lit ses dossiers dans forge.profile.properties, à côté de res/.
            writeProfile(assets, user, cache);
        } else {
            // Hors ordinateur, Forge accepte ces deux propriétés (prévues pour iOS).
            System.setProperty("forge.ios.userDir", user);
            System.setProperty("forge.ios.cacheDir", cache);
            GuiBase.setIsAndroid(true);
        }
        GuiBase.setInterface(new BridgeGuiBase(bridge, assets, desktop));

        final IProgressBar progress = new IProgressBar() {
            private int maximum = 1000;
            @Override public void setDescription(final String s) { status = s; sendProgress(bridge, s, -1); }
            @Override public void setValue(final int value) { sendProgress(bridge, status, maximum <= 0 ? -1 : value * 100 / maximum); }
            @Override public void reset() { }
            @Override public void setShowETA(final boolean b) { }
            @Override public void setShowCount(final boolean b) { }
            @Override public void setPercentMode(final boolean b) { }
            @Override public int getMaximum() { return maximum; }
            @Override public void setMaximum(final int m) { maximum = m; }
        };

        FModel.initialize(progress, prefs -> {
            prefs.setPref(FPref.UI_LANGUAGE, "fr-FR");
            if (prefs.getPref(FPref.PLAYER_NAME).isBlank()) {
                // Sans nom, Forge le demande au début de la première partie.
                prefs.setPref(FPref.PLAYER_NAME, "Joueur");
            }
            prefs.setPref(FPref.UI_CARD_DOWNLOAD_LANG, "fr-FR");
            prefs.setPref(FPref.DEV_MODE_ENABLED, "true");
            prefs.setPref(FPref.UI_ENABLE_AI_CHEATS, "false");
            prefs.setPref(FPref.MULLIGAN_RULE, "London");
            prefs.setPref(FPref.LOAD_CARD_SCRIPTS_LAZILY, "false");
            prefs.save();
            return null;
        });
        status = "Prêt";
        ready = true;
        bridge.sendEvent("ready", m -> m.addProperty("version", version()));
    }

    private static void sendProgress(final Bridge bridge, final String text, final int percent) {
        bridge.sendEvent("loading", m -> {
            m.addProperty("text", text);
            m.addProperty("percent", percent);
        });
    }

    private static void writeProfile(final String assets, final String user, final String cache) {
        final Properties props = new Properties();
        props.setProperty("userDir", user);
        props.setProperty("cacheDir", cache);
        final File file = new File(assets, "forge.profile.properties");
        try (OutputStream out = Files.newOutputStream(file.toPath())) {
            props.store(out, "Écrit par ATClaude");
        } catch (final IOException e) {
            throw new IllegalStateException("Impossible d'écrire " + file + " : " + e.getMessage(), e);
        }
    }
}
