package atclaude.bridge;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

/** Toutes les requêtes HTTP du pont passent par ici. */
public final class Net {

    /** Ouvre une connexion HTTP autrement que par Java (l'iPhone passe par le réseau d'Apple). */
    public interface Transport {
        HttpURLConnection open(URL url) throws IOException;
    }

    private static volatile Transport transport;

    private Net() { }

    /** À poser avant le démarrage de Forge ; null : connexions de Java. */
    public static void setTransport(final Transport t) {
        transport = t;
    }

    public static HttpURLConnection open(final String url) throws IOException {
        // new URL accepte les adresses telles que Forge les forme (caractères non encodés compris).
        final URL u = new URL(url);
        final Transport t = transport;
        return t != null ? t.open(u) : (HttpURLConnection) u.openConnection();
    }
}
