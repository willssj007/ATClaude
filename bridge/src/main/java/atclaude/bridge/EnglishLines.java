package atclaude.bridge;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Lignes de texte restées en anglais en partie (jetons de Forge, qui n'ont pas de traduction, capacités données) :
 * mots-clés (« Flying, haste ») et phrases courantes des jetons (« {T}: Tap target creature. ») en français. Une ligne
 * inconnue reste telle quelle.
 */
final class EnglishLines {

    private EnglishLines() { }

    private static volatile Map<String, String> phrases;
    private static final Map<String, String> CACHE = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(final Map.Entry<String, String> eldest) {
            return size() > 400;
        }
    });

    /** Mots-clés anglais (les lignes de mots-clés n'ont pas les petits mots que French.looksEnglish cherche). */
    private static final java.util.regex.Pattern KEYWORDS = java.util.regex.Pattern.compile(
            "\\b(Flying|Haste|Trample|Vigilance|Defender|Lifelink|Menace|Deathtouch|Reach|Hexproof|Indestructible|First strike|"
            + "Double strike|Prowess|Changeling|Infect|Protection from|Ward|Toxic|Equip|Enchant|Shroud|Flash|Wither|Fear|Intimidation|"
            + "Shadow|Horsemanship|Flanking|Banding|Persist|Undying|Myriad|Annihilator|Afflict|Exalted|Forestwalk|Islandwalk|"
            + "Swampwalk|Mountainwalk|Plainswalk|Skulk|Decayed|Living weapon|Crew|Token)\\b");

    /** Phrases avec un nom de carte au milieu : motif anglais, remplacement français. */
    private static final Object[][] PATTERNS = {
        {java.util.regex.Pattern.compile("^You may have (.+) enter tapped as a copy of any land on the battlefield\\.?$"),
            "Vous pouvez faire que $1 arrive engagé en tant que copie de n'importe quel terrain sur le champ de bataille."},
        {java.util.regex.Pattern.compile("^You may have (.+) enter as a copy of any land on the battlefield\\.?$"),
            "Vous pouvez faire que $1 arrive en tant que copie de n'importe quel terrain sur le champ de bataille."},
        {java.util.regex.Pattern.compile("^You may have (.+) enter as a copy of any creature on the battlefield\\.?$"),
            "Vous pouvez faire que $1 arrive en tant que copie de n'importe quelle créature sur le champ de bataille."},
        {java.util.regex.Pattern.compile("^You may have (.+) enter as a copy of any artifact on the battlefield\\.?$"),
            "Vous pouvez faire que $1 arrive en tant que copie de n'importe quel artefact sur le champ de bataille."},
        {java.util.regex.Pattern.compile("^You may have (.+) enter as a copy of any enchantment on the battlefield\\.?$"),
            "Vous pouvez faire que $1 arrive en tant que copie de n'importe quel enchantement sur le champ de bataille."},
        // « You may cast Puissance du bouclier. » (aventure) : un nom de carte seulement, pas « spells as though… ».
        {java.util.regex.Pattern.compile("^You may cast (\\p{Lu}(?:(?! as | from | without | this | that | it\\b| them\\b|spells|cards).)*?)\\.?$"),
            "Vous pouvez lancer $1."},
    };

    /** « Draw a card. [Phase: IA 2] » : la note de Forge entre crochets, gardée à part. */
    private static final java.util.regex.Pattern NOTE = java.util.regex.Pattern.compile("^(.*?)(\\s*\\[[^\\]]*\\])$");

    private static boolean english(final String s) {
        return French.looksEnglish(s) || KEYWORDS.matcher(s).find();
    }

    private static String key(final String line) {
        return line.trim().replaceAll("\\s+", " ").replaceAll("[.]$", "").toLowerCase(Locale.ROOT);
    }

    private static Map<String, String> phrases() {
        Map<String, String> m = phrases;
        if (m == null) {
            m = new HashMap<>();
            try (InputStream in = EnglishLines.class.getResourceAsStream("token-texts-fr.txt")) {
                if (in != null) {
                    for (final String line : new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\n")) {
                        final int bar = line.indexOf('|');
                        if (bar > 0 && !line.startsWith("#")) {
                            m.put(key(line.substring(0, bar)), line.substring(bar + 1).trim());
                        }
                    }
                }
            } catch (final IOException | RuntimeException e) {
                System.err.println("Phrases des jetons illisibles : " + e.getMessage());
            }
            phrases = m;
        }
        return m;
    }

    /** Le texte, ses lignes anglaises connues en français. */
    static String translate(final String text) {
        if (text == null || text.isEmpty() || !english(text)) {
            return text;
        }
        final String hit = CACHE.get(text);
        if (hit != null) {
            return hit;
        }
        final String[] lines = text.split("\n", -1);
        final StringBuilder out = new StringBuilder(text.length());
        for (int i = 0; i < lines.length; i++) {
            if (i > 0) {
                out.append('\n');
            }
            final String line = lines[i];
            final String cr = line.endsWith("\r") ? "\r" : "";
            final String core = cr.isEmpty() ? line : line.substring(0, line.length() - 1);
            if (core.isBlank() || !english(core)) {
                out.append(line);
                continue;
            }
            final java.util.regex.Matcher note = NOTE.matcher(core);
            final String body = note.matches() ? note.group(1) : core;
            final String tail = note.matches() ? note.group(2) : "";
            String fr = phrases().get(key(body));
            if (fr != null) {
                fr = fr + tail;
            }
            for (int k = 0; fr == null && k < PATTERNS.length; k++) {
                final java.util.regex.Matcher pm = ((java.util.regex.Pattern) PATTERNS[k][0]).matcher(body.trim());
                if (pm.matches() && !French.looksEnglish(pm.group(1))) {
                    fr = pm.replaceFirst((String) PATTERNS[k][1]) + tail;
                }
            }
            if (fr == null) {
                // Mots-clés (« Flying, haste », « Toxic 1 ») : comme pour les cartes perso.
                // Seulement une ligne traduite en entier : « When this creature enters, choisissez l'un — » mêlerait
                // les deux langues, la ligne reste alors en anglais.
                final String kw = CustomCards.frenchText(core.trim());
                fr = kw != null && !kw.equals(core.trim()) && !French.looksEnglish(kw) ? kw : null;
            }
            out.append(fr == null ? line : fr + cr);
        }
        final String result = out.toString();
        CACHE.put(text, result);
        return result;
    }
}
