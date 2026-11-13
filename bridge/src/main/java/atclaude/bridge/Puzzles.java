package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.gamemodes.puzzle.Puzzle;
import forge.localinstance.properties.ForgeConstants;
import forge.util.FileSection;
import forge.util.FileUtil;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Énigmes de Forge (« Possibility Storm » et autres) : une situation de jeu toute prête et un objectif (gagner ce
 * tour-ci, survivre…). La liste, en français autant que possible, et les énigmes résolues (gardées dans le compte).
 */
final class Puzzles {

    private Puzzles() { }

    private static File dir() {
        return new File(ForgeConstants.PUZZLE_DIR);
    }

    private static File solvedFile() {
        return new File(ForgeConstants.USER_DIR, "atclaude-enigmes.json");
    }

    static synchronized java.util.Set<String> solved() {
        final java.util.Set<String> out = new java.util.TreeSet<>();
        final File f = solvedFile();
        if (f.isFile()) {
            try {
                com.google.gson.JsonParser.parseString(new String(java.nio.file.Files.readAllBytes(f.toPath()), java.nio.charset.StandardCharsets.UTF_8))
                        .getAsJsonArray().forEach(e -> out.add(e.getAsString()));
            } catch (final java.io.IOException | RuntimeException e) {
                // liste illisible : on repart de zéro
            }
        }
        return out;
    }

    static synchronized void markSolved(final String id) {
        final java.util.Set<String> s = solved();
        if (s.add(id)) {
            final JsonArray a = new JsonArray();
            s.forEach(a::add);
            try {
                java.nio.file.Files.write(solvedFile().toPath(), a.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (final java.io.IOException e) {
                System.err.println("Énigme résolue non notée : " + e.getMessage());
            }
        }
    }

    /** L'énigme d'un fichier (son nom sans .pzl). */
    static Puzzle load(final String id) {
        if (id == null || !id.matches("[A-Za-z0-9_ .()-]+")) {
            throw new IllegalArgumentException("Énigme inconnue.");
        }
        final File f = new File(dir(), id + ".pzl");
        if (!f.isFile()) {
            throw new IllegalArgumentException("Énigme introuvable : " + id);
        }
        return new Puzzle(FileSection.parseSections(FileUtil.readFile(f.getPath())), id, false);
    }

    /** La liste : identifiant, nom, objectif et description (traduits), difficulté, tours, résolue. */
    static JsonArray list() {
        final File[] files = dir().listFiles((d, n) -> n.endsWith(".pzl"));
        final JsonArray out = new JsonArray();
        if (files == null) {
            return out;
        }
        Arrays.sort(files);
        final java.util.Set<String> done = solved();
        for (final File f : files) {
            final Map<String, String> meta = new LinkedHashMap<>();
            for (final String line : FileUtil.readFile(f.getPath())) {
                if (line.startsWith("[state]")) {
                    break;
                }
                final int i = line.indexOf(':');
                if (i > 0) {
                    meta.put(line.substring(0, i).trim().toLowerCase(java.util.Locale.ROOT), line.substring(i + 1).trim());
                }
            }
            final String id = f.getName().substring(0, f.getName().length() - 4);
            final JsonObject o = new JsonObject();
            o.addProperty("id", id);
            o.addProperty("name", meta.getOrDefault("name", id));
            o.addProperty("goal", goal(meta.getOrDefault("goal", "Win")));
            o.addProperty("description", describe(meta.getOrDefault("description", "")));
            o.addProperty("difficulty", meta.getOrDefault("difficulty", ""));
            o.addProperty("turns", meta.getOrDefault("turns", "1"));
            o.addProperty("solved", done.contains(id));
            out.add(o);
        }
        return out;
    }

    private static String goal(final String g) {
        return switch (g.toLowerCase(java.util.Locale.ROOT)) {
            case "win" -> "Gagner";
            case "survive" -> "Survivre";
            case "play the specified permanent" -> "Jouer le permanent indiqué";
            case "win before opponent's next turn" -> "Gagner avant le prochain tour de l'adversaire";
            case "gain control of specified permanents" -> "Prendre le contrôle des permanents indiqués";
            case "destroy specified creatures" -> "Détruire les créatures indiquées";
            default -> g;
        };
    }

    private static final List<String[]> PHRASES = new ArrayList<>();

    static {
        final String[][] p = {
            {"Start at the beginning of your upkeep and win this turn!", "Vous commencez au début de votre entretien : gagnez ce tour-ci !"},
            {"Survive the incoming attack and win on your next turn.", "Survivez à l'attaque qui arrive et gagnez à votre prochain tour."},
            {"Try to do as much damage to your opponent as possible during your turn.", "Infligez le plus de blessures possible à votre adversaire pendant votre tour."},
            {"(Remember that )?[Yy]our solution must (satisfy|work for|account for) all (possible )?(blocking scenarios|blocking decisions|blocks|opponent decisions)\\.",
                "Votre solution doit marcher quels que soient les choix de l'adversaire (et ses blocages)."},
            {"Ensure your solution (satisfies|accounts for) all possible (blocks|blocking decisions|blocking scenarios|opponent decisions)\\.",
                "Votre solution doit marcher quels que soient les choix de l'adversaire (et ses blocages)."},
            {"Assume your opponent has no mana available and no cards in hand\\.", "Votre adversaire n'a ni mana disponible ni carte en main."},
            {"Assume your opponent has no mana available\\.", "Votre adversaire n'a pas de mana disponible."},
            {"Assume (any|that any) cards you could draw are (irrelevant to the puzzle|not relevant to the solution)\\.", "Les cartes que vous pourriez piocher ne comptent pas."},
            {"Any cards drawn are irrelevant to the puzzle\\.", "Les cartes piochées ne comptent pas."},
            {"Assume both graveyards start empty\\.", "Les deux cimetières sont vides au départ."},
            {"Your opponent has an? (.+?) in hand\\.", "Votre adversaire a $1 en main."},
            {"Win (on )?this turn[.!]", "Gagnez ce tour-ci."},
            {"Win on your turn\\.", "Gagnez pendant votre tour."},
            {"Win on your next turn\\.", "Gagnez à votre prochain tour."},
            {"Survive until your next turn\\.", "Survivez jusqu'à votre prochain tour."},
            {"Good luck!", "Bonne chance !"},
        };
        for (final String[] x : p) {
            PHRASES.add(x);
        }
    }

    private static final Map<String, Pattern> COMPILED = new LinkedHashMap<>();

    /** La description en français, phrase par phrase (une phrase inconnue reste en anglais). */
    static String describe(final String en) {
        String s = en == null ? "" : en.replace("\\n", " ").trim();
        for (final String[] x : PHRASES) {
            final Pattern p = COMPILED.computeIfAbsent(x[0], Pattern::compile);
            s = p.matcher(s).replaceAll(x[1]);
        }
        return s.replaceAll("\\s+", " ").trim();
    }
}
