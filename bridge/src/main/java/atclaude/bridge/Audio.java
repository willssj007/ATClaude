package atclaude.bridge;

import com.google.gson.JsonArray;
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
final class Audio {

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

    /** Fichiers de musique (menus, partie) et de sons fournis avec Forge. */
    static JsonObject files() {
        final JsonObject o = new JsonObject();
        final File res = new File(ForgeConstants.RES_DIR);
        o.add("menus", list(new File(res, ForgeConstants.MUSIC_DIR + "menus")));
        o.add("match", list(new File(res, ForgeConstants.MUSIC_DIR + "match")));
        o.add("sounds", list(new File(res, ForgeConstants.SOUND_DIR)));
        return o;
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
