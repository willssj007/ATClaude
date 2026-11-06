package atclaude.bridge;

import forge.game.Game;
import forge.game.ability.ApiType;
import forge.game.card.Card;
import forge.game.card.CardCollection;
import forge.game.card.CardCollectionView;
import forge.game.card.CardLists;
import forge.game.keyword.Keyword;
import forge.game.player.Player;
import forge.game.player.PlayerActionConfirmMode;
import forge.game.spellability.SpellAbility;
import forge.game.undo.UndoManager;
import forge.game.zone.ZoneType;
import forge.player.LobbyPlayerHuman;
import forge.player.PlayerControllerHuman;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Contrôleur du joueur humain (et du joueur qu'il contrôle par la triche) :
 *  - mulligans gratuits de la règle maison (voir {@link Mulligans}) ;
 *  - un sort ou une capacité annulé en cours de lancement remet la partie exactement comme avant (règle 727 : une
 *    action illégale ou annulée est défaite entièrement). Forge rend le mana et redresse ce qui avait été engagé,
 *    mais pas ce qui ne se rembourse pas : points de vie payés (« Payer N points de vie », capacité de mana payée en
 *    vie pendant le paiement, qui reste alors engagée avec son mana dans la réserve), cartes sacrifiées ou défaussées.
 *    Si quelque chose a changé, la partie revient à l'instantané pris par Forge à cette priorité (le même que
 *    « Défaire ») ; s'il n'y en a pas (« Défaire » désactivé, hasard utilisé), au moins les points de vie reviennent ;
 *  - « Partenariat avec » (« un joueur ciblé peut chercher [le partenaire] dans sa bibliothèque ») : le joueur est
 *    choisi sans question (celui dont la bibliothèque contient le partenaire, soi-même d'abord), et sans partenaire
 *    dans la bibliothèque (déjà en jeu, en main…), plus de proposition de fouiller pour rien.
 */
final class HumanController extends PlayerControllerHuman {

    private final int free;
    private int taken;

    HumanController(final Game game, final Player player, final LobbyPlayerHuman lobby, final int free) {
        super(game, player, lobby);
        this.free = free;
    }

    /** Joueur contrôlé par un autre (triche « contrôler ») : pas de mulligan à gérer. */
    HumanController(final Player slave, final LobbyPlayerHuman lobby, final PlayerControllerHuman master) {
        super(slave, lobby, master);
        this.free = Mulligans.FORGE_DEFAULT;
    }

    @Override
    public boolean mulliganKeepHand(final Player first, final int cardsToReturn) {
        if (free == Mulligans.FORGE_DEFAULT) {
            return super.mulliganKeepHand(first, cardsToReturn);
        }
        while (true) {
            final boolean keep = super.mulliganKeepHand(first, Mulligans.toReturn(taken, free));
            if (keep) {
                return true;
            }
            taken++;
            if (free != Mulligans.UNLIMITED) {
                return false;
            }
            Mulligans.redraw(getPlayer());
            if (getGame().isGameOver()) {
                return true;
            }
        }
    }

    @Override
    public CardCollectionView tuckCardsViaMulligan(final CardCollectionView hand, final int cardsToReturn) {
        if (free == Mulligans.FORGE_DEFAULT) {
            return super.tuckCardsViaMulligan(hand, cardsToReturn);
        }
        final int n = Mulligans.toReturn(taken, free);
        return n <= 0 ? new CardCollection() : super.tuckCardsViaMulligan(hand, n);
    }

    @Override
    public boolean playChosenSpellAbility(final SpellAbility sa) {
        final Player p = getPlayer();
        final int life = p.getLife();
        final int lostThisTurn = p.getLifeLostThisTurn();
        final String before = fingerprint(p);
        final boolean played = super.playChosenSpellAbility(sa);
        if (!played && !getGame().isGameOver() && !before.equals(fingerprint(p)) && !rewind() && p.getLife() < life) {
            restoreLife(p, life, lostThisTurn);
        }
        return played;
    }

    @Override
    public boolean chooseTargetsFor(final SpellAbility sa) {
        if (isPartnerWith(sa)) {
            final Player me = getPlayer();
            final List<Player> order = new ArrayList<>();
            order.add(me);
            for (final Player p : getGame().getPlayers()) {
                if (p != me) {
                    order.add(p);
                }
            }
            Player pick = null;
            for (final Player p : order) {
                if (sa.canTarget(p) && !partnersIn(sa, p).isEmpty()) {
                    pick = p;
                    break;
                }
            }
            if (pick == null && sa.canTarget(me)) {
                pick = me;
            }
            if (pick != null) {
                sa.resetTargets();
                sa.getTargets().add(pick);
                return true;
            }
        }
        return super.chooseTargetsFor(sa);
    }

    @Override
    public boolean confirmAction(final SpellAbility sa, final PlayerActionConfirmMode mode, final String message, final List<String> options,
                                 final Card cardToShow, final Map<String, Object> params) {
        // Fouiller sa bibliothèque pour un partenaire qui n'y est pas : non, sans le demander.
        if (mode == PlayerActionConfirmMode.ChangeZoneGeneral && isPartnerWith(sa) && partnersIn(sa, getPlayer()).isEmpty()) {
            return false;
        }
        return super.confirmAction(sa, mode, message, options, cardToShow, params);
    }

    /** La capacité du mot-clé « Partenariat avec » (Forge : chercher la carte nommée dans la bibliothèque du joueur ciblé). */
    private static boolean isPartnerWith(final SpellAbility sa) {
        if (sa == null || sa.getApi() != ApiType.ChangeZone || !String.valueOf(sa.getParam("ChangeType")).startsWith("Card.named")) {
            return false;
        }
        final SpellAbility root = sa.getRootAbility();
        return sa.isKeyword(Keyword.PARTNER_WITH) || root.isKeyword(Keyword.PARTNER_WITH)
            || (root.getTrigger() != null && root.getTrigger().isKeyword(Keyword.PARTNER_WITH));
    }

    /** Les cartes de la bibliothèque du joueur que la capacité peut aller chercher. */
    private static CardCollectionView partnersIn(final SpellAbility sa, final Player p) {
        return CardLists.getValidCards(p.getCardsIn(ZoneType.Library), sa.getParam("ChangeType"), sa.getActivatingPlayer(), sa.getHostCard(), sa);
    }

    /** Ce qu'un lancement annulé ne doit pas changer : vie, réserve, cartes et leur engagement, marqueurs. */
    private static String fingerprint(final Player p) {
        final StringBuilder sb = new StringBuilder();
        sb.append(p.getLife()).append('/').append(p.getManaPool().totalMana()).append('/').append(p.getCounters());
        for (final ZoneType z : new ZoneType[] {ZoneType.Hand, ZoneType.Battlefield, ZoneType.Graveyard, ZoneType.Exile}) {
            sb.append('|');
            for (final Card c : p.getCardsIn(z)) {
                sb.append(c.getId()).append(c.isTapped() ? "t," : ",");
            }
        }
        return sb.append('|').append(p.getCardsIn(ZoneType.Library).size()).toString();
    }

    /**
     * Retour à l'instantané de cette priorité : on photographie l'état d'après l'annulation, puis « Défaire » de
     * Forge revient à la photo précédente, prise juste avant le lancement. Faux si Forge ne peut pas défaire.
     */
    private boolean rewind() {
        try {
            final UndoManager undo = getGame().getUndoManager();
            if (undo.mode() == UndoManager.Mode.OFF || !undo.isOwner(getPlayer())) {
                return false;
            }
            undo.checkpoint(getGame(), getPlayer());
            return undo.canUndo(getPlayer()) && undo.undo(getGame());
        } catch (final RuntimeException e) {
            System.err.println("Retour avant le lancement impossible : " + e);
            return false;
        }
    }

    /** Remet les points de vie tels quels (pas un gain : Forge n'a pas de remboursement de ce coût). */
    static void restoreLife(final Player p, final int life, final int lostThisTurn) {
        try {
            final Field f = Player.class.getDeclaredField("life");
            f.setAccessible(true);
            f.setInt(p, life);
            p.setLifeLostThisTurn(lostThisTurn);
            final Method update = p.getView().getClass().getDeclaredMethod("updateLife", Player.class);
            update.setAccessible(true);
            update.invoke(p.getView(), p);
        } catch (final ReflectiveOperationException | RuntimeException e) {
            System.err.println("Points de vie non rendus après l'annulation : " + e);
        }
    }

    static LobbyPlayerHuman lobby(final String name, final int free) {
        return new LobbyPlayerHuman(name, 0, 0) {
            @Override
            public Player createIngamePlayer(final Game game, final int id) {
                final Player player = new Player(forge.util.GuiDisplayUtil.personalizeHuman(getName()), game, id);
                player.setFirstController(new HumanController(game, player, this, free));
                return player;
            }

            @Override
            public forge.game.player.PlayerController createMindSlaveController(final Player master, final Player slave) {
                return new HumanController(slave, this, (PlayerControllerHuman) master.getController());
            }
        };
    }
}
