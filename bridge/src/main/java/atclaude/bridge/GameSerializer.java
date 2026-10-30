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
import forge.game.keyword.Keyword;
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
    private static final int LOG_SIZE = 120;

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
                Thread.yield();
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
        final PlayerView me = gui.localPlayer();
        final PlayerView turn = gv.getPlayerTurn();
        final PhaseType phase = gv.getPhase();

        final JsonObject game = new JsonObject();
        game.addProperty("turn", gv.getTurn());
        game.addProperty("phase", phase == null ? "" : phase.name());
        game.addProperty("activePlayer", turn == null ? -1 : turn.getId());
        game.addProperty("commander", gv.isCommander());
        game.addProperty("career", gui.career());
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

    /** Le joueur de la partie derrière sa vue (null hors de la partie locale). */
    private static forge.game.player.Player gamePlayer(final GameView gv, final PlayerView p) {
        final forge.game.Game game = gv.getGame();
        if (game == null) {
            return null;
        }
        for (final forge.game.player.Player gp : game.getRegisteredPlayers()) {
            if (gp.getId() == p.getId()) {
                return gp;
            }
        }
        return null;
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
        // Tous les marqueurs du joueur (poison, énergie, expérience, radiation, tickets...) et ses mots-clés.
        o.add("counters", counters(p.getCounters()));
        final JsonArray keywords = new JsonArray();
        if (p.getKeywords() != null) {
            for (final forge.game.keyword.KeywordView k : copy(p.getKeywords().getValues())) {
                keywords.add(k.title());
            }
        }
        o.add("keywords", keywords);
        o.addProperty("lost", p.getHasLost());
        // Archenemy : son camp (0 : l'Archenemy, 1 : l'équipe), ses manigances encore cachées.
        final forge.game.player.Player gp = gamePlayer(gv, p);
        if (gp != null && gv.getGame().getRules().hasAppliedVariant(forge.game.GameType.Archenemy)) {
            o.addProperty("team", gp.getTeam());
            o.addProperty("archenemy", gp.getTeam() == 0);
            o.addProperty("schemeDeck", p.getZoneSize(ZoneType.SchemeDeck));
        }
        o.addProperty("priority", p.getHasPriority());
        o.addProperty("avatar", p.getAvatarIndex());
        o.addProperty("landsPlayed", p.getNumLandThisTurn());
        o.addProperty("maxLands", p.hasUnlimitedLandPlay() ? -1 : p.getMaxLandPlay());
        o.addProperty("selectable", gui.isSelectable(p));
        o.addProperty("highlighted", gui.isHighlighted(p));
        // Joueur dont le joueur local prend les décisions (triche « contrôler »).
        final PlayerView master = p.getMindSlaveMaster();
        o.addProperty("controlledByMe", master != null && me != null && master.getId() == me.getId() && p.getId() != me.getId());

        final JsonObject mana = new JsonObject();
        for (int i = 0; i < MANA_COLORS.length; i++) {
            mana.addProperty(MANA_LETTERS[i], p.getMana(MANA_COLORS[i]));
        }
        o.add("mana", mana);

        o.addProperty("library", p.getZoneSize(ZoneType.Library));
        // Dessus de la bibliothèque quand un effet permet de le regarder (Coursier de Kruphix, Futur aperçu...) :
        // les premières cartes visibles, dans l'ordre (la première est celle du dessus).
        final JsonArray top = new JsonArray();
        for (final CardView c : copy(p.getCards(ZoneType.Library))) {
            if (top.size() >= 3 || !gui.mayView(c)) {
                break;
            }
            top.add(card(c, gv));
        }
        o.add("libraryTop", top);
        o.addProperty("handSize", p.getZoneSize(ZoneType.Hand));
        final JsonObject zones = new JsonObject();
        for (final ZoneType zone : VISIBLE_ZONES) {
            final JsonArray cards = new JsonArray();
            for (final CardView c : copy(p.getCards(zone))) {
                if (zone != ZoneType.Command || !MatchSession.NO_COMMANDER_DAMAGE.equals(c.getName())) {
                    cards.add(card(c, gv));
                }
            }
            zones.add(zone.name().toLowerCase(), cards);
        }
        o.add("zones", zones);

        // Taxe de ses commandants (les blessures de commandant ne comptent pas : règle désactivée, MatchSession).
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
        Texts.remember(c);
        final boolean canShow = gui.mayView(c);
        flag(o, "hidden", !canShow);
        if (c.getController() != null) {
            o.addProperty("controller", c.getController().getId());
        }
        if (c.getOwner() != null) {
            o.addProperty("owner", c.getOwner().getId());
        }
        if (c.getZone() != null) {
            o.addProperty("zone", c.getZone().name().toLowerCase());
        }
        flag(o, "tapped", c.isTapped());
        flag(o, "selectable", gui.isSelectable(c));
        flag(o, "playable", gui.isWeaklySelectable(c));
        flag(o, "highlighted", gui.isHighlighted(c));
        flag(o, "attacking", c.isAttacking());
        flag(o, "blocking", c.isBlocking());
        if (!canShow) {
            flag(o, "faceDown", c.isFaceDown());
            return o;
        }
        describe(o, c.getCurrentState(), gv, true);
        flag(o, "sick", c.isSick());
        if (c.getDamage() != 0) {
            o.addProperty("damage", c.getDamage());
        }
        flag(o, "token", c.isToken());
        flag(o, "commander", c.isCommander());
        flag(o, "faceDown", c.isFaceDown());
        if (c.hasAlternateState() && c.getAlternateState() != null) {
            final JsonObject back = new JsonObject();
            describe(back, c.getAlternateState(), gv, true);
            o.add("back", back);
        }
        final GameEntityView attachedTo = c.getEntityAttachedTo();
        if (attachedTo != null) {
            o.addProperty("attachedTo", attachedTo.getId());
            flag(o, "attachedToPlayer", attachedTo instanceof PlayerView);
        }
        final JsonObject counters = counters(c.getCounters());
        if (counters.size() > 0) {
            o.add("counters", counters);
        }
        if (c.getZone() == ZoneType.Battlefield) {
            final JsonArray status = status(c);
            if (!status.isEmpty()) {
                o.add("status", status);
            }
        }
        return o;
    }

    /** Capacités et états montrés en petites icônes sur une carte en jeu (vol, initiative, hors phase...). */
    private static final Keyword[] SHOWN_KEYWORDS = {
        Keyword.FLYING, Keyword.FIRST_STRIKE, Keyword.DOUBLE_STRIKE, Keyword.DEATHTOUCH, Keyword.LIFELINK, Keyword.VIGILANCE,
        Keyword.TRAMPLE, Keyword.HASTE, Keyword.MENACE, Keyword.REACH, Keyword.DEFENDER, Keyword.HEXPROOF, Keyword.SHROUD,
        Keyword.INDESTRUCTIBLE, Keyword.INFECT,
    };

    private static JsonArray status(final CardView c) {
        final JsonArray a = new JsonArray();
        if (c.isPhasedOut()) {
            a.add("PHASED_OUT");
        }
        final CardStateView s = c.getCurrentState();
        if (s != null && s.isCreature()) {
            for (final Keyword k : SHOWN_KEYWORDS) {
                if (s.hasKeyword(k)) {
                    a.add(k.name());
                }
            }
        }
        if (s != null && s.hasWard()) {
            a.add("WARD");
        }
        if (c.isRingBearer()) {
            a.add("RING");
        }
        return a;
    }

    /** Caractéristiques visibles d'une face : nom, coût, type, texte, force et endurance. */
    static void describe(final JsonObject o, final CardStateView s, final GameView gv, final boolean inGame) {
        o.addProperty("name", translatedName(s));
        o.addProperty("oracleName", s.getName());
        final ManaCost cost = s.getManaCost();
        o.addProperty("cost", cost == null || cost.isNoCost() ? "" : cost.toString());
        o.addProperty("typeLine", CardDetailUtil.formatCardType(s, true));
        o.addProperty("text", inGame ? Texts.clean(plainText(CardDetailUtil.composeCardText(s, gv, true))) : "");
        o.addProperty("colors", colors(s.getColors()));
        o.addProperty("image", s.getImageKey());
        o.addProperty("set", s.getSetCode());
        flag(o, "creature", s.isCreature());
        flag(o, "land", s.isLand());
        flag(o, "planeswalker", s.isPlaneswalker());
        flag(o, "artifact", s.isArtifact());
        flag(o, "enchantment", s.isEnchantment());
        flag(o, "instant", s.isInstant());
        flag(o, "sorcery", s.isSorcery());
        flag(o, "battle", s.isBattle());
        flag(o, "scheme", s.getType() != null && s.getType().isScheme());
        flag(o, "ongoing", s.getType() != null && s.getType().hasSupertype(forge.card.CardType.Supertype.Ongoing));
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

    /**
     * Drapeau d'une carte, écrit seulement s'il est vrai : l'interface lit l'absence comme « faux ». Avec un plateau
     * chargé, les « false » répétés sur chaque carte faisaient plus de la moitié de chaque photo de la partie.
     */
    static void flag(final JsonObject o, final String key, final boolean value) {
        if (value) {
            o.addProperty(key, true);
        }
    }

    /** Forge met en forme le texte des cartes en HTML pour son interface Swing : on garde le texte brut. */
    static String plainText(final String html) {
        if (html == null) {
            return "";
        }
        return html.replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("<[^>]+>", "")
                .replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
                .replaceAll("\n{3,}", "\n\n")
                .trim();
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
        o.addProperty("text", French.stackText(gui.getGameView() == null ? null : gui.getGameView().getGame(), item));
        // Texte de Forge, avec les cibles nommées : montré dans le détail (appui long).
        o.addProperty("detail", Texts.clean(item.getText()));
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
            // Pendant la déclaration des bloqueurs, Forge les range d'abord dans la liste « prévue ».
            final JsonArray blockers = new JsonArray();
            final List<CardView> declared = copy(combat.getBlockers(attacker));
            for (final CardView b : declared.isEmpty() ? copy(combat.getPlannedBlockers(attacker)) : declared) {
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
        // Forge range le journal du plus récent au plus ancien. Les étapes (pioche, combat...) ne sont pas reprises :
        // la barre des phases les montre déjà, et elles noieraient les actions.
        for (int i = 0; i < entries.size() && list.size() < LOG_SIZE; i++) {
            final GameLogEntry e = entries.get(i);
            if (e.type() == forge.game.GameLogEntryType.PHASE) {
                continue;
            }
            Texts.remember(e.sourceCard());
            final JsonObject o = new JsonObject();
            o.addProperty("kind", e.type().name());
            final String text = Texts.clean(French.logLine(e.message()));
            o.addProperty("text", text);
            // La carte en cause, pour l'agrandir depuis le journal : seulement si le texte la nomme déjà
            // (une carte face cachée ou non révélée ne doit rien dévoiler de plus).
            final CardView src = e.sourceCard();
            if (src != null && !src.isFaceDown() && src.getCurrentState() != null) {
                final String nameFr = translatedName(src.getCurrentState());
                final String nameEn = src.getCurrentState().getName();
                if (text.contains(nameFr) || text.contains(nameEn)) {
                    final JsonObject c = new JsonObject();
                    c.addProperty("id", src.getId());
                    c.addProperty("name", nameFr);
                    c.addProperty("image", src.getCurrentState().getImageKey());
                    if (src.getController() != null) {
                        c.addProperty("controller", src.getController().getId());
                    }
                    o.add("card", c);
                }
            }
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
