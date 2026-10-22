package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.common.collect.Multiset;
import forge.util.CardTranslation;
import forge.card.ColorSet;
import forge.card.MagicColor;
import forge.card.mana.ManaCost;
import forge.game.GameEntityView;
import forge.game.GameLogEntry;
import forge.game.GameView;
import forge.game.card.CardView;
import forge.game.card.CardView.CardStateView;
import forge.game.card.CounterEnumType;
import forge.game.card.CounterType;
import forge.game.combat.CombatView;
import forge.game.phase.PhaseType;
import forge.game.player.PlayerView;
import forge.game.spellability.StackItemView;
import forge.game.zone.ZoneType;
import forge.gui.card.CardDetailUtil;

import java.util.ArrayList;
import java.util.ConcurrentModificationException;
import java.util.List;

/**
 * Convertit l'état d'une partie (vu par le joueur local) en JSON pour l'interface.
 *
 * Les vues Forge sont modifiées par le fil de partie pendant qu'on les lit : une lecture peut
 * échouer sur une modification concurrente, on recommence alors (voir {@link #snapshot}).
 */
final class GameSerializer {

    private static final ZoneType[] VISIBLE_ZONES = {
        ZoneType.Hand, ZoneType.Battlefield, ZoneType.Graveyard, ZoneType.Exile, ZoneType.Command
    };
    private static final byte[] MANA_COLORS = {
        MagicColor.WHITE, MagicColor.BLUE, MagicColor.BLACK, MagicColor.RED, MagicColor.GREEN, MagicColor.COLORLESS
    };
    private static final String[] MANA_LETTERS = {"W", "U", "B", "R", "G", "C"};
    private static final int LOG_SIZE = 40;

    private final BridgeGuiGame gui;

    GameSerializer(final BridgeGuiGame gui) {
        this.gui = gui;
    }

    JsonObject snapshot() {
        for (int attempt = 0; ; attempt++) {
            try {
                return build();
            } catch (final ConcurrentModificationException | NullPointerException | IndexOutOfBoundsException e) {
                if (attempt >= 5) {
                    throw e;
                }
                Thread.onSpinWait();
            }
        }
    }

    private JsonObject build() {
        final GameView gv = gui.getGameView();
        final JsonObject state = new JsonObject();
        state.addProperty("type", "state");
        if (gv == null) {
            return state;
        }
        final PlayerView me = gui.getCurrentPlayer();
        final PlayerView turn = gv.getPlayerTurn();
        final PhaseType phase = gv.getPhase();

        final JsonObject game = new JsonObject();
        game.addProperty("turn", gv.getTurn());
        game.addProperty("phase", phase == null ? "" : phase.name());
        game.addProperty("activePlayer", turn == null ? -1 : turn.getId());
        game.addProperty("commander", gv.isCommander());
        game.addProperty("mulligan", gv.isMulligan());
        game.addProperty("gameOver", gv.isGameOver());
        game.addProperty("matchOver", gv.isMatchOver());
        if (gv.isGameOver()) {
            game.addProperty("winner", gv.getWinningPlayerName());
        }
        state.add("game", game);
        state.addProperty("me", me == null ? -1 : me.getId());

        final JsonArray players = new JsonArray();
        for (final PlayerView p : gv.getPlayers()) {
            players.add(player(p, gv, me));
        }
        state.add("players", players);

        final JsonArray stack = new JsonArray();
        for (final StackItemView item : gv.getStack()) {
            stack.add(stackItem(item));
        }
        state.add("stack", stack);
        state.add("combat", combat(gv.getCombat()));
        state.add("log", log(gv));
        return state;
    }

