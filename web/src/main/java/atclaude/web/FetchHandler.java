package atclaude.web;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Connexions HTTP du pont confiées au fetch du navigateur (CheerpJ ne laisse Java joindre que son propre site).
 * Les services appelés (Scryfall, GitHub, dépôt des visuels de boosters) acceptent les requêtes d'autres sites (CORS).
 */
final class FetchHandler extends URLStreamHandler {

    @Override
    protected URLConnection openConnection(final URL u) {
        return new FetchConnection(u);
    }

    /** Ce qu'utilise le pont d'une HttpURLConnection : méthode, en-têtes, corps, code, en-têtes de réponse, corps. */
    static final class FetchConnection extends HttpURLConnection {
        /** En-têtes que le navigateur gère lui-même (ou refuse). */
        private static final Set<String> SKIPPED = Set.of("user-agent", "connection", "accept-encoding", "content-length", "host");

        private final ByteArrayOutputStream body = new ByteArrayOutputStream();
        private boolean done;
        private int status;
        private JsonObject headers = new JsonObject();
        private byte[] data = new byte[0];

        FetchConnection(final URL u) {
            super(u);
        }

        @Override
        public void connect() {
            // la requête part au premier besoin de la réponse
        }

        @Override
        public void disconnect() { }

        @Override
        public boolean usingProxy() {
            return false;
        }

        @Override
        public OutputStream getOutputStream() {
            setDoOutput(true);
            return body;
        }

        private synchronized void run() throws IOException {
            if (done) {
                return;
            }
            final JsonObject h = new JsonObject();
            for (final Map.Entry<String, List<String>> e : getRequestProperties().entrySet()) {
                if (e.getKey() != null && !e.getValue().isEmpty() && !SKIPPED.contains(e.getKey().toLowerCase(Locale.ROOT))) {
                    h.addProperty(e.getKey(), e.getValue().get(0));
                }
            }
            done = true;
            connected = true;
            final int timeout = Math.max(getConnectTimeout() + getReadTimeout(), 0);
            final JsonObject meta = JsonParser.parseString(WebMain.fetchStart(method, url.toString(), h.toString(),
                    body.size() > 0 ? body.toByteArray() : null, timeout == 0 ? 60_000 : timeout)).getAsJsonObject();
            status = meta.has("status") ? meta.get("status").getAsInt() : 0;
            if (status == 0) {
                throw new IOException(meta.has("error") ? meta.get("error").getAsString() : "réseau injoignable");
            }
            responseCode = status;
            headers = meta.has("headers") && meta.get("headers").isJsonObject() ? meta.getAsJsonObject("headers") : new JsonObject();
            final byte[] b = WebMain.fetchBody(meta.get("id").getAsInt());
            data = b == null ? new byte[0] : b;
        }

        @Override
        public int getResponseCode() throws IOException {
            run();
            return status;
        }

        @Override
        public InputStream getInputStream() throws IOException {
            run();
            if (status >= 400) {
                throw new IOException("HTTP " + status + " pour " + url);
            }
            return new ByteArrayInputStream(data);
        }

        @Override
        public InputStream getErrorStream() {
            return done && status >= 400 ? new ByteArrayInputStream(data) : null;
        }

        @Override
        public String getHeaderField(final String name) {
            try {
                run();
            } catch (final IOException e) {
                return null;
            }
            final String k = name == null ? "" : name.toLowerCase(Locale.ROOT);
            return headers.has(k) && !headers.get(k).isJsonNull() ? headers.get(k).getAsString() : null;
        }

        @Override
        public String getContentType() {
            return getHeaderField("content-type");
        }

        @Override
        public int getContentLength() {
            try {
                run();
            } catch (final IOException e) {
                return -1;
            }
            return data.length;
        }

        @Override
        public long getContentLengthLong() {
            return getContentLength();
        }
    }
}
