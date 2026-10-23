package atclaude.bridge;

import forge.gui.GuiBase;
import forge.localinstance.properties.ForgeConstants;
import forge.util.ImageFetcher;
import forge.util.ScryfallRateLimiter;
import forge.util.TextUtil;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

/**
 * Télécharge les images de cartes dans le cache de Forge, en copiant les octets tels quels.
 * Même logique que le téléchargeur Swing de Forge, sans java.awt, qui n'existe pas sur Android.
 * Les observateurs sont prévenus sur le fil des images, comme Forge l'exige.
 */
final class StreamImageFetcher extends ImageFetcher {

    @Override
    protected Runnable getDownloadTask(final String[] downloadUrls, final String destPath, final Runnable notifyObservers) {
        return () -> {
            for (final String url : downloadUrls) {
                try {
                    if (fetch(url, destPath)) {
                        ImageService.runOnImageThread(notifyObservers);
                        return;
                    }
                } catch (final IOException e) {
                    System.err.println("Image indisponible " + url + " : " + e.getMessage());
                }
            }
            // Aucun lien n'a marché : on prévient quand même, pour que les requêtes en attente se terminent.
            ImageService.runOnImageThread(notifyObservers);
        };
    }

    private static boolean fetch(final String urlToDownload, final String destPath) throws IOException {
        if (disableHostedDownload && urlToDownload.startsWith(ForgeConstants.URL_CARDFORGE)) {
            return false;
        }
        if (ScryfallRateLimiter.shouldSkip(urlToDownload)) {
            return false;
        }
        final boolean isScryfall = urlToDownload.startsWith(ForgeConstants.URL_PIC_SCRYFALL_DOWNLOAD)
                || urlToDownload.startsWith(ForgeConstants.URL_SCRYFALL_CDN);
        String target = urlToDownload.contains(".fullborder.jpg") || isScryfall
                ? TextUtil.fastReplace(destPath, ".full.jpg", ".fullborder.jpg") : destPath;
        if (!target.contains(".full") && !target.contains(".artcrop") && isScryfall && !destPath.startsWith(ForgeConstants.CACHE_TOKEN_PICS_DIR)) {
            target = target.replace(".jpg", ".fullborder.jpg");
        }
        ScryfallRateLimiter.acquire(urlToDownload);
        final HttpURLConnection connection = Net.open(urlToDownload);
        connection.setRequestProperty("Accept", "*/*");
        connection.setRequestProperty("User-Agent", GuiBase.getInterface().getUserAgent());
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(20_000);
        final int code = connection.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) {
            ScryfallRateLimiter.noteIfRateLimited(code, urlToDownload, connection.getHeaderField("Retry-After"));
            connection.disconnect();
            return false;
        }
        final File dest = new File(target);
        final File tmp = new File(target + ".tmp");
        dest.getParentFile().mkdirs();
        try (InputStream in = connection.getInputStream()) {
            Files.copy(in, tmp.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
        Files.move(tmp.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
        return true;
    }
}
