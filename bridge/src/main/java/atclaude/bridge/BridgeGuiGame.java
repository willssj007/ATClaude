package atclaude.bridge;

import com.google.gson.JsonObject;
import forge.LobbyPlayer;
import forge.deck.CardPool;
import forge.game.GameEntityView;
import forge.game.card.CardView;
import forge.game.event.GameEvent;
import forge.game.phase.PhaseType;
import forge.game.player.DelayedReveal;
import forge.game.player.IHasIcon;
import forge.game.player.PlayerView;
import forge.game.spellability.SpellAbilityView;
import forge.gamemodes.match.AbstractGuiGame;
import forge.gamemodes.match.Selection;
import forge.gamemodes.match.input.Input;
import forge.interfaces.IGameController;
import forge.item.PaperCard;
import forge.localinstance.skin.FSkinProp;
import forge.player.PlayerControllerHuman;
import forge.player.PlayerZoneUpdate;
import forge.trackable.TrackableCollection;
import forge.util.FSerializableFunction;
import forge.util.ITriggerEvent;
import forge.util.Localizer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Interface de partie vue par Forge. Chaque changement marque l'état comme modifié ; un fil dédié
 * envoie alors une photo complète de la partie à l'interface, au plus toutes les 40 ms.
 */
final class BridgeGuiGame extends AbstractGuiGame {

    private static volatile BridgeGuiGame current;

    static BridgeGuiGame current() {
        return current;
    }

    private final Bridge bridge;
    private final Dialogs dialogs;
    private final ScheduledExecutorService flusher = Executors.newSingleThreadScheduledExecutor(r -> {
        final Thread t = new Thread(r, "atclaude-state");
        t.setDaemon(true);
        return t;
    });
    private final AtomicBoolean flushScheduled = new AtomicBoolean();
    private volatile MatchSession session;

    // Invite affichée au joueur local : texte, carte concernée et deux boutons.
    private volatile String promptMessage = "";
    private volatile CardView promptCard;
    /** Ordre du dessus choisi dans la fenêtre de regard, rendu à Forge quand il le demande juste après. */
    private volatile List<Object> pendingTopOrder;
    private volatile String okLabel = "OK";
    private volatile String cancelLabel = "Annuler";
    private volatile boolean okEnabled;
    private volatile boolean cancelEnabled;
    private volatile boolean focusOk;

    BridgeGuiGame(final Bridge bridge) {
        this.bridge = bridge;
        this.dialogs = new Dialogs(bridge, () -> this);
    }

    /** Duel du mode Planeswalker (pas de menu de triche). */
    boolean career() {
        final MatchSession s = session;
        return s != null && s.isCareer();
    }

    void attach(final MatchSession session) {
        this.session = session;
        current = this;
    }

    void detach() {
        if (current == this) {
            current = null;
        }
        flusher.shutdownNow();
    }

    /** Le joueur local. Forge change de « joueur courant » quand on décide pour un adversaire contrôlé : pas nous. */
    private volatile PlayerView localPlayer;

    @Override
    public void setOriginalGameController(final PlayerView player, final IGameController gameController) {
        super.setOriginalGameController(player, gameController);
        localPlayer = player; // un seul joueur humain par partie
    }

    PlayerView localPlayer() {
        final PlayerView p = localPlayer;
        if (p != null && getGameView() != null) {
            // Vue à jour de la partie en cours (même identifiant).
            for (final PlayerView v : getGameView().getPlayers()) {
                if (v.getId() == p.getId()) {
                    return v;
                }
            }
        }
        return p != null ? p : getCurrentPlayer();
    }

    PlayerControllerHuman controller() {
        final IGameController c = getGameController();
        return c instanceof PlayerControllerHuman h ? h : null;
    }

    /** Nom de la saisie en cours (InputPassPriority, InputAttack, InputBlock…), ou "" si Forge n'attend rien. */
    String inputKind() {
        final PlayerControllerHuman c = controller();
        if (c == null) {
            return "";
        }
        final Input input = c.getInputQueue().getInput();
        if (input == null) {
            return "";
        }
        // Forge crée souvent des sous-classes anonymes : on remonte jusqu'à une classe nommée.
        Class<?> type = input.getClass();
        while (type.getSimpleName().isEmpty() && type.getSuperclass() != null) {
            type = type.getSuperclass();
        }
        return type.getSimpleName();
    }

    // ------------------------------------------------------------------ envoi de l'état

    void markDirty() {
        if (flushScheduled.compareAndSet(false, true)) {
            try {
                flusher.schedule(this::flush, 40, TimeUnit.MILLISECONDS);
            } catch (final RuntimeException e) {
                flushScheduled.set(false);
            }
        }
    }

