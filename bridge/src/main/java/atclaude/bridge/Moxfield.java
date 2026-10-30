package atclaude.bridge;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;

/**
 * Lecture d'un deck Moxfield par son lien (import du deck builder). Moxfield n'a pas d'API publique officielle : ce
 * sont les adresses de son propre site (api2.moxfield.com), derrière Cloudflare, qui refuse souvent les applications
 * (HTTP 403) ; l'import par texte reste la solution sûre.
 *
 * -Datclaude.moxfieldApi=http://127.0.0.1:.../ : une imitation locale de Moxfield (essais).
 */
final class Moxfield {

    static final String API = System.getProperty("atclaude.moxfieldApi", "https://api2.moxfield.com/");

    private Moxfield() { }

    /** GET avec les en-têtes d'un navigateur. */
    static String get(final String url) throws IOException {
        final HttpURLConnection c = Net.open(url);
        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36");
        c.setRequestProperty("Accept", "application/json, text/plain, */*");
        c.setRequestProperty("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.8");
        c.setRequestProperty("Origin", "https://www.moxfield.com");
        c.setRequestProperty("Referer", "https://www.moxfield.com/");
        c.setConnectTimeout(10_000);
        c.setReadTimeout(20_000);
        final int code = c.getResponseCode();
        if (code == 429) {
            throw new IOException("trop de demandes, Moxfield fait une pause");
        }
        if (code == 403 || code == 503) {
            throw new IOException("accès refusé par Moxfield, HTTP " + code);
        }
        if (code != 200) {
            throw new IOException("HTTP " + code);
        }
        try (InputStream in = c.getInputStream()) {
            final ByteArrayOutputStream out = new ByteArrayOutputStream();
            final byte[] buffer = new byte[16 * 1024];
            for (int n; (n = in.read(buffer)) > 0; ) {
                out.write(buffer, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
