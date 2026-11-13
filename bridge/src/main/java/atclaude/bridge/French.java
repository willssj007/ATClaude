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

import java.util.ArrayList;
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
    // « (Targeting: [[Grizzlis (123)]]) » : la cible peut contenir des parenthèses (identifiant de la carte).
    private static final Pattern TARGETING = Pattern.compile("\\s*\\(Targeting: ((?:[^()]|\\([^()]*\\))*)\\)");
    private static final Pattern NULL_IMPORTANT = Pattern.compile("\\s*\\[[^\\[\\]:]+: null\\]");
    private static final Pattern ZONE_CHANGE = Pattern.compile("^(.*) was put into (\\w+) from (\\w+)\\.$");
    /** Même ligne avec le modèle français (« {0} : {2} → {1}. ») : Forge y met les noms anglais des zones. */
    private static final Pattern ZONE_CHANGE_FR = Pattern.compile("^(.*) : ([A-Z]\\w+) → ([A-Z]\\w+)\\.$");
    private static final Pattern MANA = Pattern.compile("\\{T\\}: Add ((?:\\{[^}]+\\})+)\\.");
    private static final Pattern TARGET_LIST = Pattern.compile("ciblant \\[+(.*?)\\]+");
    private static final Pattern DISCARDS = Pattern.compile("^(.+?) discards (.+)\\.$");
    /** « IA 2 a choisi Discard a card. pour Mog… » : le mode choisi, écrit en anglais par la carte. */
    private static final Pattern CHOSE_MODE = Pattern.compile("^(.+?) a choisi (.+?) pour (.+)$");
    private static final Pattern SEND_COUNTERED = Pattern.compile("^Send countered spell to (\\w+)$");
    private static final Pattern CLASHED = Pattern.compile("^(.+?) clashed and put (.+) to the (top|bottom) of library\\.$");

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
        if ("Puzzle Goal".equals(name)) {
            return "Objectif de l'énigme"; // carte d'effet des énigmes, créée par Forge
        }
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
            // Une phrase de la carte (déclencheur différé…) : prise dans son texte français.
            if (looksEnglish(out) && game != null) {
                try {
                    for (final SpellAbilityStackInstance si : game.getStack()) {
                        if (si.getId() == item.getId() && si.getSpellAbility() != null) {
                            String fr = sentenceFromOracle(out, si.getSpellAbility().getHostCard());
                            if (fr == null) {
                                fr = triggerHead(Texts.clean(out), si.getSpellAbility().getHostCard());
                            }
                            if (fr != null) {
                                out = fr;
                            }
                            break;
                        }
                    }
                } catch (final RuntimeException e) {
                    // pile modifiée pendant la lecture
                }
            }
        }
        out = Texts.clean(out);
        if (out != null && out.indexOf("NAME") >= 0 && item.getSourceCard() != null && item.getSourceCard().getCurrentState() != null) {
            out = GameSerializer.withNames(out, GameSerializer.translatedName(item.getSourceCard().getCurrentState()));
        }
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
        String fr = partsInFrench(sa, host);
        if (fr == null) {
            fr = CardTranslation.translateSingleDescriptionText(chain, host);
        }
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
        // Le texte anglais de Forge commence par le mot-clé (« Firebending 2 (…) », « Partner with X (…) ») ; une carte
        // traduite a déjà son texte français.
        if (sa == null || !sa.isTrigger() || sa.getHostCard() == null || !forge.matches("(?s)\\s*(Firebending|Partner with)\\b.*")) {
            return null;
        }
        final Trigger trig = sa.getTrigger();
        if (trig == null || trig.getKeyword() == null) {
            return null;
        }
        final String[] k = trig.getKeyword().getOriginal().split(":");
        if (k.length < 2) {
            return null;
        }
        if (trig.isKeyword(Keyword.FIREBENDING)) {
            // « Maîtrise du Feu 2 » : ajoutez {R}{R} en attaquant ; ce mana dure jusqu'à la fin du combat.
            final String host = GameSerializer.translatedName(sa.getHostCard().getView().getCurrentState());
            final String red = k[1].matches("\\d{1,2}") ? "{R}".repeat(Integer.parseInt(k[1])) : "X {R}";
            return host + " — Maîtrise du Feu " + k[1] + " : ajoutez " + red + ". Ce mana dure jusqu'à la fin du combat.";
        }
        if (!trig.isKeyword(Keyword.PARTNER_WITH)) {
            return null;
        }
        final String partner = cardName(k[1]);
        final String name = GameSerializer.translatedName(sa.getHostCard().getView().getCurrentState());
        return name + " — Partenariat avec " + partner + " : le joueur ciblé peut mettre " + partner
            + " dans sa main depuis sa bibliothèque, puis mélanger.";
    }

    /** Description de la capacité et de tous ses sous-effets. */
    /**
     * Capacité en plusieurs morceaux (« … deals 2 damage divided … » puis « Draw a card. ») : chaque morceau traduit à
     * part, sinon seule la phrase la plus proche du tout était gardée (Électrolyse sans « Piochez une carte »). Null si
     * un morceau n'a pas de traduction.
     */
    private static String partsInFrench(final SpellAbility sa, final Card host) {
        final List<String> out = new ArrayList<>();
        int parts = 0;
        for (SpellAbility n = sa; n != null; n = n.getSubAbility()) {
            final String d = n.getDescription();
            if (d == null || d.trim().isEmpty()) {
                continue;
            }
            // Une description peut tenir plusieurs phrases (« … one or two targets. Draw a card. ») : une par une.
            for (final String part : d.trim().split("(?<=[.!?])\\s+(?=\\p{Lu})")) {
                if (part.isBlank()) {
                    continue;
                }
                parts++;
                final String t = CardTranslation.translateSingleDescriptionText(part.trim(), host);
                if (t.equals(part.trim()) || looksEnglish(t)) {
                    return null;
                }
                if (!out.contains(t.trim())) {
                    out.add(t.trim());
                }
            }
        }
        return parts < 2 ? null : String.join(" ", out);
    }

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

    private static final Pattern FIREBENDING_TEXT = Pattern.compile(
        "Firebending (\\S+) \\(Whenever this creature attacks, add ([^.]*)\\. This mana lasts until end of combat\\.\\)");

    /** Rappels de mots-clés que Forge écrit en anglais pour une carte sans traduction (cartes perso). */
    private static String keywordReminders(final String s) {
        return FIREBENDING_TEXT.matcher(s).replaceAll("Maîtrise du Feu $1 : ajoutez $2. Ce mana dure jusqu'à la fin du combat.");
    }

    private static String cleanTrigger(final String s) {
        final Matcher m = TARGETING.matcher(s);
        final StringBuilder sb = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement(" (cible : " + m.group(1).replaceAll("[\\[\\]]", "").trim() + ")"));
        }
        m.appendTail(sb);
        String out = keywordReminders(sb.toString());
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

    private static final Pattern SENTENCE_END = Pattern.compile("(?<=[.!?])\\s+|\\r?\\n+");
    private static final Pattern ENGINE_SUFFIX = Pattern.compile("\\s*\\[[^\\]]*\\]\\s*$");

    private static final Pattern THIS_CARD = Pattern.compile("\\bthis (creature|artifact|enchantment|land|permanent|planeswalker|card|spell"
            + "|vehicle|equipment|aura|saga|battle|siege|class|case|room)\\b");

    private static String sentenceKey(final String s, final String name) {
        String k = s.toLowerCase(Locale.ROOT);
        if (name != null && !name.isEmpty()) {
            k = k.replace(name.toLowerCase(Locale.ROOT), "cardname");
            final String fr = cardName(name);
            if (fr != null && !fr.isEmpty()) {
                k = k.replace(fr.toLowerCase(Locale.ROOT), "cardname");
            }
        }
        // « When this creature enters » (texte de la carte) = « When Raven Familiar enters the battlefield » (pile).
        k = THIS_CARD.matcher(k).replaceAll("cardname").replace("enters the battlefield", "enters");
        return k.replaceAll("\\([^)]*\\)", "").replaceAll("[^\\p{L}\\p{N}+/{}-]+", " ").trim();
    }

    private static String[] sentences(final String text) {
        return SENTENCE_END.split(text.replace("\\n", "\n").trim());
    }

    private static String[] lines(final String text) {
        return text.replace("\\n", "\n").replace("\r", "").trim().split("\n+");
    }

    /**
     * Une phrase anglaise d'une carte (déclencheur différé, partie d'une capacité : « At the beginning of that combat,
     * untap all creatures you control. ») : la phrase française au même rang dans le texte traduit de la carte, quand les
     * deux textes ont autant de phrases. Sinon null.
     */
    static String sentenceFromOracle(final String english, final Card host) {
        if (english == null || host == null || !looksEnglish(english)) {
            return null;
        }
        try {
            final CardRules rules = host.getRules();
            if (rules == null) {
                return null;
            }
            final String core = ENGINE_SUFFIX.matcher(english).replaceAll("").trim();
            final String suffix = english.substring(Math.min(english.length(), english.indexOf(core) + core.length())).trim();
            for (final ICardFace face : new ICardFace[]{rules.getMainPart(), rules.getOtherPart()}) {
                if (face == null || face.getOracleText() == null) {
                    continue;
                }
                final String fr = CardTranslation.getTranslatedOracle(face.getName());
                if (fr == null || fr.isEmpty()) {
                    continue;
                }
                final String want = sentenceKey(core, face.getName());
                if (want.isEmpty()) {
                    continue;
                }
                // Phrase par phrase quand les deux textes en ont autant, sinon ligne par ligne (un rappel entre
                // parenthèses compte une phrase de plus dans une langue que dans l'autre).
                final String[][] pairs = {sentences(face.getOracleText()), sentences(fr), lines(face.getOracleText()), lines(fr)};
                for (int pass = 0; pass < 2; pass++) {
                    final String[] en = pairs[pass * 2];
                    final String[] frs = pairs[pass * 2 + 1];
                    if (en.length != frs.length || en.length < 2) {
                        continue;
                    }
                    for (int i = 0; i < en.length; i++) {
                        if (sentenceKey(en[i], face.getName()).equals(want)) {
                            final String nameFr = cardName(face.getName());
                            return frs[i].trim().replace("CARDNAME", nameFr == null ? face.getName() : nameFr) + (suffix.isEmpty() ? "" : " " + suffix);
                        }
                    }
                }
            }
        } catch (final RuntimeException e) {
            // Carte modifiée pendant la lecture : texte de Forge.
        }
        return null;
    }

    private static final Pattern EN_HEAD = Pattern.compile("^((?:When|Whenever|At)\\b[^,\\n]*,)\\s*(.+)$", Pattern.DOTALL);
    private static final Pattern FR_HEAD = Pattern.compile("^((?:Quand|Lorsque|À chaque fois|Chaque fois|Au début|À la fin|Dès que|Dès qu')[^,\\n]*,)");

    /**
     * Déclencheur modal (« When X enters, • Piochez deux cartes. ») : Forge écrit le début de la capacité en anglais
     * et le mode choisi en français. Le début est repris de la ligne française de la carte (même rang parmi les
     * déclencheurs), le reste gardé. Null si la ligne n'a pas cette forme.
     */
    static String triggerHead(final String text, final Card host) {
        if (text == null || host == null) {
            return null;
        }
        final Matcher m = EN_HEAD.matcher(text.trim());
        if (!m.matches() || looksEnglish(m.group(2).replaceAll("\\[[^\\]]*\\]", ""))) {
            return null;
        }
        try {
            final CardRules rules = host.getRules();
            if (rules == null) {
                return null;
            }
            for (final ICardFace face : new ICardFace[]{rules.getMainPart(), rules.getOtherPart()}) {
                if (face == null || face.getOracleText() == null) {
                    continue;
                }
                final String fr = CardTranslation.getTranslatedOracle(face.getName());
                if (fr == null || fr.isEmpty()) {
                    continue;
                }
                final List<String> enHeads = new ArrayList<>();
                for (final String line : face.getOracleText().replace("\\n", "\n").split("\n")) {
                    final Matcher h = EN_HEAD.matcher(line.trim());
                    if (h.matches()) {
                        enHeads.add(h.group(1));
                    }
                }
                final List<String> frHeads = new ArrayList<>();
                for (final String line : fr.replace("\\n", "\n").split("\n")) {
                    final Matcher h = FR_HEAD.matcher(line.trim());
                    if (h.find()) {
                        frHeads.add(h.group(1));
                    }
                }
                if (enHeads.isEmpty() || enHeads.size() != frHeads.size()) {
                    continue;
                }
                int at = enHeads.size() == 1 ? 0 : -1;
                final String nameFr = cardName(face.getName());
                String head = m.group(1);
                if (nameFr != null && !nameFr.isEmpty()) {
                    head = head.replace(nameFr, face.getName());
                }
                final String want = sentenceKey(head.replaceAll("\\b(this (creature|artifact|enchantment|land|permanent|planeswalker))\\b", face.getName()), face.getName());
                for (int i = 0; at < 0 && i < enHeads.size(); i++) {
                    final String k = sentenceKey(enHeads.get(i).replace("CARDNAME", face.getName())
                            .replaceAll("\\b(this (creature|artifact|enchantment|land|permanent|planeswalker))\\b", face.getName()), face.getName());
                    if (k.equals(want)) {
                        at = i;
                    }
                }
                if (at < 0) {
                    continue;
                }
                String rest = m.group(2).trim();
                if (rest.startsWith("•")) {
                    rest = rest.substring(1).trim();
                }
                if (!rest.isEmpty() && Character.isUpperCase(rest.charAt(0)) && (rest.length() < 2 || !Character.isUpperCase(rest.charAt(1)))) {
                    rest = Character.toLowerCase(rest.charAt(0)) + rest.substring(1);
                }
                return frHeads.get(at) + " " + rest;
            }
        } catch (final RuntimeException e) {
            // Carte modifiée pendant la lecture : texte de Forge.
        }
        return null;
    }

    /**
     * Abonné aux événements de la partie : le texte français de chaque sort ou capacité est préparé dès son arrivée sur
     * la pile (sur le fil de la partie). Sans ça, un sort qui se résout avant que l'écran ait montré la pile laissait sa
     * ligne « résolu » du journal en anglais (« Électrolyse deals 2 damage divided to … »).
     */
    static final class StackWatcher {
        private final Game game;

        StackWatcher(final Game game) {
            this.game = game;
        }

        @com.google.common.eventbus.Subscribe
        public void receiveGameEvent(final forge.game.event.GameEvent ev) {
            if (ev instanceof forge.game.event.GameEventSpellAbilityCast c && c.si() != null) {
                try {
                    stackText(game, c.si());
                } catch (final RuntimeException e) {
                    // texte préparé à l'affichage, comme avant
                }
            }
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
        String out = keywordReminders(text);
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
        final Matcher cm = CHOSE_MODE.matcher(out);
        if (cm.matches() && looksEnglish(cm.group(2))) {
            final String mode = EnglishLines.translate(cm.group(2).trim());
            if (!mode.equals(cm.group(2).trim())) {
                out = cm.group(1) + " a choisi « " + mode.replaceAll("[.]$", "") + " » pour " + cm.group(3);
            }
        }
        final Matcher sc = SEND_COUNTERED.matcher(out);
        if (sc.matches()) {
            out = "Sort contrecarré : pile → " + zone(sc.group(1)) + ".";
        }
        final Matcher cl = CLASHED.matcher(out);
        if (cl.matches()) {
            out = cl.group(1) + " révèle " + cl.group(2) + " pour la confrontation et la met " + ("top".equals(cl.group(3)) ? "au-dessus" : "au-dessous")
                    + " de sa bibliothèque.";
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
