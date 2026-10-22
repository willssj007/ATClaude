package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.LobbyPlayer;
import forge.deck.Deck;
import forge.game.Game;
import forge.game.GameOutcome;
import forge.game.GameType;
import forge.game.GameView;
import forge.game.ability.AbilityFactory;
import forge.game.ability.AbilityKey;
import forge.game.ability.AbilityUtils;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.event.GameEvent;
import forge.game.phase.PhaseType;
import forge.game.player.Player;
import forge.game.player.PlayerView;
import forge.game.player.RegisteredPlayer;
import forge.game.spellability.SpellAbility;
import forge.game.spellability.StackItemView;
import forge.game.zone.ZoneType;
import forge.gamemodes.match.HostedMatch;
import forge.gamemodes.match.input.Input;
import forge.gamemodes.match.input.InputPassPriority;
import forge.gui.GuiBase;
import forge.interfaces.IDevModeCheats;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.player.GamePlayerUtil;
import forge.player.PlayerControllerHuman;
import forge.util.ITriggerEvent;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Une partie en cours : le joueur local contre 1 à 3 IA.
 * Transmet les clics de l'interface au contrôleur humain de Forge, applique les réglages
 * de priorité et exécute le menu de triche.
 */
final class MatchSession {

    /** Clic gauche, sans position : Forge ne s'en sert que pour distinguer le clic droit. */
    private static final ITriggerEvent CLICK = new ITriggerEvent() {
        @Override public int getButton() { return 1; }
        @Override public int getX() { return 0; }
        @Override public int getY() { return 0; }
    };

    private static final Set<PhaseType> DEFAULT_MY_STOPS = EnumSet.of(
            PhaseType.MAIN1, PhaseType.COMBAT_DECLARE_BLOCKERS, PhaseType.MAIN2);
    private static final Set<PhaseType> DEFAULT_THEIR_STOPS = EnumSet.of(
            PhaseType.COMBAT_DECLARE_ATTACKERS, PhaseType.END_OF_TURN);

