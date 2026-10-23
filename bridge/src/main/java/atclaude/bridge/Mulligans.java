package atclaude.bridge;

import forge.LobbyPlayer;
import forge.ai.LobbyPlayerAi;
import forge.ai.PlayerControllerAi;
import forge.game.Game;
import forge.game.card.CardCollection;
import forge.game.card.CardCollectionView;
import forge.game.player.Player;
import forge.player.LobbyPlayerHuman;
import forge.player.PlayerControllerHuman;
import forge.util.GuiDisplayUtil;

/**
 * Mulligans gratuits, règle maison du salon : les {@code free} premiers mulligans de chaque joueur ne
 * coûtent aucune carte (on garde 7 cartes), les suivants suivent le mulligan de Londres (une carte de
 * moins par mulligan au-delà). Forge décide seul combien de cartes remettre sous la bibliothèque : ses
 * contrôleurs de joueur sont remplacés par des versions qui comptent les mulligans et corrigent ce nombre.
 */
final class Mulligans {

    /** Tous les mulligans sont gratuits (Forge s'arrête de lui-même après 7 ou 8 mulligans de suite). */
    static final int UNLIMITED = -1;
    /** Règle de Forge : un mulligan gratuit à plus de deux joueurs, aucun en duel. */
    static final int FORGE_DEFAULT = -2;

    private Mulligans() { }

    /** Cartes à remettre après {@code taken} mulligans, dont {@code free} gratuits. */
    static int toReturn(final int taken, final int free) {
        return free == UNLIMITED ? 0 : Math.max(0, taken - free);
    }

    static LobbyPlayer human(final String name, final int free) {
        return new LobbyPlayerHuman(name, 0, 0) {
            @Override
            public Player createIngamePlayer(final Game game, final int id) {
                final Player player = new Player(GuiDisplayUtil.personalizeHuman(getName()), game, id);
                player.setFirstController(new PlayerControllerHuman(game, player, this) {
                    private int taken;

                    @Override
                    public boolean mulliganKeepHand(final Player first, final int cardsToReturn) {
                        final boolean keep = super.mulliganKeepHand(first, toReturn(taken, free));
                        if (!keep) {
                            taken++;
                        }
                        return keep;
                    }

                    @Override
                    public CardCollectionView tuckCardsViaMulligan(final CardCollectionView hand, final int cardsToReturn) {
                        final int n = toReturn(taken, free);
                        return n <= 0 ? new CardCollection() : super.tuckCardsViaMulligan(hand, n);
                    }
                });
                return player;
            }
        };
    }

    /** Même IA (nom, profil, avatar) que {@code base}, avec la règle maison. */
    static LobbyPlayer ai(final LobbyPlayerAi base, final int free) {
        final LobbyPlayerAi ai = new LobbyPlayerAi(base.getName(), null) {
            @Override
            public Player createIngamePlayer(final Game game, final int id) {
                final Player player = new Player(getName(), game, id);
                player.setFirstController(new PlayerControllerAi(game, player, this) {
                    private int taken;

                    @Override
                    public boolean mulliganKeepHand(final Player first, final int cardsToReturn) {
                        final boolean keep = super.mulliganKeepHand(first, toReturn(taken, free));
                        if (!keep) {
                            taken++;
                        }
                        return keep;
                    }

                    @Override
                    public CardCollectionView tuckCardsViaMulligan(final CardCollectionView hand, final int cardsToReturn) {
                        final int n = toReturn(taken, free);
                        return n <= 0 ? new CardCollection() : super.tuckCardsViaMulligan(hand, n);
                    }
                });
                return player;
            }
        };
        ai.setAiProfile(base.getAiProfile());
        ai.setAvatarIndex(base.getAvatarIndex());
        ai.setSleeveIndex(base.getSleeveIndex());
        return ai;
    }
}
