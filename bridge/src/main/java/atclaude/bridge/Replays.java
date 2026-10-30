package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.localinstance.properties.ForgeConstants;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Replays des 5 dernières parties. Pendant la partie, chaque photo envoyée à l'interface (ce que le joueur voyait :
 * les mains adverses restent cachées) est gardée, sous forme de différence avec la précédente, dans un fichier
 * compressé ; une photo complète toutes les {@link #KEY_EVERY}, pour aller vite à n'importe quel moment. À la fin de la
 * partie, un petit fichier de résumé (joueurs, decks, résultat, débuts de tour) l'accompagne, et les plus anciens
 * replays au-delà de {@link #KEEP} sont effacés.
 *
 * Pour revoir une partie, l'interface demande les photos une à une (replayFrame) : le pont les reconstruit à partir
 * de la photo complète la plus proche, et garde la dernière en mémoire pour avancer sans tout relire.
 */
final class Replays {

    static final int KEEP = 5;
    static final int KEY_EVERY = 40;
    /** Clés d'une différence : éléments d'un tableau de même longueur, clés retirées d'un objet. */
    private static final String ITEMS = "∆";
    private static final String GONE = "∅";

    private Replays() { }

    static File dir() {
        return new File(ForgeConstants.USER_DIR, "atclaude-replays");
    }

    // ------------------------------------------------------------------ différences

    /** Ce qui change de a à b (null : rien). Les objets et les tableaux de même longueur sont comparés en détail. */
    static JsonElement diff(final JsonElement a, final JsonElement b) {
        if (a != null && a.equals(b)) {
            return null;
        }
        if (a != null && a.isJsonObject() && b.isJsonObject()) {
            final JsonObject x = a.getAsJsonObject();
            final JsonObject d = new JsonObject();
            for (final Map.Entry<String, JsonElement> e : b.getAsJsonObject().entrySet()) {
                final JsonElement sub = diff(x.get(e.getKey()), e.getValue());
                if (sub != null) {
                    d.add(e.getKey(), sub);
                }
            }
            final JsonArray gone = new JsonArray();
            for (final String k : x.keySet()) {
                if (!b.getAsJsonObject().has(k)) {
                    gone.add(k);
                }
            }
            if (!gone.isEmpty()) {
                d.add(GONE, gone);
            }
            return d;
        }
        if (a != null && a.isJsonArray() && b.isJsonArray() && a.getAsJsonArray().size() == b.getAsJsonArray().size()) {
            final JsonArray x = a.getAsJsonArray();
            final JsonArray y = b.getAsJsonArray();
            final JsonArray items = new JsonArray();
            for (int i = 0; i < y.size(); i++) {
                final JsonElement sub = diff(x.get(i), y.get(i));
                items.add(sub == null ? JsonNull.INSTANCE : sub);
            }
            final JsonObject d = new JsonObject();
            d.add(ITEMS, items);
            return d;
        }
        return b;
    }

    /** L'inverse de diff : base (non modifiée) plus la différence. */
    static JsonElement apply(final JsonElement base, final JsonElement d) {
        if (d == null) {
            return base;
        }
        if (d.isJsonObject() && base != null && base.isJsonArray() && d.getAsJsonObject().has(ITEMS)) {
            final JsonArray x = base.getAsJsonArray();
            final JsonArray items = d.getAsJsonObject().getAsJsonArray(ITEMS);
            final JsonArray out = new JsonArray();
            for (int i = 0; i < items.size(); i++) {
                out.add(items.get(i).isJsonNull() ? x.get(i) : apply(x.get(i), items.get(i)));
            }
            return out;
        }
        if (d.isJsonObject() && base != null && base.isJsonObject()) {
            final JsonObject out = new JsonObject();
            final JsonObject dd = d.getAsJsonObject();
            final JsonArray gone = dd.has(GONE) ? dd.getAsJsonArray(GONE) : new JsonArray();
            for (final Map.Entry<String, JsonElement> e : base.getAsJsonObject().entrySet()) {
                boolean removed = false;
                for (final JsonElement g : gone) {
                    removed |= g.getAsString().equals(e.getKey());
                }
                if (!removed) {
                    out.add(e.getKey(), dd.has(e.getKey()) ? apply(e.getValue(), dd.get(e.getKey())) : e.getValue());
                }
            }
            for (final Map.Entry<String, JsonElement> e : dd.entrySet()) {
                if (!e.getKey().equals(GONE) && !out.has(e.getKey())) {
                    out.add(e.getKey(), e.getValue());
                }
            }
            return out;
        }
        return d;
    }

    // ------------------------------------------------------------------ enregistrement

    /** L'enregistrement d'une partie en cours (une par MatchSession). */
    static final class Recorder {
        private final String id;
        private final long startedAt = System.currentTimeMillis();
        private final File tmp;
        private BufferedWriter out;
        private JsonObject prev;
        private int frames;
        private final JsonArray turns = new JsonArray();
        private String turnKey = "";
        private boolean failed;
        private boolean playing;
        /** Terminé (gardé ou jeté) : les photos suivantes ne comptent plus. */
        private boolean done;

        Recorder(final String id) {
            this.id = id.replaceAll("[^A-Za-z0-9_-]", "");
            this.tmp = new File(dir(), this.id + ".tmp.gz");
        }

        /** Une photo envoyée à l'interface (sans ses réglages, qui ne font pas partie de la partie). */
        synchronized void add(final JsonObject state) {
            if (failed || done) {
                return;
            }
            final JsonObject game = state.has("game") && state.get("game").isJsonObject() ? state.getAsJsonObject("game") : null;
            if (game == null) {
                return;
            }
            // Rien avant le premier tour (choix du premier joueur, mulligans).
            playing |= game.has("turn") && game.get("turn").getAsInt() >= 1 && !(game.has("mulligan") && game.get("mulligan").getAsBoolean());
            if (!playing) {
                return;
            }
            final JsonObject s = new JsonObject();
            for (final Map.Entry<String, JsonElement> e : state.entrySet()) {
                if (!"settings".equals(e.getKey())) {
                    s.add(e.getKey(), e.getValue());
                }
            }
            try {
                final JsonObject line = new JsonObject();
                line.addProperty("t", System.currentTimeMillis() - startedAt);
                if (prev == null || frames % KEY_EVERY == 0) {
                    line.add("k", s);
                } else {
                    final JsonElement d = diff(prev, s);
                    if (d == null || d.isJsonObject() && d.getAsJsonObject().isEmpty()) {
                        return; // photo identique : rien à revoir
                    }
                    line.add("d", d);
                }
                if (out == null) {
                    dir().mkdirs();
                    cleanTemporary(tmp);
                    out = new BufferedWriter(new OutputStreamWriter(new GZIPOutputStream(new FileOutputStream(tmp), 1 << 16), StandardCharsets.UTF_8));
                }
                final String key = game.get("turn").getAsInt() + ":" + (game.has("activePlayer") ? game.get("activePlayer").getAsInt() : -1);
                if (!key.equals(turnKey)) {
                    turnKey = key;
                    final JsonObject t = new JsonObject();
                    t.addProperty("i", frames);
                    t.addProperty("turn", game.get("turn").getAsInt());
                    t.addProperty("player", game.has("activePlayer") ? game.get("activePlayer").getAsInt() : -1);
                    turns.add(t);
                }
                out.write(Bridge.GSON.toJson(line));
                out.write('\n');
                prev = s;
                frames++;
            } catch (final IOException | RuntimeException e) {
                failed = true;
                System.err.println("Replay non enregistré : " + e);
                close();
                tmp.delete();
            }
        }

        /** Fin de la partie : le replay rejoint les autres, avec son résumé ; seuls les 5 plus récents restent. */
        synchronized void finish(final JsonObject meta) {
            done = true;
            if (out == null || failed) {
                close();
                return;
            }
            close();
            if (frames < 2) {
                tmp.delete();
                return;
            }
            try {
                final File frameFile = new File(dir(), id + ".frames.gz");
                if (!tmp.renameTo(frameFile)) {
                    throw new IOException("renommage impossible");
                }
                meta.addProperty("id", id);
                meta.addProperty("frames", frames);
                meta.addProperty("duration", System.currentTimeMillis() - startedAt);
                meta.add("turnStarts", turns);
                Io.write(new File(dir(), id + ".json"), meta.toString());
                prune();
            } catch (final IOException | RuntimeException e) {
                System.err.println("Replay non enregistré : " + e);
                tmp.delete();
            }
            out = null;
        }

        /** Partie abandonnée sans fin (fermeture de l'application, partie reprise plus tard) : rien à garder. */
        synchronized void discard() {
            done = true;
            close();
            tmp.delete();
        }

        private void close() {
            if (out != null) {
                try {
                    out.close();
                } catch (final IOException e) {
                    // fichier incomplet : effacé par l'appelant
                }
            }
            out = null;
        }
    }

    /** Fichiers d'enregistrement laissés par une application fermée en pleine partie (sauf celui-ci). */
    private static void cleanTemporary(final File keep) {
        final File[] files = dir().listFiles((d, n) -> n.endsWith(".tmp.gz"));
        if (files != null) {
            for (final File f : files) {
                if (!f.equals(keep) && System.currentTimeMillis() - f.lastModified() > 6 * 3600_000L) {
                    f.delete();
                }
            }
        }
    }

    private static synchronized void prune() {
        final List<JsonObject> all = metas();
        for (int i = KEEP; i < all.size(); i++) {
            final String id = all.get(i).get("id").getAsString();
            new File(dir(), id + ".json").delete();
            new File(dir(), id + ".frames.gz").delete();
            if (id.equals(openId)) {
                openId = null;
                openLines = null;
            }
        }
    }

    private static List<JsonObject> metas() {
        final List<JsonObject> out = new ArrayList<>();
        final File[] files = dir().listFiles((d, n) -> n.endsWith(".json"));
        if (files != null) {
            for (final File f : files) {
                try {
                    final JsonObject o = JsonParser.parseString(Io.read(f)).getAsJsonObject();
                    if (o.has("id") && new File(dir(), o.get("id").getAsString() + ".frames.gz").isFile()) {
                        out.add(o);
                    }
                } catch (final IOException | RuntimeException e) {
                    // résumé illisible : ignoré
                }
            }
        }
        out.sort(Comparator.comparingLong((JsonObject o) -> o.has("at") ? o.get("at").getAsLong() : 0).reversed());
        return out;
    }

    // ------------------------------------------------------------------ lecture

    /** Les replays gardés, du plus récent au plus ancien (résumés seulement). */
    static synchronized JsonArray list() {
        final JsonArray a = new JsonArray();
        for (final JsonObject o : metas()) {
            final JsonObject m = o.deepCopy();
            m.remove("turnStarts");
            a.add(m);
        }
        return a;
    }

    /** Une ligne qui porte une photo complète : {"t":…,"k":…} (ordre d'écriture de Gson). */
    private static final java.util.regex.Pattern KEY_LINE = java.util.regex.Pattern.compile("\\{\"t\":-?\\d+,\"k\"");

    private static String openId;
    private static List<String> openLines;
    private static int cursor = -1;
    private static JsonObject cursorState;

    /** Ouvre un replay : son résumé complet (débuts de tour compris) ; les photos se lisent ensuite une à une. */
    static synchronized JsonObject open(final String id) throws IOException {
        final String clean = id.replaceAll("[^A-Za-z0-9_-]", "");
        final File meta = new File(dir(), clean + ".json");
        final File frames = new File(dir(), clean + ".frames.gz");
        if (!meta.isFile() || !frames.isFile()) {
            throw new IllegalArgumentException("Ce replay n'existe plus (seules les 5 dernières parties sont gardées).");
        }
        if (!clean.equals(openId)) {
            final List<String> lines = new ArrayList<>();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(new GZIPInputStream(new FileInputStream(frames), 1 << 16), StandardCharsets.UTF_8))) {
                for (String l = r.readLine(); l != null; l = r.readLine()) {
                    if (!l.isEmpty()) {
                        lines.add(l);
                    }
                }
            } catch (final java.io.EOFException e) {
                // fin coupée (application fermée pendant l'écriture) : ce qui a été lu reste visible
            }
            openId = clean;
            openLines = lines;
            cursor = -1;
            cursorState = null;
        }
        final JsonObject o = JsonParser.parseString(Io.read(meta)).getAsJsonObject();
        o.addProperty("frames", openLines.size());
        return o;
    }

    /** La photo n° i du replay ouvert (avec « t », son moment depuis le début de la partie, en millisecondes). */
    static synchronized JsonObject frame(final String id, final int i) throws IOException {
        if (!id.replaceAll("[^A-Za-z0-9_-]", "").equals(openId)) {
            open(id);
        }
        final List<String> lines = openLines;
        final int target = Math.max(0, Math.min(lines.size() - 1, i));
        int from;
        JsonObject state;
        if (cursorState != null && cursor <= target && target - cursor <= KEY_EVERY) {
            from = cursor + 1;
            state = cursorState;
        } else {
            from = target;
            while (from > 0 && !KEY_LINE.matcher(lines.get(from)).lookingAt()) {
                from--;
            }
            state = null;
        }
        long t = 0;
        for (int k = from; k <= target; k++) {
            final JsonObject line = JsonParser.parseString(lines.get(k)).getAsJsonObject();
            t = line.has("t") ? line.get("t").getAsLong() : 0;
            if (line.has("k")) {
                state = line.getAsJsonObject("k");
            } else if (state != null) {
                state = apply(state, line.get("d")).getAsJsonObject();
            }
        }
        if (state == null) {
            throw new IllegalStateException("Replay illisible.");
        }
        cursor = target;
        cursorState = state;
        final JsonObject out = state.deepCopy();
        out.addProperty("replayIndex", target);
        out.addProperty("replayTime", t);
        return out;
    }

    static synchronized void delete(final String id) {
        final String clean = id.replaceAll("[^A-Za-z0-9_-]", "");
        new File(dir(), clean + ".json").delete();
        new File(dir(), clean + ".frames.gz").delete();
        if (clean.equals(openId)) {
            openId = null;
            openLines = null;
            cursorState = null;
        }
    }
}