    void flush() {
        flushScheduled.set(false);
        if (getGameView() == null) {
            return;
        }
        try {
            final JsonObject state = new GameSerializer(this).snapshot();
            state.add("prompt", prompt());
            final MatchSession s = session;
            if (s != null) {
                state.add("settings", s.settingsJson());
            }
            bridge.send(state);
            if (s != null) {
                s.afterStateSent();
            }
        } catch (final RuntimeException e) {
            // Une photo ratée sera remplacée par la suivante.
            e.printStackTrace();
            markDirty();
        }
    }

    private JsonObject prompt() {
        final JsonObject p = new JsonObject();
        p.addProperty("message", promptMessage);
        p.addProperty("input", inputKind());
        p.addProperty("okLabel", okLabel);
        p.addProperty("cancelLabel", cancelLabel);
        p.addProperty("okEnabled", okEnabled);
        p.addProperty("cancelEnabled", cancelEnabled);
        p.addProperty("focusOk", focusOk);
        final CardView pc = promptCard;
        if (pc != null) {
            p.addProperty("card", pc.getId());
            // La carte concernée peut être hors du plateau (regard du dessus de la bibliothèque) : on l'envoie.
            if (mayView(pc) && getGameView() != null) {
                p.add("cardInfo", new GameSerializer(this).card(pc, getGameView()));
            }
        }
        p.addProperty("selectMin", getSelectionMin());
        p.addProperty("selectMax", getSelectionMax());
        return p;
    }

    // ------------------------------------------------------------------ vue et invite

    @Override
    protected void updateCurrentPlayer(final PlayerView player) {
        markDirty();
    }

    @Override
    public void openView(final TrackableCollection<PlayerView> myPlayers) {
        setSelection(Selection.NONE);
        markDirty();
    }

    @Override
    public void showPromptMessage(final PlayerView playerView, final String message, final CardView card) {
        cancelAwaitNextInput();
        promptMessage = Texts.clean(French.prompt(message));
        promptCard = card;
        markDirty();
        final MatchSession s = session;
        if (s != null) {
            s.onPrompt(message);
        }
    }

    @Override
    public void showPromptMessageNoCancel(final PlayerView playerView, final String message) {
        promptMessage = Texts.clean(French.prompt(message));
        promptCard = null;
        markDirty();
    }

    @Override
    public void updateButtons(final PlayerView owner, final String label1, final String label2, final boolean enable1, final boolean enable2, final boolean focus1) {
        okLabel = label1;
        cancelLabel = label2;
        okEnabled = enable1;
        cancelEnabled = enable2;
        focusOk = focus1;
        markDirty();
    }

    @Override public void showCombat() { markDirty(); }
    @Override public void flashIncorrectAction() { bridge.sendEvent("incorrectAction", m -> { }); }
    @Override public void alertUser() { }
    @Override public void updatePhase(final boolean saveState) { markDirty(); }
    @Override public void updateTurn(final PlayerView player) { markDirty(); }
    @Override public void updatePlayerControl() { markDirty(); }
    @Override public void updateStack() { markDirty(); }
    @Override public void updateZones(final Iterable<PlayerZoneUpdate> zonesToUpdate) { markDirty(); }
    @Override public void updateCards(final Iterable<CardView> cards) { markDirty(); }
    @Override public void refreshCardDetails(final Iterable<CardView> cards) { markDirty(); }
    @Override public void refreshField() { markDirty(); }
    @Override public void updateManaPool(final Iterable<PlayerView> manaPoolUpdate) { markDirty(); }
    @Override public void updateLives(final Iterable<PlayerView> livesUpdate) { markDirty(); }
    @Override public void showManaPool(final PlayerView player) { markDirty(); }
    @Override public void hideManaPool(final PlayerView player) { markDirty(); }
    @Override public void updateRevealedCards(final TrackableCollection<CardView> collection) { markDirty(); }

    @Override
    public void setSelection(final Selection selection) {
        super.setSelection(selection);
        markDirty();
    }

    @Override
    public void setWeaklySelectable(final Iterable<CardView> cards) {
        super.setWeaklySelectable(cards);
        markDirty();
    }

    @Override
    public void clearWeaklySelectable() {
        super.clearWeaklySelectable();
        markDirty();
    }

    @Override
    public void handleGameEvent(final GameEvent event) {
        super.handleGameEvent(event);
        final MatchSession s = session;
        if (s != null) {
            s.onGameEvent(event);
        }
        markDirty();
    }

