package atclaude.bridge;

import forge.item.PaperCard;
import forge.model.FModel;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pile de manigances de l'Archenemy : 20 manigances différentes tirées au hasard (règle 904.3 : au moins 20 cartes,
 * pas plus de 2 exemplaires d'une même manigance), parmi celles d'un produit officiel ou parmi toutes.
 */
final class Schemes {

    static final int DECK_SIZE = 20;

    private Schemes() { }

    /**
     * set : « OARC » (Archenemy, 2010), « OE01 » (Archenemy : Nicol Bolas, 2017), vide ou autre : toutes les
     * manigances connues de Forge.
     */
    static List<PaperCard> deck(final String set) {
        final Map<String, PaperCard> byName = new LinkedHashMap<>();
        for (final PaperCard pc : FModel.getArchenemyCards().toFlatList()) {
            final boolean wanted = set == null || set.isEmpty() || "all".equals(set) || set.equalsIgnoreCase(pc.getEdition());
            if (wanted && (!byName.containsKey(pc.getName()) || set != null && set.equalsIgnoreCase(pc.getEdition()))) {
                byName.put(pc.getName(), pc);
            }
        }
        if (byName.size() < DECK_SIZE && set != null && !set.isEmpty() && !"all".equals(set)) {
            return deck("all"); // produit incomplet dans cette version de Forge : toutes les manigances
        }
        final List<PaperCard> pool = new ArrayList<>(byName.values());
        Collections.shuffle(pool);
        return new ArrayList<>(pool.subList(0, Math.min(DECK_SIZE, pool.size())));
    }
}
