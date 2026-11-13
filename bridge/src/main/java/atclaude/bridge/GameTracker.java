package atclaude.bridge;

import com.google.common.eventbus.Subscribe;
import com.google.gson.JsonObject;
import forge.game.card.CardView;
import forge.game.event.GameEvent;
import forge.game.event.GameEventCardChangeZone;
import forge.game.event.GameEventPlayerDamaged;
import forge.game.event.GameEventSpellAbilityCast;
import forge.game.event.GameEventTurnBegan;
import forge.game.player.PlayerView;
import forge.game.zone.ZoneType;

/**
 * Compte pendant la partie ce que Forge ne garde pas pour les statistiques : blessures infligées aux
 * adversaires et reçues, terrains arrivés sur le champ de bataille, tours joués, sorts lancés.
 * Abonné aux événements du jeu ; ces compteurs vont aussi dans la sauvegarde pour survivre à une reprise.
 */
final class GameTracker {

    private final int me;
    private volatile boolean paused;
    private volatile int dealt;
    private volatile int taken;
    private volatile int lands;
    private volatile int turns;
    private volatile int spells;
    /** Cartes perso jouées (lancées, ou terrains posés) : nom → nombre de fois, pour leurs statistiques. */
    private final java.util.Map<String, Integer> customPlayed = new java.util.concurrent.ConcurrentHashMap<>();
    /** Mulligans et triche d'avant la reprise d'une partie sauvegardée. */
    private volatile int mulligansBefore;
    volatile boolean cheated;

    GameTracker(final int me) {
        this.me = me;
    }

    /** Pendant la remise en place d'une partie sauvegardée, les cartes posées ne comptent pas. */
    void pause(final boolean value) {
        paused = value;
    }

    @Subscribe
    public void receiveGameEvent(final GameEvent ev) {
        if (paused) {
            return;
        }
        if (ev instanceof GameEventPlayerDamaged d) {
            if (d.target() != null && d.target().getId() == me) {
                taken += d.amount();
            } else if (isMine(d.source() == null ? null : d.source().getController())) {
                dealt += d.amount();
            }
        } else if (ev instanceof GameEventCardChangeZone z) {
            final CardView c = z.card();
            if (z.to() != null && z.to().zoneType() == ZoneType.Battlefield && isMine(z.to().player())
                    && (z.from() == null || z.from().zoneType() != ZoneType.Battlefield)
                    && c != null && c.getCurrentState() != null && c.getCurrentState().isLand()) {
                lands++;
                if (z.from() != null && z.from().zoneType() == ZoneType.Hand) {
                    played(c);
                }
            }
        } else if (ev instanceof GameEventTurnBegan t) {
            if (isMine(t.turnOwner())) {
                turns++;
            }
        } else if (ev instanceof GameEventSpellAbilityCast c) {
            if (c.si() != null && !c.si().isAbility() && !c.si().isTrigger() && isMine(c.si().getActivatingPlayer())) {
                spells++;
                played(c.si().getSourceCard());
            }
        }
    }

    private void played(final CardView c) {
        if (c == null || c.getCurrentState() == null) {
            return;
        }
        final String name = c.getCurrentState().getName();
        final String front = CustomCards.frontOf(name);
        final String card = front != null ? front : name;
        if (CustomCards.isCustom(card)) {
            customPlayed.merge(card, 1, Integer::sum);
        }
    }

    /** {nom : fois jouée} des cartes perso jouées dans cette partie. */
    JsonObject customPlayed() {
        final JsonObject o = new JsonObject();
        customPlayed.forEach(o::addProperty);
        return o;
    }

    private boolean isMine(final PlayerView p) {
        return p != null && p.getId() == me;
    }

    JsonObject toJson() {
        final JsonObject o = new JsonObject();
        o.addProperty("dealt", dealt);
        o.addProperty("taken", taken);
        o.addProperty("lands", lands);
        o.addProperty("turns", turns);
        o.addProperty("spells", spells);
        o.addProperty("mulligans", mulligansBefore);
        o.addProperty("cheated", cheated);
        o.add("customPlayed", customPlayed());
        return o;
    }

    void restore(final JsonObject o) {
        if (o == null) {
            return;
        }
        dealt = num(o, "dealt");
        taken = num(o, "taken");
        lands = num(o, "lands");
        turns = num(o, "turns");
        spells = num(o, "spells");
        mulligansBefore = num(o, "mulligans");
        cheated = o.has("cheated") && o.get("cheated").getAsBoolean();
        if (o.has("customPlayed") && o.get("customPlayed").isJsonObject()) {
            o.getAsJsonObject("customPlayed").entrySet().forEach(e -> customPlayed.put(e.getKey(), e.getValue().getAsInt()));
        }
    }

    void setMulligansBefore(final int n) {
        mulligansBefore = n;
    }

    int mulligansBefore() {
        return mulligansBefore;
    }

    int dealt() { return dealt; }
    int taken() { return taken; }
    int lands() { return lands; }
    int turns() { return turns; }
    int spells() { return spells; }

    private static int num(final JsonObject o, final String key) {
        return o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsInt() : 0;
    }
}