    private JsonObject player(final PlayerView p, final GameView gv, final PlayerView me) {
        final JsonObject o = new JsonObject();
        o.addProperty("id", p.getId());
        o.addProperty("name", p.getLobbyPlayerName());
        o.addProperty("ai", p.isAI());
        o.addProperty("me", me != null && me.getId() == p.getId());
        o.addProperty("life", p.getLife());
        o.addProperty("poison", p.getCounters(CounterEnumType.POISON));
        o.addProperty("energy", p.getCounters(CounterEnumType.ENERGY));
        o.addProperty("lost", p.getHasLost());
        o.addProperty("priority", p.getHasPriority());
        o.addProperty("avatar", p.getAvatarIndex());
        o.addProperty("landsPlayed", p.getNumLandThisTurn());
        o.addProperty("maxLands", p.hasUnlimitedLandPlay() ? -1 : p.getMaxLandPlay());
        o.addProperty("selectable", gui.isSelectable(p));
        o.addProperty("highlighted", gui.isHighlighted(p));

        final JsonObject mana = new JsonObject();
        for (int i = 0; i < MANA_COLORS.length; i++) {
            mana.addProperty(MANA_LETTERS[i], p.getMana(MANA_COLORS[i]));
        }
        o.add("mana", mana);

        o.addProperty("library", p.getZoneSize(ZoneType.Library));
        o.addProperty("handSize", p.getZoneSize(ZoneType.Hand));
        final JsonObject zones = new JsonObject();
        for (final ZoneType zone : VISIBLE_ZONES) {
            final JsonArray cards = new JsonArray();
            for (final CardView c : copy(p.getCards(zone))) {
                cards.add(card(c, gv));
            }
            zones.add(zone.name().toLowerCase(), cards);
        }
        o.add("zones", zones);

        // Blessures infligées à ce joueur par chaque commandant adverse, et taxe de ses propres commandants.
        final JsonArray commanderDamage = new JsonArray();
        for (final PlayerView other : gv.getPlayers()) {
            for (final CardView commander : copy(other.getCommanders())) {
                final int damage = p.getCommanderDamage(commander);
                if (damage > 0) {
                    final JsonObject d = new JsonObject();
                    d.addProperty("commander", commander.getId());
                    d.addProperty("name", translatedName(commander.getCurrentState()));
                    d.addProperty("damage", damage);
                    commanderDamage.add(d);
                }
            }
        }
        o.add("commanderDamage", commanderDamage);
        final JsonArray commanders = new JsonArray();
        for (final CardView commander : copy(p.getCommanders())) {
            final JsonObject c = new JsonObject();
            c.addProperty("id", commander.getId());
            c.addProperty("casts", p.getCommanderCast(commander));
            commanders.add(c);
        }
        o.add("commanders", commanders);
        return o;
    }

    JsonObject card(final CardView c, final GameView gv) {
        final JsonObject o = new JsonObject();
        o.addProperty("id", c.getId());
        final boolean canShow = gui.mayView(c);
        o.addProperty("hidden", !canShow);
        if (c.getController() != null) {
            o.addProperty("controller", c.getController().getId());
        }
        if (c.getOwner() != null) {
            o.addProperty("owner", c.getOwner().getId());
        }
        if (c.getZone() != null) {
            o.addProperty("zone", c.getZone().name().toLowerCase());
        }
        o.addProperty("tapped", c.isTapped());
        o.addProperty("selectable", gui.isSelectable(c));
        o.addProperty("playable", gui.isWeaklySelectable(c));
        o.addProperty("highlighted", gui.isHighlighted(c));
        o.addProperty("attacking", c.isAttacking());
        o.addProperty("blocking", c.isBlocking());
        if (!canShow) {
            o.addProperty("faceDown", c.isFaceDown());
            return o;
        }
        describe(o, c.getCurrentState(), gv, true);
        o.addProperty("sick", c.isSick());
        o.addProperty("damage", c.getDamage());
        o.addProperty("token", c.isToken());
        o.addProperty("commander", c.isCommander());
        o.addProperty("faceDown", c.isFaceDown());
        if (c.hasAlternateState() && c.getAlternateState() != null) {
            final JsonObject back = new JsonObject();
            describe(back, c.getAlternateState(), gv, true);
            o.add("back", back);
        }
        final GameEntityView attachedTo = c.getEntityAttachedTo();
        if (attachedTo != null) {
            o.addProperty("attachedTo", attachedTo.getId());
            o.addProperty("attachedToPlayer", attachedTo instanceof PlayerView);
        }
        final JsonObject counters = counters(c.getCounters());
        if (counters.size() > 0) {
            o.add("counters", counters);
        }
        return o;
    }

