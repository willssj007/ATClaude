package atclaude.bridge;

import forge.card.CardRules;
import forge.card.ICardFace;
import forge.game.Game;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.card.CardView.CardStateView;
import forge.game.player.PlayerView;
import forge.game.spellability.SpellAbility;
import forge.game.spellability.SpellAbilityStackInstance;
import forge.game.spellability.StackItemView;
import forge.game.zone.ZoneType;
import forge.item.PaperCard;
import forge.model.FModel;
import forge.util.CardTranslation;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Textes de partie en français là où Forge les laisse en anglais.
 *
 * <p>Forge traduit les textes de règles morceau par morceau, en rapprochant chaque phrase anglaise
 * d'une phrase de la carte française (cardnames-fr-FR.txt). Sur la pile, il écrit une description
 * générée par le code de l'effet (« Foudre deals 3 damage to … »), qui ne correspond à aucune phrase de
 * la carte : on traduit plutôt la description complète de la capacité (tous ses sous-effets d'un coup),
 * avec repli sur le texte français imprimé pour un sort.</p>
 */
final class French {

    private static final Pattern ENGLISH = Pattern.compile("\\b(the|you|your|target|creature|creatures|this|card|cards|draws?|each|damage|until|"
            + "end of turn|gains?|gets?|may|with|enters|whenever|when|dies|opponent|life|control|player|spell|counter|mana|adds?|tap|"
            + "destroy|exile|return|put|deals|sacrifices?|discards?|searches|shuffles)\\b");
    private static final Pattern TARGETING = Pattern.compile("\\s*\\(Targeting: \\[*(.*?)\\]*\\)");
    private static final Pattern NULL_IMPORTANT = Pattern.compile("\\s*\\[[^\\[\\]:]+: null\\]");
    private static final Pattern ZONE_CHANGE = Pattern.compile("^(.*) was put into (\\w+) from (\\w+)\\.$");
    /** Même ligne avec le modèle français (« {0} : {2} → {1}. ») : Forge y met les noms anglais des zones. */
    private static final Pattern ZONE_CHANGE_FR = Pattern.compile("^(.*) : ([A-Z]\\w+) → ([A-Z]\\w+)\\.$");
    private static final Pattern MANA = Pattern.compile("\\{T\\}: Add ((?:\\{[^}]+\\})+)\\.");
    private static final Pattern TARGET_LIST = Pattern.compile("ciblant \\[+(.*?)\\]+");

    /** Texte de Forge d'un élément de pile (nettoyé) → texte français avec ses cibles, pour la ligne « résolu » du journal. */
    private static final Map<String, String> RESOLVED = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(final Map.Entry<String, String> eldest) {
            return size() > 300;
        }
    });

    private static final Map<String, String> STACK_CACHE = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(final Map.Entry<String, String> eldest) {
            return size() > 300;
        }
    });

    private French() { }

    /**
     * Forge range la correspondance anglais → français des cartes ayant des « variantes fonctionnelles »
     * (Foudre, Contresort, Colère de Dieu...) sous une mauvaise clé : tous leurs textes restaient en anglais.
     * On la construit sous le nom simple, une fois au démarrage (quelques dizaines de millisecondes).
     */
    static void prebuildVariantMappings() {
        for (final PaperCard pc : FModel.getMagicDb().getCommonCards().getUniqueCards()) {
            final CardRules r = pc.getRules();
            for (final ICardFace face : new ICardFace[]{r.getMainPart(), r.getOtherPart()}) {
                if (face != null && face.hasFunctionalVariants()) {
                    CardTranslation.buildOracleMapping(face.getName(), face.getOracleText(), null);
                }
            }
        }
    }

    static boolean looksEnglish(final String s) {
        return s != null && ENGLISH.matcher(s.replaceAll("\\([^)]*\\)", " ").toLowerCase()).find();
    }

    /** Texte d'un élément de la pile, en français si possible, sans identifiants. */
    static String stackText(final Game game, final StackItemView item) {
        final String forge = item.getText();
        final String key = item.getId() + "|" + forge;
        final String hit = STACK_CACHE.get(key);
        if (hit != null) {
            return hit;
        }
        String out = null;
        try {
            if (game != null) {
                for (final SpellAbilityStackInstance si : game.getStack()) {
                    if (si.getId() == item.getId()) {
                        out = fromAbility(si.getSpellAbility(), forge);
                        break;
                    }
                }
            }
        } catch (final RuntimeException e) {
            // La partie a changé pendant la lecture : on garde le texte de Forge.
            out = null;
        }
        if (out == null) {
            out = cleanTrigger(forge);
        }
        out = Texts.clean(out);
        STACK_CACHE.put(key, out);
        final String targets = targets(item);
        RESOLVED.put(Texts.clean(forge), targets.isEmpty() ? out : out + " → " + targets);
        return out;
    }

    /** Noms des cibles d'un élément de la pile (le texte français dit « la créature ciblée »). */
    private static String targets(final StackItemView item) {
        final BridgeGuiGame gui = BridgeGuiGame.current();
        final StringBuilder sb = new StringBuilder();
        try {
            if (item.getTargetPlayers() != null) {
                for (final PlayerView p : item.getTargetPlayers()) {
                    sb.append(sb.length() > 0 ? ", " : "").append(p.getName());
                }
            }
            if (item.getTargetCards() != null) {
                for (final CardView c : item.getTargetCards()) {
                    final boolean visible = gui != null && gui.mayView(c) && c.getCurrentState() != null && !c.isFaceDown();
                    sb.append(sb.length() > 0 ? ", " : "").append(visible ? GameSerializer.translatedName(c.getCurrentState()) : "carte face cachée");
                }
            }
        } catch (final RuntimeException e) {
            // Cibles modifiées pendant la lecture.
        }
        return sb.toString();
    }

    private static String fromAbility(final SpellAbility sa, final String forge) {
        if (sa == null || sa.isTrigger() || sa.getHostCard() == null) {
            return null; // le texte d'une capacité déclenchée est déjà celui de la carte (en français si connu)
        }
        final int dash = forge.indexOf(" - ");
        final String body = dash >= 0 ? forge.substring(dash + 3) : forge;
        if (!looksEnglish(body)) {
            return null; // déjà en français : on garde le texte de Forge, qui nomme les cibles
        }
        final Card host = sa.getHostCard();
        final String chain = chain(sa);
        if (chain.isEmpty()) {
            return null;
        }
        String fr = CardTranslation.translateSingleDescriptionText(chain, host);
        if (fr.equals(chain)) {
            fr = CardTranslation.translateMultipleDescriptionText(chain, host);
        }
        if (fr.equals(chain) && sa.isSpell()) {
            // Dernier recours pour un sort : le texte français imprimé.
            final CardStateView st = host.getView().getCurrentState();
            final String printed = st == null ? "" : CardTranslation.getTranslatedOracle(st);
            if (!printed.isEmpty() && !printed.equals(st.getOracleText())) {
                fr = printed.replace("\r\n\r\n", "\n").replace("\\n", "\n");
            }
        }
        if (fr.equals(chain) || looksEnglish(fr)) {
            return null;
        }
        final String name = GameSerializer.translatedName(host.getView().getCurrentState());
        fr = fr.replace("CARDNAME", name).replace("NICKNAME", name);
        if (sa.isAbility() && !sa.isSpell()) {
            fr = stripCost(fr);
        }
        if (sa.costHasManaX() && sa.getXManaCostPaid() != null) {
            fr += " (X = " + sa.getXManaCostPaid() + ")";
        }
        return name + " — " + fr;
    }

    /** Description de la capacité et de tous ses sous-effets. */
    private static String chain(final SpellAbility sa) {
        final StringBuilder sb = new StringBuilder();
        for (SpellAbility n = sa; n != null; n = n.getSubAbility()) {
            final String d = n.getDescription();
            if (d != null && !d.isBlank()) {
                sb.append(sb.length() > 0 ? " " : "").append(d.trim());
            }
        }
        return sb.toString();
    }

    /** « {7}{U}, {T} : Piochez trois cartes. » → « Piochez trois cartes. » (le coût est déjà payé). */
    private static String stripCost(final String fr) {
        final int i = fr.indexOf(" : ");
        if (i <= 0 || i > 80) {
            return fr;
        }
        final String head = fr.substring(0, i);
        if (head.contains("«") || head.contains("\"") || head.contains(".")) {
            return fr;
        }
        final String rest = fr.substring(i + 3).trim();
        return rest.isEmpty() ? fr : Character.toUpperCase(rest.charAt(0)) + rest.substring(1);
    }

    private static String cleanTrigger(final String s) {
        String out = TARGETING.matcher(s).replaceAll(" (cible : $1)");
        out = NULL_IMPORTANT.matcher(out).replaceAll("");
        return out.replace("(OPTIONAL) ", "");
    }

    /** Lignes du journal que Forge écrit en anglais. */
    static String logLine(final String text) {
        if (text == null) {
            return "";
        }
        final String resolved = RESOLVED.get(Texts.clean(text));
        if (resolved != null) {
            return resolved;
        }
        String out = text;
        final Matcher z = ZONE_CHANGE.matcher(out);
        final Matcher zf = ZONE_CHANGE_FR.matcher(out);
        if (z.matches()) {
            out = z.group(1) + " : " + zone(z.group(3)) + " → " + zone(z.group(2)) + ".";
        } else if (zf.matches()) {
            out = zf.group(1) + " : " + zone(zf.group(2)) + " → " + zone(zf.group(3)) + ".";
        }
        out = MANA.matcher(out).replaceAll("{T} : Ajoutez $1.");
        out = TARGET_LIST.matcher(out).replaceAll("ciblant $1");
        return out;
    }

    private static String zone(final String name) {
        try {
            final ZoneType z = ZoneType.smartValueOf(name);
            return z == null ? name : z.getTranslatedName();
        } catch (final RuntimeException e) {
            return name;
        }
    }
}
