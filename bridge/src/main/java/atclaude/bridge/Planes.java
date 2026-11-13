package atclaude.bridge;

import forge.item.PaperCard;
import forge.model.FModel;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Paquet planaire d'un joueur (Planechase, règle 901.4) : 10 cartes différentes tirées au hasard, dont 2 phénomènes au
 * plus, parmi celles d'un produit officiel ou parmi toutes.
 */
final class Planes {

    static final int DECK_SIZE = 10;
    static final int MAX_PHENOMENA = 2;

    private Planes() { }

    /**
     * set : « HOP » (Planechase, 2009), « PC2 » (Planechase 2012), « PCA » (Planechase Anthology), « MOC » (L'invasion
     * des machines Commander), vide ou « all » : tous les plans connus de Forge.
     */
    static List<PaperCard> deck(final String set) {
        final boolean all = set == null || set.isEmpty() || "all".equals(set);
        final Map<String, PaperCard> byName = new LinkedHashMap<>();
        for (final PaperCard pc : FModel.getPlanechaseCards().toFlatList()) {
            final boolean wanted = all || set.equalsIgnoreCase(pc.getEdition());
            if (wanted && (!byName.containsKey(pc.getName()) || !all && set.equalsIgnoreCase(pc.getEdition()))) {
                byName.put(pc.getName(), pc);
            }
        }
        final List<PaperCard> planes = new ArrayList<>();
        final List<PaperCard> phenomena = new ArrayList<>();
        for (final PaperCard pc : byName.values()) {
            (pc.getRules().getType().isPhenomenon() ? phenomena : planes).add(pc);
        }
        if (planes.size() + Math.min(MAX_PHENOMENA, phenomena.size()) < DECK_SIZE && !all) {
            return deck("all"); // produit incomplet dans cette version de Forge : tous les plans
        }
        Collections.shuffle(planes);
        Collections.shuffle(phenomena);
        final List<PaperCard> deck = new ArrayList<>(phenomena.subList(0, Math.min(MAX_PHENOMENA, phenomena.size())));
        deck.addAll(planes.subList(0, Math.min(DECK_SIZE - deck.size(), planes.size())));
        Collections.shuffle(deck);
        return deck;
    }
}
