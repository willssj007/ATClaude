package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.localinstance.properties.ForgeConstants;
import forge.sound.IAudioClip;

import java.io.File;
import java.util.Arrays;

/**
 * Sons de partie : Forge choisit le son de chaque événement (carte engagée, sort lancé, terrain joué...)
 * et demande un « clip » à l'interface graphique. Le clip du pont ne joue rien lui-même : il dit à
 * l'interface quel fichier jouer (les fichiers sont servis sous /audio/sound/).
 */
public final class Audio {

    private Audio() { }

    static IAudioClip clip(final Bridge bridge, final String filename) {
        final String name = resolve(new File(filename).getName());
        return new IAudioClip() {
            @Override
            public void play(final float volume) {
                bridge.sendEvent("sound", m -> m.addProperty("name", name));
            }

            @Override
            public boolean isDone() {
                return true;
            }

            @Override
            public void stop() { }

            @Override
            public void loop() { }

            @Override
            public void dispose() { }
        };
    }

    /** Forge nomme les sons sans extension (« tap ») : on retrouve le fichier (« tap.mp3 »). */
    private static String resolve(final String name) {
        if (name.indexOf('.') >= 0) {
            return name;
        }
        final String[] found = new File(ForgeConstants.RES_DIR, ForgeConstants.SOUND_DIR).list((d, n) -> n.startsWith(name + "."));
        return found != null && found.length > 0 ? found[0] : name + ".mp3";
    }

    /**
     * Musiques douces, médiévales et féeriques, tirées de celles du mode Aventure de Forge (Vindsvept,
     * Brandon et Derek Fiechter, Logan Epic Canto : voir le fichier Credit-and-Thanks de Forge). Chaque morceau
     * a son volume relatif : ils n'ont pas tous été mixés aussi fort, on les ramène tous vers -16 LUFS.
     */
    private static final String SOFT = "adventure/common/music/";
    private static final Object[][] MENUS = {
        {"menus/menu1.mp3", 0.56}, {"menus/menu2.mp3", 0.87}, {"town/town1.mp3", 0.80}, {"town/town5.mp3", 0.91},
        {"town/town7.mp3", 1.0}, {"white/white2.mp3", 0.79}, {"green/green2.mp3", 0.75},
    };
    private static final Object[][] MATCH = {
        {"green/green1.mp3", 0.53}, {"white/white1.mp3", 0.74}, {"colorless/waste1.mp3", 0.76},
        {"colorless/waste2.mp3", 1.0}, {"town/town6.mp3", 0.53},
    };

    /** Musiques (menus, partie) et sons fournis avec Forge. Chaque musique : chemin sous /audio/ et volume relatif. */
    static JsonObject files() {
        final JsonObject o = new JsonObject();
        final File res = new File(ForgeConstants.RES_DIR);
        o.add("menus", music(res, MENUS, "menus"));
        o.add("match", music(res, MATCH, "match"));
        o.add("sounds", list(new File(res, ForgeConstants.SOUND_DIR)));
        return o;
    }

    private static JsonArray music(final File res, final Object[][] tracks, final String fallback) {
        final JsonArray a = new JsonArray();
        for (final Object[] t : tracks) {
            final String path = SOFT + t[0];
            if (new File(res, path).isFile()) {
                final JsonObject e = new JsonObject();
                e.addProperty("path", path);
                e.addProperty("gain", (Double) t[1]);
                a.add(e);
            }
        }
        // Ressources sans les musiques du mode Aventure : celles de Kevin MacLeod (res/music).
        if (a.size() == 0) {
            for (final JsonElement n : list(new File(res, ForgeConstants.MUSIC_DIR + fallback))) {
                final JsonObject e = new JsonObject();
                e.addProperty("path", "music/" + fallback + "/" + n.getAsString());
                e.addProperty("gain", 1.0);
                a.add(e);
            }
        }
        return a;
    }

    /** Fichiers que l'interface peut demander sous /audio/ (sons, musiques). */
    public static boolean servable(final String rel) {
        return rel.startsWith("sound/") || rel.startsWith("music/") || rel.startsWith(SOFT);
    }

    private static JsonArray list(final File dir) {
        final JsonArray a = new JsonArray();
        final String[] names = dir.list((d, n) -> n.toLowerCase().endsWith(".mp3") || n.toLowerCase().endsWith(".ogg") || n.toLowerCase().endsWith(".wav"));
        if (names != null) {
            Arrays.sort(names);
            for (final String n : names) {
                a.add(n);
            }
        }
        return a;
    }
}
