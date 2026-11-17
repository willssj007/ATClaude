package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Mesures du pont pour le relevé de performance des Réglages (texte à copier dans un message) : étapes du démarrage,
 * photos de la partie, images servies, réflexion de l'IA, mémoire. Toutes les mesures sont des compteurs bon marché,
 * toujours actifs.
 */
final class Perf {
    private Perf() { }

    /** Début du programme (premier appel au pont) : les étapes du démarrage sont comptées depuis cet instant. */
    static volatile long startedAt = System.nanoTime();

    private static final List<Object[]> STARTUP = new ArrayList<>();
    private static String lastStep = "";

    /** Une étape du démarrage commence (ou se termine : « Prêt »). Les doublons consécutifs sont ignorés. */
    static void step(final String name) {
        if (name == null || name.isEmpty()) {
            return;
        }
        synchronized (STARTUP) {
            if (name.equals(lastStep) || STARTUP.size() > 60) {
                return;
            }
            lastStep = name;
            STARTUP.add(new Object[] {name, (System.nanoTime() - startedAt) / 1_000_000});
        }
    }

    /** Durées (ou tailles) : nombre, moyenne, médiane, 95e centile et maximum des 256 dernières valeurs. */
    static final class Stat {
        private final long[] recent = new long[256];
        private long count;
        private long sum;
        private long max;

        synchronized void add(final long v) {
            recent[(int) (count % recent.length)] = v;
            count++;
            sum += v;
            max = Math.max(max, v);
        }

        synchronized JsonObject json() {
            final JsonObject o = new JsonObject();
            o.addProperty("n", count);
            if (count == 0) {
                return o;
            }
            final long[] last = Arrays.copyOf(recent, (int) Math.min(count, recent.length));
            Arrays.sort(last);
            o.addProperty("avg", sum / count);
            o.addProperty("p50", last[last.length / 2]);
            o.addProperty("p95", last[Math.min(last.length - 1, (int) (last.length * 0.95))]);
            o.addProperty("max", max);
            return o;
        }

        synchronized void reset() {
            count = 0;
            sum = 0;
            max = 0;
        }
    }

    /** Photos de la partie : temps de construction (ms) et taille (Ko). */
    static final Stat SNAPSHOT_MS = new Stat();
    static final Stat SNAPSHOT_KB = new Stat();
    /** Images de cartes demandées par l'écran : temps de réponse (ms). */
    static final Stat IMAGE_MS = new Stat();
    static final AtomicInteger IMAGE_MISSING = new AtomicInteger();
    /** Réflexion de l'IA : temps entre le moment où elle reçoit la priorité et sa décision (ms). */
    static final Stat AI_MS = new Stat();
    static final AtomicInteger AI_CUT = new AtomicInteger();

    static JsonObject report() {
        final JsonObject o = new JsonObject();
        final JsonArray startup = new JsonArray();
        synchronized (STARTUP) {
            for (final Object[] s : STARTUP) {
                final JsonObject e = new JsonObject();
                e.addProperty("step", (String) s[0]);
                e.addProperty("ms", (Long) s[1]);
                startup.add(e);
            }
        }
        o.add("startup", startup);
        o.add("snapshotMs", SNAPSHOT_MS.json());
        o.add("snapshotKb", SNAPSHOT_KB.json());
        o.add("imageMs", IMAGE_MS.json());
        o.addProperty("imageMissing", IMAGE_MISSING.get());
        o.add("aiMs", AI_MS.json());
        o.addProperty("aiCut", AI_CUT.get());
        final Runtime rt = Runtime.getRuntime();
        o.addProperty("memUsedMb", (rt.totalMemory() - rt.freeMemory()) >> 20);
        o.addProperty("memMaxMb", rt.maxMemory() >> 20);
        o.addProperty("cpus", rt.availableProcessors());
        o.addProperty("java", System.getProperty("java.vm.name", "") + " " + System.getProperty("java.version", ""));
        o.addProperty("os", System.getProperty("os.name", "") + " " + System.getProperty("os.version", "") + " " + System.getProperty("os.arch", ""));
        o.addProperty("uptimeS", (System.nanoTime() - startedAt) / 1_000_000_000L);
        return o;
    }
}
