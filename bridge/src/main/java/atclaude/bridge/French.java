package atclaude.bridge;

import forge.card.CardRules;
import forge.card.ICardFace;
import forge.game.Game;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.card.CardView.CardStateView;
import forge.game.keyword.Keyword;
import forge.game.player.PlayerView;
import forge.game.spellability.SpellAbility;
import forge.game.spellability.SpellAbilityStackInstance;
import forge.game.spellability.StackItemView;
import forge.game.trigger.Trigger;
import forge.game.zone.ZoneType;
import forge.item.PaperCard;
import forge.model.FModel;
import forge.util.CardTranslation;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
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
            + "end of turn|gains?|gets?|may|with|enters|whenever|when|dies|opponent|life|control|player|spell|counter|adds?|tap|"
            + "destroy|return|put|deals|sacrifices?|discards?|searches|shuffles)\\b"); // pas « mana » ni « exile » : aussi français
    private static final Pattern TARGETING = Pattern.compile("\\s*\\(Targeting: \\[*(.*?)\\]*\\)");
    private static final Pattern NULL_IMPORTANT = Pattern.compile("\\s*\\[[^\\[\\]:]+: null\\]");
    private static final Pattern ZONE_CHANGE = Pattern.compile("^(.*) was put into (\\w+) from (\\w+)\\.$");
    /** Même ligne avec le modèle français (« {0} : {2} → {1}. ») : Forge y met les noms anglais des zones. */
    private static final Pattern ZONE_CHANGE_FR = Pattern.compile("^(.*) : ([A-Z]\\w+) → ([A-Z]\\w+)\\.$");
    private static final Pattern MANA = Pattern.compile("\\{T\\}: Add ((?:\\{[^}]+\\})+)\\.");
    private static final Pattern TARGET_LIST = Pattern.compile("ciblant \\[+(.*?)\\]+");
    private static final Pattern DISCARDS = Pattern.compile("^(.+?) discards (.+)\\.$");

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

    /**
     * Types de jetons que Forge traduit mal (« Plant » en « Usine », « Drake » en « Canard », « Goblin » en « Lutin »...) :
     * le mot imprimé sur les cartes françaises. Les autres gardent la traduction de Forge.
     */
    private static final Map<String, String> TOKEN_TYPES = Map.ofEntries(
            Map.entry("Plant", "Plante"), Map.entry("Goblin", "Gobelin"), Map.entry("Saproling", "Saprobionte"),
            Map.entry("Elemental", "Élémental"), Map.entry("Drake", "Drakôn"), Map.entry("Ooze", "Limon"),
            Map.entry("Sliver", "Slivoïde"), Map.entry("Shapeshifter", "Changeforme"), Map.entry("Treefolk", "Sylvin"),
            Map.entry("Gremlin", "Gremlin"), Map.entry("Bat", "Chauve-souris"), Map.entry("Wizard", "Sorcier"),
            Map.entry("Rogue", "Gredin"), Map.entry("Wurm", "Guivre"), Map.entry("Zombie", "Zombie"),
            Map.entry("Phyrexian", "Phyrexian"), Map.entry("Thopter", "Mécanoptère"), Map.entry("Scout", "Éclaireur"),
            Map.entry("Powerstone", "Lithoforce"));

    /** Nom français d'un type de créature que Forge traduit mal (« Goblin » : Gobelin, pas Lutin), sinon null. */
    static String creatureType(final String en) {
        return TOKEN_TYPES.get(en);
    }

    private static volatile Map<String, String> creatureTypesFr;

    /**
     * Types de créature en français (« God » → « dieu »), d'après les cartes officielles : pour chaque carte traduite,
     * les sous-types de sa ligne de type anglaise en face de ceux de sa ligne française (« Créature légendaire : dieu »,
     * « Créature : elfe et druide »), à la même place ; la traduction la plus fréquente l'emporte. En minuscules, comme
     * sur les cartes.
     */
    static Map<String, String> creatureTypesFr() {
        Map<String, String> map = creatureTypesFr;
        if (map != null) {
            return map;
        }
        final Map<String, Map<String, Integer>> votes = new java.util.HashMap<>();
        for (final PaperCard pc : FModel.getMagicDb().getCommonCards().getUniqueCards()) {
            final CardRules rules = pc.getRules();
            if (rules == null || rules.isCustom() || rules.getType() == null || !rules.getType().isCreature()) {
                continue;
            }
            final List<String> en = new java.util.ArrayList<>();
            rules.getType().getSubtypes().forEach(en::add);
            if (en.isEmpty()) {
                continue;
            }
            final String typeEn = rules.getType().toString();
            final String typeFr = CardTranslation.getTranslatedType(rules.getName(), typeEn);
            if (typeFr == null || typeFr.isEmpty() || typeFr.equals(typeEn)) {
                continue;
            }
            final int colon = Math.max(typeFr.lastIndexOf(':'), typeFr.lastIndexOf('—'));
            if (colon < 0) {
                continue;
            }
            final String[] fr = typeFr.substring(colon + 1).trim().split("\\s*,\\s*|\\s+et\\s+");
            if (fr.length != en.size()) {
                continue;
            }
            for (int i = 0; i < fr.length; i++) {
                final String t = fr[i].trim().toLowerCase(Locale.ROOT);
                if (!t.isEmpty() && forge.card.CardType.isACreatureType(en.get(i))) {
                    votes.computeIfAbsent(en.get(i), k -> new java.util.HashMap<>()).merge(t, 1, Integer::sum);
                }
            }
        }
        map = new java.util.HashMap<>();
        for (final Map.Entry<String, Map<String, Integer>> e : votes.entrySet()) {
            String best = null;
            int n = 0;
            for (final Map.Entry<String, Integer> v : e.getValue().entrySet()) {
                if (v.getValue() > n) {
                    n = v.getValue();
                    best = v.getKey();
                }
            }
            if (best != null) {
                map.put(e.getKey(), best);
            }
        }
        // Les corrections faites à la main (« Goblin » : gobelin, pas lutin) passent devant.
        for (final Map.Entry<String, String> e : TOKEN_TYPES.entrySet()) {
            map.put(e.getKey(), e.getValue().toLowerCase(Locale.ROOT));
        }
        creatureTypesFr = map;
        return map;
    }

    /** Un type de créature en français, avec sa majuscule (« Dieu ») ; null si aucune carte ne le traduit. */
    static String creatureTypeFr(final String en) {
        final String fr = creatureTypesFr().get(en);
        return fr == null ? null : Character.toUpperCase(fr.charAt(0)) + fr.substring(1);
    }

    /** Nom français d'un jeton (« Plant Token ») dont Forge traduit mal le type, sinon null. */
    static String tokenName(final String name) {
        if (name == null || !name.endsWith(" Token")) {
            return null;
        }
        final String type = TOKEN_TYPES.get(name.substring(0, name.length() - " Token".length()));
        return type == null ? null : type + " " + forge.util.Localizer.getInstance().getMessage("lblToken");
    }

    /** Nom français d'une carte ou d'un jeton (celui de Forge, types de jetons corrigés). */
    static String cardName(final String name) {
        final String token = tokenName(name);
        return token != null ? token : CardTranslation.getTranslatedName(name);
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
        boolean failed = false;
        try {
            if (game != null) {
                for (final SpellAbilityStackInstance si : game.getStack()) {
                    if (si.getId() == item.getId()) {
                        out = fromAbility(si.getSpellAbility(), forge);
                        if (out == null) {
                            out = keywordTrigger(si.getSpellAbility(), forge);
                        }
                        break;
                    }
                }
            }
        } catch (final RuntimeException e) {
            // La partie a changé pendant la lecture : texte de Forge pour cette fois, on réessaiera.
            out = null;
            failed = true;
        }
        if (out == null) {
            out = cleanTrigger(forge);
        }
        out = Texts.clean(out);
        if (!failed) {
            STACK_CACHE.put(key, out);
        }
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

    /**
     * Libellé d'une capacité à choisir (un mode de « Choisissez l'un — », une capacité parmi plusieurs) : la traduction de
     * Forge si elle en a une, sinon la ligne « • … » du texte français imprimé qui est à la même place que la ligne
     * anglaise correspondante. Le texte de Forge reste si rien ne correspond.
     */
    static String abilityLabel(final String text, final CardStateView state) {
        if (text == null || state == null || !looksEnglish(text)) {
            return text;
        }
        try {
            final String fr = CardTranslation.translateSingleDescriptionText(text, state);
            if (fr != null && !fr.isEmpty() && !fr.equals(text) && !looksEnglish(fr)) {
                return fr.replaceFirst("^•\\s*", "");
            }
            final List<String> en = bullets(state.getOracleText());
            List<String> frLines = bullets(CardTranslation.getTranslatedOracle(state));
            if (frLines.isEmpty()) {
                // Anciennes traductions : « … choisissez l'un — A ; ou B. » sur une seule ligne.
                frLines = inlineModes(CardTranslation.getTranslatedOracle(state));
            }
            if (!en.isEmpty() && en.size() == frLines.size()) {
                final String wanted = comparable(text);
                for (int i = 0; i < en.size(); i++) {
                    final String line = comparable(en.get(i));
                    if (!line.isEmpty() && (line.equals(wanted) || wanted.startsWith(line) || line.startsWith(wanted))) {
                        return frLines.get(i);
                    }
                }
            }
        } catch (final RuntimeException e) {
            // pas de traduction : le texte de Forge
        }
        return text;
    }

    /** Les lignes « • … » d'un texte de carte (les modes), sans la puce. */
    private static List<String> bullets(final String oracle) {
        final List<String> out = new java.util.ArrayList<>();
        if (oracle == null) {
            return out;
        }
        for (final String line : oracle.replace("\\n", "\n").split("\n")) {
            final String l = line.trim();
            if (l.startsWith("•")) {
                out.add(l.substring(1).trim());
            }
        }
        return out;
    }

    /** Modes écrits sur une ligne après « — », séparés par « ; » (le dernier précédé de « ou »). */
    private static List<String> inlineModes(final String oracle) {
        final List<String> out = new java.util.ArrayList<>();
        if (oracle == null) {
            return out;
        }
        final String text = oracle.replace("\\n", " ").replace("\n", " ");
        final int dash = text.indexOf('—');
        if (dash < 0) {
            return out;
        }
        for (final String part : text.substring(dash + 1).split(";")) {
            String m = part.trim().replaceFirst("^ou\\s+", "").replaceAll("[\\s.]+$", "");
            if (!m.isEmpty()) {
                out.add(Character.toUpperCase(m.charAt(0)) + m.substring(1) + ".");
            }
        }
        return out.size() >= 2 ? out : new java.util.ArrayList<>();
    }

    /** Pour comparer deux phrases de Forge : sans le nom de la carte, la ponctuation finale et la casse. */
    private static String comparable(final String s) {
        return s.replace("CARDNAME", "").replaceAll("[\\s.]+$", "").replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
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

    /**
     * Déclencheur que Forge tire d'un mot-clé et écrit toujours en anglais quand la carte n'a pas de traduction (cartes
     * perso) : « Partner with X (When this creature enters, target player may put X into their hand…) ».
     */
    private static String keywordTrigger(final SpellAbility sa, final String forge) {
        if (sa == null || !sa.isTrigger() || sa.getHostCard() == null || !looksEnglish(forge)) {
            return null;
        }
        final Trigger trig = sa.getTrigger();
        if (trig == null || !trig.isKeyword(Keyword.PARTNER_WITH) || trig.getKeyword() == null) {
            return null;
        }
        final String[] k = trig.getKeyword().getOriginal().split(":");
        if (k.length < 2) {
            return null;
        }
        final String partner = cardName(k[1]);
        final String name = GameSerializer.translatedName(sa.getHostCard().getView().getCurrentState());
        return name + " — Partenariat avec " + partner + " : le joueur ciblé peut mettre " + partner
            + " dans sa main depuis sa bibliothèque, puis mélanger.";
    }

    /** Description de la capacité et de tous ses sous-effets. */
    private static String chain(final SpellAbility sa) {
        final StringBuilder sb = new StringBuilder();
        for (SpellAbility n = sa; n != null; n = n.getSubAbility()) {
            final String d = n.getDescription();
            if (d != null && !d.trim().isEmpty()) {
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

    private static final Pattern PROMPT_HEAD = Pattern.compile("^(.+?) \\((\\d{1,7})\\) - (.+)$", Pattern.MULTILINE);

    /**
     * Invite de paiement ou de ciblage d'un sort : Forge commence par « Foudre (207) - Foudre deals 3 damage
     * to IA 1. ». Pour un sort qui n'a qu'une façon d'être lancé, on remplace cette ligne par son texte français.
     */
    static String prompt(final String text) {
        if (text == null || text.indexOf(" - ") < 0) {
            return text;
        }
        final BridgeGuiGame gui = BridgeGuiGame.current();
        final Game game = gui == null || gui.getGameView() == null ? null : gui.getGameView().getGame();
        if (game == null) {
            return text;
        }
        try {
            final Matcher m = PROMPT_HEAD.matcher(text);
            final StringBuilder out = new StringBuilder();
            int last = 0;
            while (m.find()) {
                String line = m.group();
                if (looksEnglish(m.group(3))) {
                    final Card card = game.findById(Integer.parseInt(m.group(2)));
                    SpellAbility only = null;
                    int spells = 0;
                    if (card != null) {
                        for (final SpellAbility sa : card.getSpellAbilities()) {
                            if (sa.isSpell() && !sa.isManaAbility()) {
                                only = sa;
                                spells++;
                            }
                        }
                    }
                    final String fr = spells == 1 ? fromAbility(only, line) : null;
                    if (fr != null) {
                        line = fr;
                    }
                }
                out.append(text, last, m.start()).append(line);
                last = m.end();
            }
            out.append(text, last, text.length());
            return out.toString();
        } catch (final RuntimeException e) {
            // Partie modifiée pendant la lecture : invite laissée telle quelle.
            return text;
        }
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
        final Matcher d = DISCARDS.matcher(out);
        if (d.matches()) {
            out = d.group(1) + " défausse " + d.group(2) + ".";
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
