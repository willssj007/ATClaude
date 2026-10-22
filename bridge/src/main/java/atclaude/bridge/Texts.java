package atclaude.bridge;

import forge.game.Game;
import forge.game.GameView;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.card.CardView.CardStateView;
import forge.util.CardTranslation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Nettoie les textes de Forge avant de les montrer. Forge désigne les cartes par « Nom (identifiant) »,
 * souvent en anglais, dans les invites, sur la pile et dans le journal (« Sélectionnez les créatures à
 * bloquer Unicycle (160) »). On remplace chaque « Nom (identifiant) » par le nom français, sans
 * l'identifiant, puis les noms anglais restants des cartes de la partie par leur nom français.
 *
 * <p>On ne fait que traduire un nom déjà écrit par Forge : une carte que le texte ne nomme pas n'est
 * jamais nommée, et une carte face cachée devient « carte face cachée ».</p>
 */
final class Texts {

    private static final Pattern CARD_ID = Pattern.compile(" \\((\\d{1,7})\\)");
    private static final Pattern HIDDEN = Pattern.compile("(?:Face-down card ?)?\\(H\\d+\\)");
    private static final Pattern LINE_START = Pattern.compile("(?m)^carte face cachée");
    private static final String FACE_DOWN = "carte face cachée";
    private static final Pattern YOUR_ZONE = Pattern.compile("\\b(de|dans|à|sur|depuis) vous (bibliothèque|main|cimetière|exil|zone de commandement|champ de bataille|réserve)");
    private static final int CACHE_SIZE = 800;

