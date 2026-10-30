package atclaude.bridge;

import com.google.gson.JsonObject;

/**
 * Ce que fait le joueur, pour le montrer à ses amis (Discord, sur ordinateur) : l'écran des menus où il se trouve, ou
 * sa partie (mode, format, deck, points de vie, tour). L'application de bureau branche un {@link Sink} ; ailleurs,
 * rien n'est envoyé.
 *
 * Une activité est un objet JSON : details et state (les deux lignes affichées), since (début, en secondes),
 * image et imageText (l'illustration du commandant, sinon rien), mode (« planeswalker » ou « sandbox »).
 */
public final class Presence {

    /** Reçoit chaque activité (null : ne rien montrer). Appelé hors du fil de la partie. */
    public interface Sink {
        void update(JsonObject activity);
    }

    private static volatile Sink sink;
    private static volatile boolean enabled = true;
    private static volatile boolean inGame;
    private static volatile JsonObject lastMenu;
    private static volatile String lastSent = "";
    private static final long STARTED = System.currentTimeMillis() / 1000;

    private static final java.util.Map<String, String> SCREENS = java.util.Map.ofEntries(
            java.util.Map.entry("home", "Dans les menus"), java.util.Map.entry("lobby", "Prépare une partie"),
            java.util.Map.entry("duel", "Prépare un duel"), java.util.Map.entry("decks", "Construit ses decks"),
            java.util.Map.entry("cards", "Parcourt les cartes"), java.util.Map.entry("collection", "Parcourt sa collection"),
            java.util.Map.entry("boosters", "À la boutique"), java.util.Map.entry("stats", "Consulte ses statistiques"),
            java.util.Map.entry("trophies", "Regarde ses trophées"), java.util.Map.entry("settings", "Dans les réglages"));

    private Presence() { }

    public static void setSink(final Sink s) {
        sink = s;
        lastSent = "";
        resend();
    }

    static boolean active() {
        return sink != null && enabled;
    }

    /** Message de l'interface : écran des menus, mode, ou réglage (montrer ou non sa partie). */
    static void fromInterface(final JsonObject m) {
        if (m.has("enabled")) {
            enabled = m.get("enabled").getAsBoolean();
            lastSent = "";
            if (!enabled) {
                send(null);
                return;
            }
        }
        if (m.has("screen")) {
            final String screen = m.get("screen").getAsString();
            final boolean pw = m.has("mode") && "planeswalker".equals(m.get("mode").getAsString());
            final JsonObject a = new JsonObject();
            a.addProperty("details", SCREENS.getOrDefault(screen, "Dans les menus"));
            a.addProperty("state", pw ? "Mode Planeswalker" : "Mode Sandbox");
            a.addProperty("since", STARTED);
            a.addProperty("mode", pw ? "planeswalker" : "sandbox");
            lastMenu = a;
        }
        resend();
    }

    /** Partie en cours (activité calculée par la partie) ; elle remplace les menus jusqu'à {@link #leftGame()}. */
    static void game(final JsonObject activity) {
        inGame = true;
        send(activity);
    }

    static void leftGame() {
        inGame = false;
        resend();
    }

    private static void resend() {
        if (!inGame && lastMenu != null) {
            send(lastMenu);
        }
    }

    private static void send(final JsonObject activity) {
        final Sink s = sink;
        if (s == null || (!enabled && activity != null)) {
            return;
        }
        final String key = activity == null ? "" : activity.toString();
        if (key.equals(lastSent)) {
            return;
        }
        lastSent = key;
        try {
            s.update(activity == null ? null : activity.deepCopy());
        } catch (final RuntimeException e) {
            System.err.println("Présence non envoyée : " + e);
        }
    }
}