    private final Bridge bridge;
    private final BridgeGuiGame gui;
    private final HostedMatch match;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-autopass");
        t.setDaemon(true);
        return t;
    });

    private volatile boolean holdPriority;
    private volatile boolean autoPassNoActions = true;
    private final Set<PhaseType> myStops = ConcurrentHashMap.newKeySet();
    private final Set<PhaseType> theirStops = ConcurrentHashMap.newKeySet();
    private final Set<Integer> seenStackItems = ConcurrentHashMap.newKeySet();
    private volatile boolean closed;

    private JsonObject setup;
    /** Le salon avec les decks complets, gardé dans la sauvegarde. */
    private JsonObject savedSetup;
    private final String sessionId = java.util.UUID.randomUUID().toString();
    /** Reprise en cours : les questions d'avant la partie (jouer ou piocher, mulligan) sont répondues d'office. */
    private volatile boolean resumePending;
    private volatile String lastSaveKey = "";
    private static final Set<PhaseType> SAVE_PHASES = EnumSet.of(PhaseType.UPKEEP, PhaseType.DRAW, PhaseType.MAIN1, PhaseType.MAIN2, PhaseType.END_OF_TURN);

    private MatchSession(final Bridge bridge, final BridgeGuiGame gui, final HostedMatch match) {
        this.bridge = bridge;
        this.gui = gui;
        this.match = match;
        myStops.addAll(DEFAULT_MY_STOPS);
        theirStops.addAll(DEFAULT_THEIR_STOPS);
    }

    static MatchSession start(final Bridge bridge, final Catalog catalog, final JsonObject setup) {
        return start(bridge, catalog, setup, null);
    }

    /** Reprend une partie sauvegardée : mêmes joueurs et decks, puis l'état de la partie au début du premier tour. */
    static MatchSession resume(final Bridge bridge, final Catalog catalog, final JsonObject save) {
        return start(bridge, catalog, save.getAsJsonObject("setup"), save);
    }

    private static MatchSession start(final Bridge bridge, final Catalog catalog, final JsonObject setup, final JsonObject save) {
        if (!ForgeRuntime.isReady()) {
            throw new IllegalStateException("Forge est encore en cours de chargement.");
        }
        final boolean commander = !"constructed".equals(str(setup, "format"));
        final GameType type = commander ? GameType.Commander : GameType.Constructed;
        final JsonArray seats = setup.getAsJsonArray("players");
        if (seats == null || seats.size() < 2 || seats.size() > 4) {
            throw new IllegalArgumentException("Une partie se joue à 2, 3 ou 4 joueurs.");
        }
        final List<RegisteredPlayer> players = new ArrayList<>();
        RegisteredPlayer human = null;
        int aiIndex = 0;
        // Le salon tel quel, avec chaque deck écrit en entier : la sauvegarde ne dépend plus des decks enregistrés.
        final JsonObject resolved = setup.deepCopy();
        final JsonArray resolvedSeats = new JsonArray();
        for (final JsonElement e : seats) {
            final JsonObject seat = e.getAsJsonObject();
            final Deck deck = deckFor(catalog, seat);
            final JsonObject rs = seat.deepCopy();
            rs.add("deck", Catalog.deckJson(deck, commander ? "commander" : "constructed"));
            resolvedSeats.add(rs);
            final RegisteredPlayer rp = commander ? RegisteredPlayer.forCommander(deck) : new RegisteredPlayer(deck);
            final boolean ai = seat.has("ai") && seat.get("ai").getAsBoolean();
            final String name = str(seat, "name").isEmpty() ? (ai ? "IA " + (aiIndex + 1) : "Moi") : str(seat, "name");
            final LobbyPlayer lobby;
            if (ai) {
                aiIndex++;
                final String profile = str(seat, "profile");
                lobby = profile.isEmpty() ? GamePlayerUtil.createAiPlayer(name, aiIndex)
                        : GamePlayerUtil.createAiPlayer(name, aiIndex, profile);
            } else {
                if (human != null) {
                    throw new IllegalArgumentException("Un seul joueur humain par partie.");
                }
                lobby = GamePlayerUtil.getGuiPlayer(name, 0, 0, false);
                human = rp;
            }
            rp.setPlayer(lobby);
            players.add(rp);
        }
        if (human == null) {
            throw new IllegalArgumentException("Il faut un joueur humain.");
        }

        resolved.add("players", resolvedSeats);

        Texts.reset();
        final BridgeGuiGame gui = new BridgeGuiGame(bridge);
        final HostedMatch match = GuiBase.getInterface().hostMatch();
        final MatchSession session = new MatchSession(bridge, gui, match);
        session.setup = setup;
        session.savedSetup = resolved;
        if (save != null) {
            // Début du premier tour (après les mulligans, acceptés d'office) : on remet l'état sauvegardé.
            session.resumePending = true;
            match.setStartGameHook(() -> {
                try {
                    SaveGame.apply(match.getGame(), save);
                } catch (final RuntimeException ex) {
                    ex.printStackTrace();
                    bridge.sendEvent("error", m -> m.addProperty("message", "La partie sauvegardée n'a pas pu être reprise entièrement : " + ex.getMessage()));
                }
                session.resumePending = false;
                bridge.sendEvent("resumed", m -> { });
                gui.markDirty();
            });
        }
        gui.attach(session);
        match.setOnMatchOver(() -> bridge.sendEvent("matchOver", m -> { }));
        final Set<GameType> variants = commander ? EnumSet.of(GameType.Commander) : null;
        match.startMatch(type, variants, players, human, gui);
        session.applyYieldPrefs();
        return session;
    }

    private static Deck deckFor(final Catalog catalog, final JsonObject seat) {
        if (seat.has("deck") && seat.get("deck").isJsonObject()) {
            final List<String> unknown = new ArrayList<>();
            final Deck deck = catalog.deckFromJson(seat.getAsJsonObject("deck"), unknown);
            if (!unknown.isEmpty()) {
                throw new IllegalArgumentException("Cartes inconnues : " + String.join(", ", unknown));
            }
            return deck;
        }
        final String key = str(seat, "deckKey");
        return catalog.deckFromKey(key.isEmpty() ? "random" : key);
    }

    /** Pour une revanche : le même salon, avec les mêmes decks. */
    JsonObject setup() {
        return setup;
    }

    void close() {
        closed = true;
        timer.shutdownNow();
        // Partie quittée pour une autre : sa sauvegarde ne sert plus.
        SaveGame.delete(sessionId);
        try {
            final PlayerControllerHuman c = gui.controller();
            if (c != null && gui.getGameView() != null) {
                if (gui.getGameView().isGameOver()) {
                    // Partie finie : Forge attend de savoir s'il faut en lancer une autre.
                    c.nextGameDecision(forge.gamemodes.match.NextGameDecision.QUIT);
                } else {
                    c.concede();
                }
            }
        } catch (final RuntimeException e) {
            e.printStackTrace();
        }
        gui.detach();
    }

    void requestFullState() {
        gui.markDirty();
    }

    // ------------------------------------------------------------------ actions de l'interface

    JsonElement handle(final String type, final JsonObject m) {
        final PlayerControllerHuman c = gui.controller();
        switch (type) {
            case "ok" -> c.selectButtonOk();
            case "cancel" -> c.selectButtonCancel();
            case "card" -> {
                final CardView card = findCard(m.get("id").getAsInt());
                if (card != null && !c.selectCard(card, null, CLICK)) {
                    gui.flashIncorrectAction();
                }
            }
            case "player" -> {
                final PlayerView p = findPlayer(m.get("id").getAsInt());
                if (p != null) {
                    c.selectPlayer(p, CLICK);
                }
            }
            case "stackItem" -> {
                final StackItemView item = findStackItem(m.get("id").getAsInt());
                if (item != null) {
                    c.selectStackItem(item);
                }
            }
            case "useMana" -> c.useMana(colorByte(m.get("color").getAsString()));
            case "passTurn" -> c.autoPassUntilEndOfTurn();
            case "cancelPass" -> c.autoPassCancel();
            case "alphaStrike" -> c.alphaStrike();
            case "undo" -> c.undoLastAction();
            case "concede" -> c.concede();
            case "settings" -> updateSettings(m.getAsJsonObject("settings"));
            case "cheat" -> cheat(c, m);
            case "state" -> gui.markDirty();
            default -> throw new IllegalArgumentException("Action inconnue : " + type);
        }
        return null;
    }

    private CardView findCard(final int id) {
        final Game game = game();
        final Card card = game == null ? null : game.findById(id);
        return card == null ? null : card.getView();
    }

    private PlayerView findPlayer(final int id) {
        final GameView gv = gui.getGameView();
        if (gv == null) {
            return null;
        }
        for (final PlayerView p : gv.getPlayers()) {
            if (p.getId() == id) {
                return p;
            }
        }
        return null;
    }

    private StackItemView findStackItem(final int id) {
        final GameView gv = gui.getGameView();
        if (gv == null) {
            return null;
        }
        for (final StackItemView item : gv.getStack()) {
            if (item.getId() == id) {
                return item;
            }
        }
        return null;
    }

    private Game game() {
        final GameView gv = gui.getGameView();
        return gv == null ? null : gv.getGame();
    }

    private Player player(final JsonObject m) {
        final Game game = game();
        if (game == null) {
            throw new IllegalStateException("Aucune partie.");
        }
        if (m.has("player")) {
            final PlayerView pv = findPlayer(m.get("player").getAsInt());
            if (pv != null) {
                return game.getPlayer(pv);
            }
        }
        return game.getPlayer(gui.getCurrentPlayer());
    }

    private static byte colorByte(final String letter) {
        return switch (letter) {
            case "W" -> forge.card.MagicColor.WHITE;
            case "U" -> forge.card.MagicColor.BLUE;
            case "B" -> forge.card.MagicColor.BLACK;
            case "R" -> forge.card.MagicColor.RED;
            case "G" -> forge.card.MagicColor.GREEN;
            default -> forge.card.MagicColor.COLORLESS;
        };
    }

    // ------------------------------------------------------------------ priorité et arrêts

    boolean skipsPhase(final PlayerView turnPlayer, final PhaseType phase) {
        final PlayerView me = gui.getCurrentPlayer();
        final boolean mine = me != null && turnPlayer != null && me.getId() == turnPlayer.getId();
        return !(mine ? myStops : theirStops).contains(phase);
    }

    /** Forge lit ces réglages dans ses préférences globales ; le contrôleur est ensuite prévenu du changement. */
    private void applyYieldPrefs() {
        final forge.localinstance.properties.ForgePreferences prefs = forge.model.FModel.getPreferences();
        prefs.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS, String.valueOf(autoPassNoActions));
        prefs.setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS, "true");
        final PlayerControllerHuman c = gui.controller();
        if (c != null) {
            c.setYieldPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS, String.valueOf(autoPassNoActions));
        }
    }

    private void updateSettings(final JsonObject s) {
        if (s == null) {
            return;
        }
        if (s.has("holdPriority")) {
            holdPriority = s.get("holdPriority").getAsBoolean();
        }
        if (s.has("autoPass")) {
            autoPassNoActions = s.get("autoPass").getAsBoolean();
        }
        if (s.has("myStops")) {
            myStops.clear();
            myStops.addAll(phases(s.getAsJsonArray("myStops")));
        }
        if (s.has("theirStops")) {
            theirStops.clear();
            theirStops.addAll(phases(s.getAsJsonArray("theirStops")));
        }
        applyYieldPrefs();
        gui.markDirty();
    }

    private static List<PhaseType> phases(final JsonArray list) {
        final List<PhaseType> result = new ArrayList<>();
        for (final JsonElement e : list) {
            try {
                result.add(PhaseType.valueOf(e.getAsString()));
            } catch (final IllegalArgumentException ignored) {
                // phase inconnue : ignorée
            }
        }
        return result;
    }

    JsonObject settingsJson() {
        final JsonObject o = new JsonObject();
        o.addProperty("holdPriority", holdPriority);
        o.addProperty("autoPass", autoPassNoActions);
        final JsonArray mine = new JsonArray();
        myStops.forEach(p -> mine.add(p.name()));
        o.add("myStops", mine);
        final JsonArray theirs = new JsonArray();
        theirStops.forEach(p -> theirs.add(p.name()));
        o.add("theirStops", theirs);
        return o;
    }

    /**
     * Appelé à chaque nouvelle invite. Sans « garder la priorité », un sort ou une capacité que l'on
     * vient de mettre sur la pile est résolu sans s'arrêter, comme sur Arena : on passe la priorité.
     */
    void onPrompt() {
        if (closed) {
            return;
        }
        final PlayerControllerHuman c = gui.controller();
        final GameView gv = gui.getGameView();
        if (c == null || gv == null) {
            return;
        }
        final Input input = c.getInputQueue().getInput();
        if (resumePending) {
            answerBeforeResume(c, input);
            return;
        }
        if (input instanceof InputPassPriority) {
            maybeSave(c, input);
        }
        if (holdPriority || !(input instanceof InputPassPriority)) {
            return;
        }
        final StackItemView top = gv.peekStack();
        final PlayerView me = gui.getCurrentPlayer();
        if (top == null || me == null || top.getActivatingPlayer() == null
                || top.getActivatingPlayer().getId() != me.getId() || !seenStackItems.add(top.getId())) {
            return;
        }
        timer.schedule(() -> bridge.runOnEdt(() -> {
            if (!closed && c.getInputQueue().getInput() == input) {
                c.selectButtonOk();
            }
        }), 350, TimeUnit.MILLISECONDS);
    }

    /** Avant de reprendre une partie : on joue, on garde sa main, on se choisit pour commencer. */
    private void answerBeforeResume(final PlayerControllerHuman c, final Input input) {
        if (input == null) {
            return;
        }
        timer.schedule(() -> bridge.runOnEdt(() -> {
            if (closed || !resumePending || c.getInputQueue().getInput() != input) {
                return;
            }
            if (input instanceof forge.gamemodes.match.input.InputSelectEntitiesFromList && gui.getCurrentPlayer() != null) {
                c.selectPlayer(gui.getCurrentPlayer(), CLICK);
            }
            c.selectButtonOk();
        }), 120, TimeUnit.MILLISECONDS);
    }

    /** Sauvegarde aux moments calmes : le joueur a la priorité, la pile est vide, hors combat. Une fois par phase. */
    private void maybeSave(final PlayerControllerHuman c, final Input input) {
        final Game game = game();
        if (game == null || game.isGameOver() || !game.getStack().isEmpty()) {
            return;
        }
        final PhaseType phase = game.getPhaseHandler().getPhase();
        if (phase == null || !SAVE_PHASES.contains(phase) || game.getPhaseHandler().getPlayerTurn() == null) {
            return;
        }
        // Même phase, mais la partie a changé (sort résolu, terrain joué...) : on sauvegarde de nouveau.
        final StringBuilder key0 = new StringBuilder();
        key0.append(game.getPhaseHandler().getTurn()).append(':').append(phase).append(':').append(game.getPhaseHandler().getPlayerTurn().getId());
        for (final Player p : game.getPlayers()) {
            key0.append('|').append(p.getLife()).append(',').append(p.getZone(ZoneType.Hand).size()).append(',')
                    .append(p.getZone(ZoneType.Battlefield).size()).append(',').append(p.getZone(ZoneType.Graveyard).size()).append(',')
                    .append(p.getZone(ZoneType.Library).size()).append(',').append(p.getTotalCommanderCast()).append(',')
                    .append(p.getCardsIn(ZoneType.Battlefield).stream().filter(Card::isTapped).count());
        }
        final String key = key0.toString();
        if (key.equals(lastSaveKey)) {
            return;
        }
        lastSaveKey = key;
        timer.schedule(() -> {
            // Le fil de partie attend toujours la même décision : l'état ne bouge pas pendant la photo.
            if (closed || c.getInputQueue().getInput() != input) {
                lastSaveKey = "";
                return;
            }
            try {
                SaveGame.write(SaveGame.capture(game, savedSetup, sessionId));
            } catch (final RuntimeException e) {
                lastSaveKey = "";
                System.err.println("Sauvegarde ratée : " + e);
            }
        }, 250, TimeUnit.MILLISECONDS);
    }

    /** Après chaque photo envoyée à l'interface : la partie a pu changer sans nouvelle invite (triche, sort résolu). */
    void afterStateSent() {
        if (closed || resumePending) {
            return;
        }
        final PlayerControllerHuman c = gui.controller();
        if (c == null) {
            return;
        }
        final Input input = c.getInputQueue().getInput();
        if (input instanceof InputPassPriority) {
            try {
                maybeSave(c, input);
            } catch (final RuntimeException e) {
                // Zones modifiées pendant la lecture : on réessaiera à la prochaine photo.
                lastSaveKey = "";
            }
        }
    }

    void onGameEvent(final GameEvent event) { }

    void onGameFinished() {
        // Partie terminée : rien à reprendre.
        SaveGame.delete(sessionId);
        if (closed) {
            return; // partie abandonnée pour en lancer une autre : l'écran de fin n'a pas lieu d'être
        }
        bridge.sendEvent("gameOver", m -> {
            final GameView gv = gui.getGameView();
            final GameOutcome outcome = gv == null ? null : gv.getOutcome();
            m.addProperty("winner", outcome == null || outcome.isDraw() || outcome.getWinningLobbyPlayer() == null
                    ? "" : outcome.getWinningLobbyPlayer().getName());
            m.addProperty("draw", outcome != null && outcome.isDraw());
            m.addProperty("reason", outcome == null || outcome.getWinCondition() == null ? "" : outcome.getWinCondition().name());
            m.addProperty("turns", outcome == null ? 0 : outcome.getLastTurnNumber());
            final JsonArray lines = new JsonArray();
            if (outcome != null) {
                outcome.getOutcomeStrings().forEach(lines::add);
            }
            m.add("details", lines);
        });
    }

    // ------------------------------------------------------------------ triche

    private void cheat(final PlayerControllerHuman c, final JsonObject m) {
        final String op = str(m, "op");
        final IDevModeCheats dev = c.cheat();
        final Game game = game();
        switch (op) {
            case "mana" -> {
                final Player p = player(m);
                final String mana = str(m, "mana").toUpperCase();
                final StringBuilder produced = new StringBuilder();
                for (final char ch : mana.toCharArray()) {
                    if ("WUBRGC".indexOf(ch) >= 0) {
                        produced.append(produced.length() == 0 ? "" : " ").append(ch);
                    }
                }
                if (produced.length() == 0) {
                    throw new IllegalArgumentException("Aucun mana demandé.");
                }
                runScript(game, p, "DB$ Mana | Produced$ " + produced);
            }
            case "addCard" -> {
                final Player p = player(m);
                final PaperCard pc = bridge.catalog().resolve(str(m, "name"));
                if (pc == null) {
                    throw new IllegalArgumentException("Carte inconnue : " + str(m, "name"));
                }
                final ZoneType zone = zone(str(m, "zone"));
                final int count = m.has("count") ? Math.max(1, Math.min(20, m.get("count").getAsInt())) : 1;
                inGame(game, () -> {
                    for (int i = 0; i < count; i++) {
                        final Card card = Card.fromPaperCard(pc, p);
                        card.setGameTimestamp(game.getNextTimestamp());
                        switch (zone) {
                            case Hand -> game.getAction().moveToHand(card, null);
                            case Library -> game.getAction().moveToLibrary(card, 0, null);
                            case Graveyard -> game.getAction().moveToGraveyard(card, null);
                            case Exile -> game.getAction().exile(card, null, null);
                            default -> {
                                game.getAction().moveTo(ZoneType.Battlefield, card, null, AbilityKey.newMap());
                                card.setSickness(false);
                            }
                        }
                    }
                });
            }
            case "draw" -> {
                final Player p = player(m);
                final int count = m.has("count") ? Math.max(1, Math.min(50, m.get("count").getAsInt())) : 1;
                inGame(game, () -> p.drawCards(count));
            }
            case "life" -> {
                final Player p = player(m);
                final int value = m.has("value") ? m.get("value").getAsInt() : p.getLife() + m.get("delta").getAsInt();
                inGame(game, () -> p.setLife(Math.max(0, value), null));
            }
            case "skipTurn" -> {
                final Player p = player(m);
                runScript(game, p, "DB$ SkipTurn | Defined$ You | NumTurns$ 1");
                bridge.sendEvent("notice", n -> {
                    n.addProperty("title", "Triche");
                    n.addProperty("message", p.getName() + " passera son prochain tour.");
                });
            }
            case "endTurn" -> runScript(game, player(m), "DB$ EndTurn");
            case "untapAll" -> {
                final Player p = player(m);
                inGame(game, () -> {
                    for (final Card card : p.getCardsIn(ZoneType.Battlefield)) {
                        card.untap();
                    }
                });
            }
            case "viewAll" -> dev.setViewAllCards(m.get("value").getAsBoolean());
            case "unlimitedLands" -> dev.setCanPlayUnlimitedLands(m.get("value").getAsBoolean());
            case "tutor" -> dev.tutorForCard();
            case "addCounters" -> dev.addCountersToPermanent();
            case "removeCounters" -> dev.removeCountersFromPermanent();
            case "addToken" -> dev.addTokenToBattlefield();
            case "tapPermanents" -> dev.tapPermanents();
            case "untapPermanents" -> dev.untapPermanents();
            case "win" -> dev.winGame();
            default -> throw new IllegalArgumentException("Triche inconnue : " + op);
        }
        gui.markDirty();
    }

    private static ZoneType zone(final String name) {
        return switch (name) {
            case "battlefield" -> ZoneType.Battlefield;
            case "library" -> ZoneType.Library;
            case "graveyard" -> ZoneType.Graveyard;
            case "exile" -> ZoneType.Exile;
            default -> ZoneType.Hand;
        };
    }

    /** Résout une capacité écrite dans le langage de script de Forge, comme si {@code player} l'activait. */
    private void runScript(final Game game, final Player player, final String script) {
        inGame(game, () -> {
            final Card host = new Card(game.nextCardId(), game);
            host.setOwner(player);
            host.setName("Triche");
            final SpellAbility sa = AbilityFactory.getAbility(script, host);
            sa.setActivatingPlayer(player);
            AbilityUtils.resolve(sa);
        });
    }

    /**
     * Applique un changement sur un fil de partie et attend qu'il soit fini. Le fil principal de la
     * partie doit être en attente du joueur (priorité ou choix) : sinon les deux fils modifieraient
     * la partie en même temps.
     */
    private void inGame(final Game game, final Runnable change) {
        if (game == null) {
            throw new IllegalStateException("Aucune partie.");
        }
        final PlayerControllerHuman c = gui.controller();
        if (c == null || c.getInputQueue().getInput() == null) {
            throw new IllegalStateException("Attends d'avoir la main (priorité ou choix) pour tricher.");
        }
        final java.util.concurrent.CountDownLatch done = new java.util.concurrent.CountDownLatch(1);
        game.getAction().invoke(() -> {
            try {
                change.run();
            } catch (final RuntimeException e) {
                bridge.reportError(e);
            } finally {
                done.countDown();
            }
            gui.markDirty();
        });
        try {
            done.await(10, TimeUnit.SECONDS);
        } catch (final InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static String str(final JsonObject o, final String key) {
        return o != null && o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : "";
    }
}
