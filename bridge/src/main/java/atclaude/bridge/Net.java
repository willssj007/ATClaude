package atclaude.bridge;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

/** Toutes les requêtes HTTP du pont passent par ici. */
public final class Net {

    private Net() { }

    public static HttpURLConnection open(final String url) throws IOException {
        // new URL accepte les adresses telles que Forge les forme (caractères non encodés compris).
        return (HttpURLConnection) new URL(url).openConnection();
    }
}