    @Override
    public void finishGame() {
        markDirty();
        final MatchSession s = session;
        if (s != null) {
            s.onGameFinished();
        }
    }

    @Override public void setPanelSelection(final CardView hostCard) { }
    @Override public void setCard(final CardView card) { }
    @Override public void setPlayerAvatar(final LobbyPlayer player, final IHasIcon ihi) { }

    @Override
    public boolean isUiSetToSkipPhase(final PlayerView playerTurn, final PhaseType phase) {
        final MatchSession s = session;
        return s != null && s.skipsPhase(playerTurn, phase);
    }

    // ------------------------------------------------------------------ dialogues

    @Override
    public SpellAbilityView getAbilityToPlay(final CardView hostCard, final List<SpellAbilityView> abilities, final ITriggerEvent triggerEvent) {
        if (abilities.isEmpty()) {
            return null;
        }
        if (abilities.size() == 1) {
            return abilities.get(0);
        }
        return dialogs.one("Choisir la capacité à jouer", abilities, null, true, "Annuler");
    }

    /** Le joueur a renoncé au sort en choisissant ses modes : le paiement qui suit est annulé (MatchSession). */
    private volatile boolean cancelCast;

    boolean takeCancelCast() {
        final boolean was = cancelCast;
        cancelCast = false;
        return was;
    }

    /**
     * Modes d'un sort qu'on lance (« Choisissez un — ») : on peut y renoncer. Forge ne sait pas annuler ici ; le sort
     * part sans mode vers le paiement, que l'on annule aussitôt, et la carte revient en main.
     */
    @Override
    public <T> T one(final String message, final List<T> choices, final FSerializableFunction<T, String> display) {
        if (choices != null && choices.size() > 1 && castingModes(choices)) {
            final T picked = dialogs.one(message, choices, display, true, "Annuler");
            cancelCast = picked == null;
            return picked;
        }
        return super.one(message, choices, display);
    }

    private static boolean castingModes(final List<?> choices) {
        for (final Object o : choices) {
            if (!(o instanceof SpellAbilityView sa) || sa.getHostCard() == null) {
                return false;
            }
            final forge.game.zone.ZoneType zone = sa.getHostCard().getZone();
            if (zone == null || zone == forge.game.zone.ZoneType.Battlefield || zone == forge.game.zone.ZoneType.Stack) {
                return false;
            }
        }
        return true;
    }

    @Override
    public Map<CardView, Integer> assignCombatDamage(final CardView attacker, final List<CardView> blockers, final int damage, final GameEntityView defender, final boolean overrideOrder, final boolean maySkip) {
        return dialogs.assignCombatDamage(attacker, blockers, damage, defender, maySkip);
    }

    @Override
    public Map<Object, Integer> assignGenericAmount(final CardView effectSource, final Map<Object, Integer> target, final int amount, final boolean atLeastOne, final String amountLabel) {
        return dialogs.assignGeneric("Répartir", target, amount, atLeastOne, amountLabel);
    }

    @Override public void message(final String message, final String title) { dialogs.message(title, message); }
    @Override public void showErrorDialog(final String message, final String title) { dialogs.message(title, message); }

    @Override
    public boolean showConfirmDialog(final String message, final String title, final String yesButtonText, final String noButtonText, final boolean defaultYes) {
        return dialogs.confirm(title, message, yesButtonText, noButtonText, defaultYes, null);
    }

    @Override
    public int showOptionDialog(final String message, final String title, final FSkinProp icon, final List<String> options, final int defaultOption) {
        return dialogs.option(title, message, options, defaultOption, null);
    }

    @Override
    public String showInputDialog(final String message, final String title, final FSkinProp icon, final String initialInput, final List<String> inputOptions, final boolean isNumeric) {
        return dialogs.input(title, message, initialInput, inputOptions, isNumeric);
    }

    @Override
    public boolean confirm(final CardView c, final String question, final boolean defaultIsYes, final List<String> options) {
        final List<String> labels = options == null || options.size() < 2 ? List.of("Oui", "Non") : options;
        return dialogs.option("", question, labels, defaultIsYes ? 0 : 1, c) == 0;
    }

    @Override
    public <T> List<T> getChoices(final String message, final int min, final int max, final List<T> choices, final List<T> selected, final FSerializableFunction<T, String> display) {
        return dialogs.choose(message, Math.max(0, min), max, choices, selected, display);
    }

    @Override
    public <T> void reveal(final String message, final List<T> items) {
        dialogs.reveal(message, items);
    }

