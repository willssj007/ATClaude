package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.game.Game;
import forge.game.GameState;
import forge.game.card.Card;
import forge.game.phase.PhaseHandler;
import forge.game.player.Player;
import forge.localinstance.properties.ForgeConstants;

import java.io.File;
import java.io.IOException;
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

    /**
     * Photo de la partie en cours. À appeler quand le fil de partie attend une décision du joueur.
     * {@code setup} liste les places dans l'ordre de Forge (humain d'abord), comme ses joueurs inscrits.
     */
    static JsonObject capture(final Game game, final JsonObject setup, final String sessionId, final JsonObject stats) {
        final GameState state = new GameState();
        state.initFromGame(game);
        final JsonObject save = new JsonObject();
        save.addProperty("version", 1);
        save.addProperty("session", sessionId);
        save.addProperty("savedAt", System.currentTimeMillis());
        // Forge ne garde dans l'état que les joueurs encore en jeu : la reprise se fait sans les éliminés.
        final List<Player> registered = game.getRegisteredPlayers();
        final List<Player> players = game.getPlayers();
        final JsonObject still = setup.deepCopy();
        final JsonArray seats = setup.getAsJsonArray("players");
        final JsonArray kept = new JsonArray();
        for (int i = 0; i < Math.min(seats.size(), registered.size()); i++) {
            if (players.contains(registered.get(i))) {
                kept.add(seats.get(i));
            }
        }
        still.add("players", kept);
        save.add("setup", still);
        save.addProperty("state", state.toString());
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
        }
        for (final Player p : registered) {
            final JsonObject s = new JsonObject();
            s.addProperty("name", p.getName());
            s.addProperty("life", p.getLife());
            s.addProperty("lost", !players.contains(p));
            summary.add(s);
        }
        save.add("extras", extras);
        if (stats != null) {
            save.add("stats", stats);
        }
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

    /** Forge ne rafraîchit pas l'affichage après ces réglages (tour, commandants) : on le fait (méthodes internes des vues). */
    static void refreshViews(final Game game) {
        for (final String name : new String[]{"updateTurn", "updatePhase", "updatePlayerTurn"}) {
            try {
                final java.lang.reflect.Method m = game.getView().getClass().getDeclaredMethod(name, PhaseHandler.class);
                m.setAccessible(true);
                m.invoke(game.getView(), game.getPhaseHandler());
            } catch (final ReflectiveOperationException | RuntimeException e) {
                // Affichage seulement : le tour de la partie est le bon.
            }
        }
        for (final Player p : game.getPlayers()) {
            try {
                final java.lang.reflect.Method dmg = p.getView().getClass().getDeclaredMethod("updateCommanderDamage", Player.class);
                dmg.setAccessible(true);
                dmg.invoke(p.getView(), p);
                final java.lang.reflect.Method cast = p.getView().getClass().getDeclaredMethod("updateCommanderCast", Player.class, Card.class);
                cast.setAccessible(true);
                for (final Card c : p.getCommanders()) {
                    cast.invoke(p.getView(), p, c);
                }
            } catch (final ReflectiveOperationException | RuntimeException e) {
                // Affichage seulement : les règles (21 blessures, taxe) s'appliquent quand même.
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
        if (o == null) {
            return;
        }
        if (sessionId == null || (o.has("session") && sessionId.equals(o.get("session").getAsString()))) {
            file().delete();
            // Retenu pour la synchronisation : une copie de cette partie sur un autre appareil ne revient pas.
            markCleared(o.has("savedAt") ? o.get("savedAt").getAsLong() : System.currentTimeMillis());
        }
    }

    private static File clearedFile() {
        return new File(ForgeConstants.USER_DIR, "atclaude-partie-effacee.txt");
    }

    /** Date de la dernière sauvegarde effacée (partie finie ou abandonnée) : les copies plus anciennes sont périmées. */
    static synchronized long clearedAt() {
        try {
            return clearedFile().isFile() ? Long.parseLong(Io.read(clearedFile()).trim()) : 0;
        } catch (final IOException | RuntimeException e) {
            return 0;
        }
    }

    static synchronized void markCleared(final long at) {
        if (at <= clearedAt()) {
            return;
        }
        try {
            clearedFile().getParentFile().mkdirs();
            Io.write(clearedFile(), String.valueOf(at));
        } catch (final IOException e) {
            System.err.println("Date d'effacement non enregistrée : " + e.getMessage());
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
