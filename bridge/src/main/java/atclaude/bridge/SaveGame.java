package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.game.Game;
import forge.game.GameState;
import forge.game.card.Card;
import forge.game.player.Player;
import forge.localinstance.properties.ForgeConstants;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Partie sauvegardée : l'état complet du jeu (cartes de chaque zone dans l'ordre, points de vie, marqueurs,
 * engagements, attachements, tour et phase) au format de Forge (celui de ses puzzles), plus ce qu'il ne
 * garde pas : la taxe et les blessures de commandant. Écrite aux moments calmes de la partie (priorité, pile
 * vide), relue au démarrage de l'application pour reprendre là où on s'était arrêté.
 */
final class SaveGame {

    private SaveGame() { }

    static File file() {
        return new File(ForgeConstants.USER_DIR, "atclaude-partie.json");
    }

    /** Photo de la partie en cours. À appeler quand le fil de partie attend une décision du joueur. */
    static JsonObject capture(final Game game, final JsonObject setup, final String sessionId) {
        final GameState state = new GameState();
        state.initFromGame(game);
        final JsonObject save = new JsonObject();
        save.addProperty("version", 1);
        save.addProperty("session", sessionId);
        save.addProperty("savedAt", System.currentTimeMillis());
        save.add("setup", setup);
        save.addProperty("state", state.toString());
        final List<Player> players = game.getPlayers();
        final JsonArray extras = new JsonArray();
        final JsonArray summary = new JsonArray();
        for (final Player p : players) {
            final JsonObject x = new JsonObject();
            final JsonArray casts = new JsonArray();
            for (final Card c : p.getCommanders()) {
                final JsonObject o = new JsonObject();
                o.addProperty("name", c.getName());
                o.addProperty("count", p.getCommanderCast(c));
                casts.add(o);
            }
            x.add("commanderCasts", casts);
            final JsonArray damage = new JsonArray();
            for (final Map.Entry<Card, Integer> e : p.getCommanderDamage()) {
                final JsonObject o = new JsonObject();
                o.addProperty("owner", players.indexOf(e.getKey().getOwner()));
                o.addProperty("name", e.getKey().getName());
                o.addProperty("damage", e.getValue());
                damage.add(o);
            }
            x.add("commanderDamage", damage);
            extras.add(x);
            final JsonObject s = new JsonObject();
            s.addProperty("name", p.getName());
            s.addProperty("life", p.getLife());
            s.addProperty("lost", p.hasLost());
            summary.add(s);
        }
        save.add("extras", extras);
        final JsonObject info = new JsonObject();
        info.addProperty("turn", game.getPhaseHandler().getTurn());
        info.addProperty("active", game.getPhaseHandler().getPlayerTurn() == null ? "" : game.getPhaseHandler().getPlayerTurn().getName());
        info.add("players", summary);
        info.addProperty("format", setup.has("format") ? setup.get("format").getAsString() : "commander");
        save.add("info", info);
        return save;
    }

    /** Remet la partie dans l'état sauvegardé (sur le fil de partie, au début du premier tour). */
    static void apply(final Game game, final JsonObject save) {
        final GameState state = new GameState();
        state.parse(Arrays.asList(save.get("state").getAsString().split("\n")));
        state.applyToGame(game);
        final List<Player> players = game.getPlayers();
        final JsonArray extras = save.has("extras") ? save.getAsJsonArray("extras") : new JsonArray();
        for (int i = 0; i < Math.min(players.size(), extras.size()); i++) {
            final Player p = players.get(i);
            final JsonObject x = extras.get(i).getAsJsonObject();
            for (final JsonElement e : x.getAsJsonArray("commanderCasts")) {
                final JsonObject o = e.getAsJsonObject();
                final Card c = commander(p, o.get("name").getAsString());
                for (int n = 0; c != null && n < o.get("count").getAsInt(); n++) {
                    p.incCommanderCast(c);
                }
            }
            for (final JsonElement e : x.getAsJsonArray("commanderDamage")) {
                final JsonObject o = e.getAsJsonObject();
                final int owner = o.get("owner").getAsInt();
                final Card c = owner >= 0 && owner < players.size() ? commander(players.get(owner), o.get("name").getAsString()) : null;
                if (c != null) {
                    p.addCommanderDamage(c, o.get("damage").getAsInt());
                }
            }
        }
    }

    private static Card commander(final Player p, final String name) {
        for (final Card c : p.getCommanders()) {
            if (c.getName().equals(name)) {
                return c;
            }
        }
        return null;
    }

    static synchronized void write(final JsonObject save) {
        try {
            final File f = file();
            f.getParentFile().mkdirs();
            final File tmp = new File(f.getPath() + ".tmp");
            Io.write(tmp, save.toString());
            Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (final IOException e) {
            System.err.println("Partie non sauvegardée : " + e.getMessage());
        }
    }

    static synchronized JsonObject read() {
        final File f = file();
        if (!f.isFile()) {
            return null;
        }
        try {
            final JsonObject o = JsonParser.parseString(Io.read(f)).getAsJsonObject();
            return o.has("state") && o.has("setup") ? o : null;
        } catch (final IOException | RuntimeException e) {
            return null;
        }
    }

    /** Efface la sauvegarde, seulement si elle vient de cette partie-là (une nouvelle partie a pu en écrire une). */
    static synchronized void delete(final String sessionId) {
        final JsonObject o = read();
        if (o == null || sessionId == null || (o.has("session") && sessionId.equals(o.get("session").getAsString()))) {
            file().delete();
        }
    }

    /** Ce que l'accueil montre de la partie sauvegardée. */
    static JsonElement summary() {
        final JsonObject o = read();
        if (o == null) {
            return null;
        }
        final JsonObject s = o.has("info") ? o.getAsJsonObject("info").deepCopy() : new JsonObject();
        s.addProperty("savedAt", o.has("savedAt") ? o.get("savedAt").getAsLong() : 0);
        return s;
    }
}
