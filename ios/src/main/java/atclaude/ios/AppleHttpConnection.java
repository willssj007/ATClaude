package atclaude.ios;

import org.robovm.apple.foundation.NSAutoreleasePool;
import org.robovm.apple.foundation.NSData;
import org.robovm.apple.foundation.NSErrorException;
import org.robovm.apple.foundation.NSHTTPURLResponse;
import org.robovm.apple.foundation.NSMutableURLRequest;
import org.robovm.apple.foundation.NSURL;
import org.robovm.apple.foundation.NSURLConnection;
import org.robovm.apple.foundation.NSURLRequestCachePolicy;
import org.robovm.apple.foundation.NSURLResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Requête HTTP faite par le réseau d'iOS (celui de Safari) plutôt que par celui de Java embarqué par MobiVM : mêmes
 * certificats, DNS, IPv6, proxy et VPN que le reste de l'appareil. Les images des cartes, les prix, EDHREC et la
 * synchronisation du compte passent par là. La requête part au premier besoin de la réponse et attend la réponse
 * entière (le pont fait ses requêtes hors du fil principal).
 */
final class AppleHttpConnection extends HttpURLConnection {

    private final Map<String, List<String>> requestHeaders = new LinkedHashMap<>();
    private final Map<String, List<String>> responseHeaders = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    private final List<String> headerKeys = new ArrayList<>();
    private String httpMethod = "GET";
    private ByteArrayOutputStream body;
    private byte[] responseBody = new byte[0];

    AppleHttpConnection(final URL url) {
        super(url);
    }

    // ------------------------------------------------------------------ requête

    /** Toutes les méthodes, PATCH compris (que HttpURLConnection refuse). */
    @Override
    public void setRequestMethod(final String method) {
        httpMethod = method.toUpperCase(java.util.Locale.ROOT);
        this.method = httpMethod;
    }

    @Override
    public String getRequestMethod() {
        return httpMethod;
    }

    @Override
    public void setRequestProperty(final String key, final String value) {
        checkNotConnected();
        final List<String> values = new ArrayList<>();
        values.add(value);
        requestHeaders.put(key, values);
    }

    @Override
    public void addRequestProperty(final String key, final String value) {
        checkNotConnected();
        requestHeaders.computeIfAbsent(key, k -> new ArrayList<>()).add(value);
    }

    @Override
    public String getRequestProperty(final String key) {
        for (final Map.Entry<String, List<String>> e : requestHeaders.entrySet()) {
            if (e.getKey().equalsIgnoreCase(key) && !e.getValue().isEmpty()) {
                return e.getValue().get(0);
            }
        }
        return null;
    }

    @Override
    public Map<String, List<String>> getRequestProperties() {
        return Collections.unmodifiableMap(requestHeaders);
    }

    @Override
    public OutputStream getOutputStream() {
        checkNotConnected();
        if (body == null) {
            body = new ByteArrayOutputStream();
        }
        if ("GET".equals(httpMethod)) {
            httpMethod = "POST"; // comme Java : écrire un corps fait une requête POST
        }
        return body;
    }

    private void checkNotConnected() {
        if (connected) {
            throw new IllegalStateException("Requête déjà envoyée");
        }
    }

    // ------------------------------------------------------------------ envoi

    @Override
    public void connect() throws IOException {
        if (connected) {
            return;
        }
        final NSAutoreleasePool pool = new NSAutoreleasePool();
        try {
            final double timeout = Math.max(15, (Math.max(0, getConnectTimeout()) + Math.max(0, getReadTimeout())) / 1000.0);
            final NSMutableURLRequest request = new NSMutableURLRequest(new NSURL(encode(url.toString())),
                    NSURLRequestCachePolicy.ReloadIgnoringLocalCacheData, timeout);
            request.setHTTPMethod(httpMethod);
            for (final Map.Entry<String, List<String>> e : requestHeaders.entrySet()) {
                request.setHTTPHeaderField(e.getKey(), String.join(", ", e.getValue()));
            }
            if (body != null) {
                request.setHTTPBody(new NSData(body.toByteArray()));
            }
            final NSURLResponse.NSURLResponsePtr response = new NSURLResponse.NSURLResponsePtr();
            final NSData data;
            try {
                data = NSURLConnection.sendSynchronousRequest(request, response);
            } catch (final NSErrorException e) {
                throw new IOException(e.getError() == null ? "Réseau indisponible" : e.getError().getLocalizedDescription(), e);
            }
            final NSURLResponse r = response.get();
            if (r instanceof NSHTTPURLResponse) {
                final NSHTTPURLResponse http = (NSHTTPURLResponse) r;
                responseCode = (int) http.getStatusCode();
                final Map<String, String> fields = http.getAllHeaderFields();
                if (fields != null) {
                    for (final Map.Entry<String, String> e : fields.entrySet()) {
                        final List<String> v = new ArrayList<>();
                        v.add(e.getValue());
                        responseHeaders.put(e.getKey(), v);
                        headerKeys.add(e.getKey());
                    }
                }
            } else {
                responseCode = data == null ? -1 : 200;
            }
            responseBody = data == null ? new byte[0] : data.getBytes();
            connected = true;
        } finally {
            pool.close();
        }
    }

    /** Adresse acceptée par iOS : Forge écrit parfois des espaces ou des accents tels quels. */
    static String encode(final String url) {
        final StringBuilder sb = new StringBuilder(url.length() + 16);
        for (final byte b : url.getBytes(StandardCharsets.UTF_8)) {
            final int c = b & 0xff;
            if (c > 0x20 && c < 0x7f && "\"<>\\^`{|}".indexOf(c) < 0) {
                sb.append((char) c);
            } else {
                sb.append('%').append(Character.toUpperCase(Character.forDigit(c >> 4, 16)))
                        .append(Character.toUpperCase(Character.forDigit(c & 15, 16)));
            }
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ réponse

    @Override
    public int getResponseCode() throws IOException {
        connect();
        return responseCode;
    }

    @Override
    public String getResponseMessage() throws IOException {
        connect();
        return "HTTP " + responseCode;
    }

    @Override
    public InputStream getInputStream() throws IOException {
        connect();
        if (responseCode >= 400) {
            throw new IOException("HTTP " + responseCode + " pour " + url);
        }
        return new ByteArrayInputStream(responseBody);
    }

    @Override
    public InputStream getErrorStream() {
        return connected && responseCode >= 400 ? new ByteArrayInputStream(responseBody) : null;
    }

    @Override
    public String getHeaderField(final String name) {
        if (!connected) {
            try {
                connect();
            } catch (final IOException e) {
                return null;
            }
        }
        final List<String> v = name == null ? null : responseHeaders.get(name);
        return v == null || v.isEmpty() ? null : v.get(0);
    }

    @Override
    public Map<String, List<String>> getHeaderFields() {
        return Collections.unmodifiableMap(responseHeaders);
    }

    @Override
    public String getHeaderFieldKey(final int n) {
        return n >= 0 && n < headerKeys.size() ? headerKeys.get(n) : null;
    }

    @Override
    public String getHeaderField(final int n) {
        final String key = getHeaderFieldKey(n);
        return key == null ? null : getHeaderField(key);
    }

    @Override
    public String getContentType() {
        return getHeaderField("Content-Type");
    }

    @Override
    public int getContentLength() {
        return connected ? responseBody.length : -1;
    }

    @Override
    public void disconnect() {
        responseBody = new byte[0];
    }

    @Override
    public boolean usingProxy() {
        return false;
    }
}