    /** Textes déjà nettoyés (le journal et la pile reviennent à chaque photo de la partie). */
    private static final Map<String, String> CACHE = Collections.synchronizedMap(new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(final Map.Entry<String, String> eldest) {
            return size() > CACHE_SIZE;
        }
    });

    /** Noms vus pour chaque carte : sert encore quand un jeton ou une copie a quitté la partie. */
    private static final Map<Integer, Set<String>> KNOWN = new ConcurrentHashMap<>();
    /** Nom anglais → nom français, pour les cartes de la partie dont le nom change en français. */
    private static final Map<String, String> ENGLISH = new ConcurrentHashMap<>();
    private static volatile Pattern englishPattern;
    private static volatile int englishPatternSize = -1;
    /** Change à chaque nouveau motif : un texte nettoyé avec l'ancien n'entre pas dans le cache. */
    private static volatile int patternVersion;

    private Texts() { }

    /** Oublie tout (nouvelle partie : les identifiants désignent d'autres cartes). */
    static void reset() {
        CACHE.clear();
        KNOWN.clear();
        ENGLISH.clear();
        englishPattern = null;
        englishPatternSize = -1;
    }

    /**
     * Retient les noms d'une carte, y compris ceux de ses autres faces. Ces noms servent seulement à
     * reconnaître une carte déjà nommée par Forge : on peut donc retenir ceux d'une carte cachée. Seuls
     * les noms des cartes visibles servent à traduire un nom anglais écrit sans identifiant (sinon, le fait
     * qu'un mot soit traduit trahirait la présence d'une carte cachée).
     */
    static void remember(final CardView c) {
        if (c == null || c.getId() <= 0) {
            return;
        }
        final BridgeGuiGame gui = BridgeGuiGame.current();
        final boolean visible = gui != null && gui.mayView(c) && !c.isFaceDown();
        final Set<String> names = KNOWN.computeIfAbsent(c.getId(), k -> ConcurrentHashMap.newKeySet());
        final int before = names.size();
        addName(names, c.getName());
        addName(names, c.getOracleName());
        addState(names, c.getCurrentState());
        addState(names, c.getAlternateState());
        addState(names, c.getLeftSplitState());
        addState(names, c.getRightSplitState());
        if (names.size() != before || visible) {
            for (final String n : new ArrayList<>(names)) {
                final String fr = CardTranslation.getTranslatedName(n);
                if (fr != null && !fr.isEmpty() && !fr.equals(n)) {
                    names.add(fr);
                    if (visible && n.length() >= 4 && !ENGLISH.containsKey(n)) {
                        ENGLISH.put(n, fr);
                    }
                }
            }
        }
    }

    private static void addState(final Set<String> names, final CardStateView s) {
        if (s != null) {
            addName(names, s.getName());
        }
    }

    private static void addName(final Set<String> names, final String name) {
        if (name != null && !name.isEmpty()) {
            names.add(name);
        }
    }

    static String clean(final String text) {
        if (text == null) {
            return "";
        }
        if (text.isEmpty()) {
            return text;
        }
        final String cached = CACHE.get(text);
        if (cached != null) {
            return cached;
        }
        final int version = patternVersion;
        final boolean[] unresolved = {false};
        String result = text.indexOf('(') < 0 ? text : replaceIds(text, unresolved);
        result = HIDDEN.matcher(result).replaceAll(FACE_DOWN);
        result = translateEnglish(result);
        result = LINE_START.matcher(result).replaceAll("Carte face cachée");
        // Forge remplace « {player's} » par « vous » : « une carte de vous bibliothèque ».
        result = YOUR_ZONE.matcher(result).replaceAll("$1 votre $2");
        if (!unresolved[0] && version == patternVersion) {
            // Un identifiant non reconnu (partie en cours de modification, carte pas encore vue) sera
            // retenté à la prochaine photo.
            CACHE.put(text, result);
        }
        return result;
    }

    private static String replaceIds(final String text, final boolean[] unresolved) {
        final BridgeGuiGame gui = BridgeGuiGame.current();
        final GameView gv = gui == null ? null : gui.getGameView();
        final Game game = gv == null ? null : gv.getGame();
        final Matcher m = CARD_ID.matcher(text);
        final StringBuilder out = new StringBuilder(text.length());
        int last = 0;
        while (m.find()) {
            final String before = text.substring(last, m.start());
            final int id = Integer.parseInt(m.group(1));
            final Card card = game == null ? null : findCard(game, id);
            final String hit = matchName(before, id, card);
            if (hit != null) {
                out.append(before, 0, before.length() - hit.length()).append(display(gui, hit, card));
            } else if (card != null && card.isFaceDown() && before.endsWith(" ")) {
                // « … à  (12) » : Forge a écrit le nom vide d'une carte face cachée.
                out.append(before).append(FACE_DOWN);
            } else {
                // Pas une carte (« Mana blanc (3) ») ou carte inconnue : texte laissé tel quel.
                out.append(before).append(m.group());
                if (card == null && game != null && !KNOWN.containsKey(id)) {
                    unresolved[0] = true;
                }
            }
            last = m.end();
        }
        out.append(text, last, text.length());
        return out.toString();
    }

    private static Card findCard(final Game game, final int id) {
        try {
            return game.findById(id);
        } catch (final RuntimeException e) {
            // Zones modifiées par le fil de partie pendant la recherche.
            return null;
        }
    }

    /** Le nom qui précède « (identifiant) » dans le texte, parmi les noms connus de la carte. */
    private static String matchName(final String before, final int id, final Card card) {
        final List<String> names = new ArrayList<>(KNOWN.getOrDefault(id, Collections.emptySet()));
        if (card != null) {
            try {
                // Lus dans la vue de la carte : getState() d'une carte vivante peut créer un état
                // pendant que le fil de partie le modifie.
                final CardView v = card.getView();
                names.add(v.getName());
                names.add(v.getOracleName());
                for (final CardStateView st : new CardStateView[]{v.getCurrentState(), v.getAlternateState(), v.getLeftSplitState(), v.getRightSplitState()}) {
                    if (st != null) {
                        names.add(st.getName());
                    }
                }
            } catch (final RuntimeException e) {
                // États modifiés pendant la lecture : on se contente des noms déjà connus.
            }
            for (final String n : new ArrayList<>(names)) {
                if (n != null && !n.isEmpty()) {
                    names.add(CardTranslation.getTranslatedName(n));
                }
            }
        }
        names.removeIf(n -> n == null || n.isEmpty());
        names.sort((a, b) -> b.length() - a.length());
        for (final String n : names) {
            if (before.endsWith(n) && endsOutsideWord(before.substring(0, before.length() - n.length()))) {
                return n;
            }
        }
        return null;
    }

    private static boolean endsOutsideWord(final String s) {
        return s.isEmpty() || !Character.isLetterOrDigit(s.charAt(s.length() - 1));
    }

    /**
     * Nom à afficher : le nom français actuel si le joueur voit la carte, sinon la traduction du nom
     * que Forge a écrit (une révélation garde le nom révélé, sans rien dévoiler de plus).
     */
    private static String display(final BridgeGuiGame gui, final String hit, final Card card) {
        if (card != null && gui != null) {
            final CardView view = card.getView();
            if (view != null && !view.isFaceDown() && view.getCurrentState() != null && gui.mayView(view)) {
                final String name = GameSerializer.translatedName(view.getCurrentState());
                if (!name.isEmpty()) {
                    return name;
                }
            }
        }
        final String fr = CardTranslation.getTranslatedName(hit);
        return fr == null || fr.isEmpty() ? hit : fr;
    }

    /** Remplace les noms anglais des cartes de la partie (« cast Lightning Bolt ») par leur nom français. */
    private static String translateEnglish(final String text) {
        final Pattern p = englishPattern();
        if (p == null) {
            return text;
        }
        final Matcher m = p.matcher(text);
        if (!m.find()) {
            return text;
        }
        final StringBuilder out = new StringBuilder(text.length());
        int last = 0;
        do {
            out.append(text, last, m.start()).append(ENGLISH.getOrDefault(m.group(), m.group()));
            last = m.end();
        } while (m.find());
        out.append(text, last, text.length());
        return out.toString();
    }

    private static Pattern englishPattern() {
        final int size = ENGLISH.size();
        if (size == 0) {
            return null;
        }
        if (size != englishPatternSize || englishPattern == null) {
            final List<String> names = new ArrayList<>(ENGLISH.keySet());
            names.sort((a, b) -> b.length() - a.length());
            final StringBuilder sb = new StringBuilder("(?<![\\p{L}\\p{N}])(?:");
            for (int i = 0; i < names.size(); i++) {
                if (i > 0) {
                    sb.append('|');
                }
                sb.append(Pattern.quote(names.get(i)));
            }
            sb.append(")(?![\\p{L}\\p{N}])");
            englishPattern = Pattern.compile(sb.toString());
            englishPatternSize = size;
            patternVersion++;
            // Les textes déjà nettoyés pouvaient contenir un nom anglais qu'on sait maintenant traduire.
            CACHE.clear();
        }
        return englishPattern;
    }
}