    @Override
    public Integer getInteger(final String message, final int min, final int max, final boolean sortDesc) {
        if (max <= min) {
            return min;
        }
        return dialogs.integer(message, min, max);
    }

    @Override
    public Integer getInteger(final String message, final int min, final int max, final int cutoff) {
        if (max <= min) {
            return min;
        }
        return dialogs.integer(message, min, max);
    }

    @Override
    public <T> OrderResult<T> order(final String title, final String top, final int remainingObjectsMin, final int remainingObjectsMax, final List<T> sourceChoices, final List<T> destChoices, final CardView referenceCard, final boolean sideboardingMode, final boolean showRememberCheckbox) {
        final Localizer loc = Localizer.getInstance();
        // Regard et surveillance : Forge demande d'abord les cartes à déplacer, puis l'ordre de celles du dessus.
        // On pose les deux questions d'un coup, dans une fenêtre où l'on glisse les cartes d'une zone à l'autre.
        final boolean scry = title != null && title.equals(loc.getMessage("lblSelectCardsToBeOutOnTheBottomOfYourLibrary"));
        final boolean surveil = title != null && title.equals(loc.getMessage("lblSelectCardsToBePutIntoTheGraveyard"));
        if ((scry || surveil) && (destChoices == null || destChoices.isEmpty())) {
            final Dialogs.Arrangement<T> a = dialogs.arrange(scry ? "Regard" : "Surveillance", sourceChoices, surveil);
            pendingTopOrder = new ArrayList<>(a.top());
            return new OrderResult<>(a.moved(), false);
        }
        final List<Object> pending = pendingTopOrder;
        if (pending != null && title != null && title.equals(loc.getMessage("lblArrangeCardsToBePutOnTopOfYourLibrary"))
                && (destChoices == null || destChoices.isEmpty())
                && pending.size() == sourceChoices.size() && pending.containsAll(sourceChoices)) {
            pendingTopOrder = null;
            @SuppressWarnings("unchecked") final List<T> ordered = (List<T>) new ArrayList<>(pending);
            return new OrderResult<>(ordered, false);
        }
        pendingTopOrder = null;
        final Dialogs.Ordered<T> o = dialogs.order(title, top, remainingObjectsMin, remainingObjectsMax, sourceChoices, destChoices, showRememberCheckbox);
        return new OrderResult<>(o.order(), o.remember());
    }

    @Override
    public List<PaperCard> sideboard(final CardPool sideboard, final CardPool main, final String message) {
        // Pas de réserve entre les parties : le deck reste tel quel.
        return main.toFlatList();
    }

    @Override
    public GameEntityView chooseSingleEntityForEffect(final String title, final List<? extends GameEntityView> optionList, final DelayedReveal delayedReveal, final boolean isOptional) {
        // Recherche : une seule fenêtre avec les cartes valides, le reste de la zone repliable en dessous.
        final List<GameEntityView> picked = dialogs.choose(title, isOptional ? 0 : 1, 1, new ArrayList<GameEntityView>(optionList), null, null,
                revealed(delayedReveal), revealTitle(delayedReveal));
        return picked.isEmpty() ? null : picked.get(0);
    }

    @Override
    public List<GameEntityView> chooseEntitiesForEffect(final String title, final List<? extends GameEntityView> optionList, final int min, final int max, final DelayedReveal delayedReveal) {
        return dialogs.choose(title, Math.max(0, min), max, new ArrayList<GameEntityView>(optionList), null, null,
                revealed(delayedReveal), revealTitle(delayedReveal));
    }

    private static List<CardView> revealed(final DelayedReveal reveal) {
        return reveal == null || reveal.getCards() == null ? null : new ArrayList<>(reveal.getCards());
    }

    /** Titre du reste de la zone fouillée : « Reste de la bibliothèque ». */
    private static String revealTitle(final DelayedReveal reveal) {
        if (reveal == null) {
            return null;
        }
        final StringBuilder zones = new StringBuilder();
        if (reveal.getZone() != null) {
            for (final forge.game.zone.ZoneType z : reveal.getZone()) {
                zones.append(zones.length() > 0 ? ", " : "").append(z.getTranslatedName().toLowerCase());
            }
        }
        return zones.length() == 0 ? "Autres cartes" : "Reste : " + zones;
    }

    @Override
    public List<CardView> manipulateCardList(final String title, final Iterable<CardView> cards, final Iterable<CardView> manipulable, final boolean toTop, final boolean toBottom, final boolean toAnywhere) {
        final List<CardView> list = new ArrayList<>();
        cards.forEach(list::add);
        return dialogs.order(title, "", 0, 0, list, null);
    }
}