    /** Caractéristiques visibles d'une face : nom, coût, type, texte, force et endurance. */
    static void describe(final JsonObject o, final CardStateView s, final GameView gv, final boolean inGame) {
        o.addProperty("name", translatedName(s));
        o.addProperty("oracleName", s.getName());
        final ManaCost cost = s.getManaCost();
        o.addProperty("cost", cost == null || cost.isNoCost() ? "" : cost.toString());
        o.addProperty("typeLine", CardDetailUtil.formatCardType(s, true));
        o.addProperty("text", inGame ? CardDetailUtil.composeCardText(s, gv, true) : "");
        o.addProperty("colors", colors(s.getColors()));
        o.addProperty("image", s.getImageKey());
        o.addProperty("set", s.getSetCode());
        o.addProperty("creature", s.isCreature());
        o.addProperty("land", s.isLand());
        o.addProperty("planeswalker", s.isPlaneswalker());
        o.addProperty("artifact", s.isArtifact());
        o.addProperty("enchantment", s.isEnchantment());
        o.addProperty("instant", s.isInstant());
        o.addProperty("sorcery", s.isSorcery());
        o.addProperty("battle", s.isBattle());
        if (s.isCreature()) {
            o.addProperty("power", s.getPower());
            o.addProperty("toughness", s.getToughness());
        }
        if (s.isPlaneswalker()) {
            o.addProperty("loyalty", s.getLoyalty());
        }
        if (s.isBattle()) {
            o.addProperty("defense", s.getDefense());
        }
    }

    static String translatedName(final CardStateView s) {
        final String translated = CardTranslation.getTranslatedName(s.getName());
        return translated == null || translated.isEmpty() ? s.getName() : translated;
    }

    static String colors(final ColorSet set) {
        if (set == null) {
            return "";
        }
        final StringBuilder sb = new StringBuilder();
        if (set.hasWhite()) sb.append('W');
        if (set.hasBlue()) sb.append('U');
        if (set.hasBlack()) sb.append('B');
        if (set.hasRed()) sb.append('R');
        if (set.hasGreen()) sb.append('G');
        return sb.toString();
    }

    private static JsonObject counters(final Multiset<CounterType> counters) {
        final JsonObject o = new JsonObject();
        if (counters == null) {
            return o;
        }
        for (final Multiset.Entry<CounterType> e : counters.entrySet()) {
            if (e.getCount() > 0) {
                o.addProperty(e.getElement().getName(), e.getCount());
            }
        }
        return o;
    }

    private JsonObject stackItem(final StackItemView item) {
        final JsonObject o = new JsonObject();
        o.addProperty("id", item.getId());
        o.addProperty("text", item.getText());
        o.addProperty("ability", item.isAbility());
        o.addProperty("trigger", item.isTrigger());
        o.addProperty("selectable", gui.isSelectable(item));
        if (item.getActivatingPlayer() != null) {
            o.addProperty("controller", item.getActivatingPlayer().getId());
        }
        if (item.getSourceCard() != null) {
            o.add("source", card(item.getSourceCard(), gui.getGameView()));
        }
        final JsonArray targetCards = new JsonArray();
        for (final CardView c : copy(item.getTargetCards())) {
            targetCards.add(c.getId());
        }
        o.add("targetCards", targetCards);
        final JsonArray targetPlayers = new JsonArray();
        for (final PlayerView p : copy(item.getTargetPlayers())) {
            targetPlayers.add(p.getId());
        }
        o.add("targetPlayers", targetPlayers);
        return o;
    }

    private static JsonArray combat(final CombatView combat) {
        final JsonArray list = new JsonArray();
        if (combat == null) {
            return list;
        }
        for (final CardView attacker : copy(combat.getAttackers())) {
            final JsonObject o = new JsonObject();
            o.addProperty("attacker", attacker.getId());
            final GameEntityView defender = combat.getDefender(attacker);
            if (defender != null) {
                o.addProperty("defender", defender.getId());
                o.addProperty("defenderIsPlayer", defender instanceof PlayerView);
            }
            final JsonArray blockers = new JsonArray();
            for (final CardView b : copy(combat.getBlockers(attacker))) {
                blockers.add(b.getId());
            }
            o.add("blockers", blockers);
            list.add(o);
        }
        return list;
    }

    private static JsonArray log(final GameView gv) {
        final JsonArray list = new JsonArray();
        if (gv.getGameLog() == null) {
            return list;
        }
        final List<GameLogEntry> entries = new ArrayList<>(gv.getGameLog().getLogEntries(null));
        // Forge range le journal du plus récent au plus ancien.
        for (int i = 0; i < Math.min(LOG_SIZE, entries.size()); i++) {
            final GameLogEntry e = entries.get(i);
            final JsonObject o = new JsonObject();
            o.addProperty("kind", e.type().name());
            o.addProperty("text", e.message());
            list.add(o);
        }
        return list;
    }

    private static <T> List<T> copy(final Iterable<T> items) {
        final List<T> list = new ArrayList<>();
        if (items != null) {
            for (final T item : items) {
                list.add(item);
            }
        }
        return list;
    }
}
