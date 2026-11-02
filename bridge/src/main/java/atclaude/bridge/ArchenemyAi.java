package atclaude.bridge;

import forge.LobbyPlayer;
import forge.ai.AiAttackController;
import forge.ai.AiController;
import forge.ai.ComputerUtilCost;
import forge.game.Game;
import forge.game.GameEntity;
import forge.game.card.Card;
import forge.game.combat.Combat;
import forge.game.combat.CombatUtil;
import forge.game.cost.Cost;
import forge.game.player.Player;
import forge.game.spellability.SpellAbility;
import forge.util.MyRandom;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * IA de l'Archenemy. Forge attaque l'adversaire le plus menaçant (plateau, main, terrains), celui qui passe sous
 * 20 points de vie devient sa cible prioritaire, et ses égalités vont au premier joueur après lui dans l'ordre du
 * tour : contre une équipe de trois, il s'acharne sur un seul joueur. Ici, chaque tour, l'Archenemy attaque celui
 * de l'équipe qu'il a le moins attaqué jusque-là (au hasard entre égaux) ; Forge décide seul quand un joueur est
 * à sa portée (assez peu de points de vie pour mourir ce tour-ci), ou quand l'attaque prévue ne mène à rien.
 * Les attaquants, les blocages, les sorts et leurs cibles restent ceux de Forge.
 */
final class ArchenemyAi extends Mulligans.HouseAi {

    private static Field defender;
    private static Method refresh;
    private static Field aggression;

    /** Attaquants envoyés jusque-là sur chaque joueur (ou ses planeswalkers et batailles), par identifiant. */
    private final Map<Integer, Integer> received = new HashMap<>();

    ArchenemyAi(final Game game, final Player player, final LobbyPlayer lobby, final int free) {
        super(game, player, lobby, free);
    }

    @Override
    public void declareAttackers(final Player attacker, final Combat combat) {
        final Player target = fairTarget(attacker, combat);
        if (target == null || !declareAgainst(attacker, combat, target)) {
            super.declareAttackers(attacker, combat);
        }
        for (final Card a : combat.getAttackers()) {
            final Player p = owner(combat.getDefenderByAttacker(a));
            if (p != null) {
                received.merge(p.getId(), 1, Integer::sum);
            }
        }
    }

    /** L'adversaire le moins attaqué, ou null pour laisser Forge choisir (un seul adversaire, ou l'un d'eux à portée). */
    private Player fairTarget(final Player attacker, final Combat combat) {
        final List<Player> opponents = new ArrayList<>();
        for (final GameEntity d : combat.getDefenders()) {
            if (d instanceof Player p && p.isOpponentOf(attacker) && !p.hasLost()) {
                opponents.add(p);
            }
        }
        if (opponents.size() < 2) {
            return null;
        }
        int power = 0;
        for (final Card c : attacker.getCreaturesInPlay()) {
            if (CombatUtil.canAttack(c)) {
                power += Math.max(0, c.getNetCombatDamage());
            }
        }
        for (final Player p : opponents) {
            if (p.canLoseLife() && p.getLife() <= power) {
                return null;
            }
        }
        int least = Integer.MAX_VALUE;
        for (final Player p : opponents) {
            least = Math.min(least, received.getOrDefault(p.getId(), 0));
        }
        final List<Player> pool = new ArrayList<>();
        for (final Player p : opponents) {
            if (received.getOrDefault(p.getId(), 0) == least) {
                pool.add(p);
            }
        }
        return pool.get(MyRandom.getRandom().nextInt(pool.size()));
    }

    /**
     * L'attaque de Forge, mais contre {@code target} : son contrôleur d'attaque choisit seul sa cible à la
     * construction, on la remplace avant qu'il décide. Faux si rien n'attaque ou si la déclaration est invalide.
     */
    private boolean declareAgainst(final Player attacker, final Combat combat, final Player target) {
        try {
            final AiAttackController ctrl = new AiAttackController(attacker);
            if (defender == null) {
                final Field f = AiAttackController.class.getDeclaredField("defendingOpponent");
                f.setAccessible(true);
                final Method m = AiAttackController.class.getDeclaredMethod("refreshCombatants", GameEntity.class);
                m.setAccessible(true);
                final Field a = AiController.class.getDeclaredField("lastAttackAggression");
                a.setAccessible(true);
                refresh = m;
                aggression = a;
                defender = f;
            }
            defender.set(ctrl, target);
            refresh.invoke(ctrl, target);
            final int level = ctrl.declareAttackers(combat);
            ctrl.reinforceWithBanding(combat);
            removeUnpayable(combat, attacker);
            if (combat.getAttackers().isEmpty() || !CombatUtil.validateAttackers(combat)) {
                combat.clearAttackers();
                return false;
            }
            aggression.setInt(getAi(), level);
            return true;
        } catch (final ReflectiveOperationException | RuntimeException e) {
            System.err.println("Archenemy : attaque répartie impossible, Forge choisit sa cible : " + e);
            combat.clearAttackers();
            return false;
        }
    }

    /** Comme Forge : un attaquant dont le coût d'attaque (Propagande...) ne peut pas être payé reste chez lui. */
    private static void removeUnpayable(final Combat combat, final Player ai) {
        for (final Card a : combat.getAttackers().threadSafeIterable()) {
            final Cost cost = CombatUtil.getAttackCost(ai.getGame(), a, combat.getDefenderByAttacker(a));
            if (cost == null) {
                continue;
            }
            final SpellAbility fake = new SpellAbility.EmptySa(a, a.getController());
            fake.setCardState(a.getCurrentState());
            fake.setPayCosts(cost);
            fake.setSVar("X", "0");
            if (!ComputerUtilCost.canPayCost(cost, fake, ai, true)) {
                combat.removeFromCombat(a);
            }
        }
    }

    /** Le joueur visé par une attaque : lui-même, le contrôleur du planeswalker ou le protecteur de la bataille. */
    private static Player owner(final GameEntity d) {
        if (d instanceof Player p) {
            return p;
        }
        if (d instanceof Card c) {
            return c.isBattle() ? c.getProtectingPlayer() : c.getController();
        }
        return null;
    }
}
