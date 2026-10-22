package atclaude.bridge;

import forge.gamemodes.match.HostedMatch;
import forge.gui.download.GuiDownloadService;
import forge.gui.interfaces.IGuiBase;
import forge.gui.interfaces.IGuiGame;
import forge.item.PaperCard;
import forge.localinstance.skin.FSkinProp;
import forge.localinstance.skin.ISkinImage;
import forge.sound.IAudioClip;
import forge.sound.IAudioMusic;
import forge.util.FSerializableFunction;
import forge.util.ImageFetcher;
import org.jupnp.UpnpServiceConfiguration;

import java.io.File;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.function.Consumer;

/**
 * Plateforme vue par Forge : fil d'interface, dossiers, dialogues génériques.
 * Pas d'image ni de son côté Java : l'interface web s'en charge.
 */
final class BridgeGuiBase implements IGuiBase {

    private final Bridge bridge;
    private final String assetsDir;
    private final boolean desktop;
    private final ImageFetcher imageFetcher = new StreamImageFetcher();
    private final Dialogs dialogs;

    BridgeGuiBase(final Bridge bridge, final String assetsDir, final boolean desktop) {
        this.bridge = bridge;
        this.assetsDir = assetsDir;
        this.desktop = desktop;
        this.dialogs = new Dialogs(bridge, BridgeGuiGame::current);
    }

    @Override public boolean isRunningOnDesktop() { return desktop; }
    @Override public boolean isLibgdxPort() { return false; }
    @Override public String getCurrentVersion() { return ForgeRuntime.version(); }
    @Override public String getUserAgent() { return "ATClaude/0.1 (Forge " + ForgeRuntime.version() + ")"; }

    @Override public void invokeInEdtNow(final Runnable runnable) { runnable.run(); }
    @Override public void invokeInEdtLater(final Runnable runnable) { bridge.runOnEdt(runnable); }
    @Override public void invokeInEdtAndWait(final Runnable proc) { bridge.runOnEdtAndWait(proc); }
    @Override public boolean isGuiThread() { return bridge.isEdt() || ImageService.isImageThread(); }

    @Override
    public void runBackgroundTask(final String message, final Runnable task) {
        final Thread t = new Thread(task, "atclaude-background");
        t.setDaemon(true);
        t.start();
    }

    @Override public boolean isMatchInProgress() { return BridgeGuiGame.current() != null; }
    @Override public String getAssetsDir() { return assetsDir; }
    @Override public ImageFetcher getImageFetcher() { return imageFetcher; }
    @Override public ISkinImage getSkinIcon(final FSkinProp skinProp) { return null; }
    @Override public ISkinImage getUnskinnedIcon(final String path) { return null; }
    @Override public ISkinImage getCardArt(final PaperCard card, final boolean backFace) { return null; }
    @Override public ISkinImage createLayeredImage(final PaperCard card, final FSkinProp background, final String overlayFilename, final float opacity) { return null; }
    @Override public void clearImageCache() { }
    @Override public String encodeSymbols(final String str, final boolean formatReminderText) { return str; }
    @Override public int getAvatarCount() { return 0; }
    @Override public int getSleevesCount() { return 0; }
    @Override public float getScreenScale() { return 1f; }
    @Override public void preventSystemSleep(final boolean preventSleep) { }

    @Override
    public void download(final GuiDownloadService service, final Consumer<Boolean> callback) {
        if (callback != null) {
            callback.accept(false);
        }
    }

    @Override public void copyToClipboard(final String text) { bridge.sendEvent("clipboard", m -> m.addProperty("text", text)); }
    @Override public void browseToUrl(final String url) { bridge.sendEvent("openUrl", m -> m.addProperty("url", url)); }

    @Override
    public void showCardList(final String title, final String message, final List<PaperCard> list) {
        dialogs.reveal(title, list);
    }

    @Override
    public boolean showBoxedProduct(final String title, final String message, final List<PaperCard> list) {
        dialogs.reveal(title, list);
        return false;
    }

    @Override
    public void showBugReportDialog(final String title, final String text, final boolean showExitAppBtn) {
        System.err.println("[Forge] " + title + "\n" + text);
        dialogs.message(title, text);
    }

    @Override
    public void showImageDialog(final ISkinImage image, final String message, final String title) {
        dialogs.message(title, message);
    }

    @Override
    public int showOptionDialog(final String message, final String title, final FSkinProp icon, final List<String> options, final int defaultOption) {
        return dialogs.option(title, message, options, defaultOption, null);
    }

    @Override
    public String showInputDialog(final String message, final String title, final FSkinProp icon, final String initialInput, final List<String> inputOptions, final boolean isNumeric) {
        return dialogs.input(title, message, initialInput, inputOptions, isNumeric);
    }

    @Override public String showFileDialog(final String title, final String defaultDir) { return null; }
    @Override public File getSaveFile(final File defaultFile) { return defaultFile; }

    @Override
    public <T> List<T> order(final String title, final String top, final int remainingObjectsMin, final int remainingObjectsMax, final List<T> sourceChoices, final List<T> destChoices) {
        return dialogs.order(title, top, remainingObjectsMin, remainingObjectsMax, sourceChoices, destChoices);
    }

    @Override
    public <T> List<T> getChoices(final String message, final int min, final int max, final Collection<T> choices, final Collection<T> selected, final FSerializableFunction<T, String> display) {
        return dialogs.choose(message, min, max, choices, selected, display);
    }

    @Override
    public PaperCard chooseCard(final String title, final String message, final List<PaperCard> list) {
        return dialogs.one(title, new ArrayList<>(list), null, true);
    }

    @Override public boolean isSupportedAudioFormat(final File file) { return false; }
    @Override public IAudioClip createAudioClip(final String filename) { return null; }
    @Override public IAudioMusic createAudioMusic(final String filename) { return null; }
    @Override public void startAltSoundSystem(final String filename, final boolean isSynchronized) { }
    @Override public void showSpellShop() { }
    @Override public void showBazaar() { }

    @Override public IGuiGame getNewGuiGame() { return new BridgeGuiGame(bridge); }
    @Override public HostedMatch hostMatch() { return new HostedMatch(); }
    @Override public UpnpServiceConfiguration getUpnpPlatformService() { return null; }
    @Override public boolean hasNetGame() { return false; }
}
