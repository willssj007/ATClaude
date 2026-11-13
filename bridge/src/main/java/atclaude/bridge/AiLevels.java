package atclaude.bridge;

import forge.ai.AiProfileUtil;
import forge.localinstance.properties.ForgeConstants;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Niveaux de l'IA, choisis place par place dans le salon (et montés manche après manche dans la Gauntlet).
 *
 * <ul>
 *   <li>Facile : l'IA commence avec 25 % de points de vie en moins et pioche au hasard ;</li>
 *   <li>Normal : l'IA de Forge telle quelle (pioche au hasard) ;</li>
 *   <li>Difficile : sa bibliothèque est mélangée « en sa faveur » (terrains bien répartis : ni noyée ni à court) ;</li>
 *   <li>Expert : pareil, avec 25 % de points de vie en plus.</li>
 * </ul>
 *
 * Forge n'a qu'une règle de partie pour le mélange en faveur de l'IA ; chaque personnalité a donc une copie « juste »
 * (sans ce mélange), et la règle est active pour toutes les parties : seules les IA Difficile et Expert en profitent.
 */
final class AiLevels {

    private AiLevels() { }

    static final String FAIR = "~juste";
    /** Les personnalités de Forge (sans les copies « justes »). */
    private static final List<String> BASE = new ArrayList<>();

    /** Copie les profils de Forge avec leur variante « juste », puis les recharge depuis cette copie. */
    static synchronized void install() {
        final File src = new File(ForgeConstants.AI_PROFILE_DIR);
        final File[] files = src.listFiles((d, n) -> n.endsWith(".ai"));
        if (files == null || files.length == 0) {
            return;
        }
        final File dir = new File(ForgeConstants.USER_DIR, "atclaude-ai");
        try {
            Files.createDirectories(dir.toPath());
            BASE.clear();
            for (final File f : files) {
                final String name = f.getName().substring(0, f.getName().length() - 3);
                final String text = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
                Files.write(new File(dir, name + ".ai").toPath(), text.getBytes(StandardCharsets.UTF_8));
                final String fair = text.replaceAll("(?m)^CHEAT_WITH_MANA_ON_SHUFFLE=.*$", "CHEAT_WITH_MANA_ON_SHUFFLE=false");
                Files.write(new File(dir, name + FAIR + ".ai").toPath(),
                        (fair.contains("CHEAT_WITH_MANA_ON_SHUFFLE") ? fair : fair + "\nCHEAT_WITH_MANA_ON_SHUFFLE=false\n").getBytes(StandardCharsets.UTF_8));
                BASE.add(name);
            }
            AiProfileUtil.loadAllProfiles(dir.getPath());
        } catch (final IOException | RuntimeException e) {
            System.err.println("Niveaux de l'IA indisponibles : " + e.getMessage());
            BASE.clear();
            AiProfileUtil.loadAllProfiles(ForgeConstants.AI_PROFILE_DIR);
        }
    }

    /** Les copies « justes » sont-elles en place (sinon, pas de pioche lissée : la règle de Forge reste coupée) ? */
    static boolean ready() {
        return !BASE.isEmpty();
    }

    /** Les personnalités à proposer dans le salon (sans les copies). */
    static List<String> displayList() {
        final List<String> out = new ArrayList<>();
        for (final String p : AiProfileUtil.getProfilesDisplayList()) {
            if (!p.endsWith(FAIR)) {
                out.add(p);
            }
        }
        return out;
    }

    static String normalize(final String level) {
        final String l = level == null ? "" : level.toLowerCase(Locale.ROOT);
        return switch (l) {
            case "facile", "difficile", "expert" -> l;
            default -> "normal";
        };
    }

    /** Le profil Forge d'une IA : sa personnalité (tirée au hasard si besoin), en copie « juste » sous Difficile. */
    static String profile(final String personality, final String level) {
        String p = personality == null ? "" : personality;
        if (!ready()) {
            return p;
        }
        if (p.isEmpty() || p.startsWith("Random") || !BASE.contains(p)) {
            p = p.isEmpty() && BASE.contains("Default") ? "Default" : BASE.get(ThreadLocalRandom.current().nextInt(BASE.size()));
        }
        final String l = normalize(level);
        return "difficile".equals(l) || "expert".equals(l) ? p : p + FAIR;
    }

    /** Les points de vie de départ d'une IA selon son niveau. */
    static int life(final int base, final String level) {
        return switch (normalize(level)) {
            case "facile" -> Math.max(1, Math.round(base * 0.75f));
            case "expert" -> Math.round(base * 1.25f);
            default -> base;
        };
    }
}
