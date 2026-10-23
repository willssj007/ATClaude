package atclaude.bridge;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLStreamHandler;

/**
 * Toutes les requêtes HTTP du pont passent par ici. Sur Android et sur ordinateur, c'est la connexion
 * habituelle de Java ; dans le navigateur (version iPhone, Java sous CheerpJ), Java ne peut joindre que son
 * propre site : l'hôte web installe alors un gestionnaire qui confie la requête au fetch du navigateur.
 */
public final class Net {

    private static volatile URLStreamHandler handler;

    private Net() { }

    /** Gestionnaire des URL http(s), ou null pour celui de Java. */
    public static void setHandler(final URLStreamHandler h) {
        handler = h;
    }

    public static HttpURLConnection open(final String url) throws IOException {
        final URLStreamHandler h = handler;
        // new URL accepte les adresses telles que Forge les forme (caractères non encodés compris).
        final URL u = h == null ? new URL(url) : new URL(null, url, h);
        return (HttpURLConnection) u.openConnection();
    }
}
