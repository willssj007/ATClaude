package atclaude.bridge;

import forge.sound.IAudioClip;

import java.io.File;

/**
 * Sons de partie : Forge choisit le bruitage de chaque événement (carte engagée, sort lancé, terrain joué...)
 * et demande un « clip » à l'interface graphique. Le clip du pont ne joue rien lui-même : il dit à
 * l'interface quel bruitage jouer. Les bruitages et les musiques sont ceux d'Arcane Table (ui/snd, générés
 * par tools/audio), pas ceux de Forge.
 */
public final class Audio {

    private Audio() { }

    static IAudioClip clip(final Bridge bridge, final String filename) {
        final String name = new File(filename).getName();
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
}
