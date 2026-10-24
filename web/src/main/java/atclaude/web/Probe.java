package atclaude.web;

import forge.game.card.Card;
import forge.game.card.CardFactory;
import forge.game.keyword.Keyword;
import forge.game.keyword.KeywordInterface;
import forge.item.PaperCard;
import forge.model.FModel;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Method;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.Callable;

/**
 * Diagnostic de la version iPhone : rejoue pas à pas, hors partie, ce que fait Forge en créant une carte, et note
 * chaque erreur en entier (depuis la page : AT_WEB.probe()). Sert à comprendre ce que la machine Java du
 * navigateur fait autrement qu'une vraie JVM.
 */
final class Probe {

    private static final String ETB = "etbCounter:P1P1:X:no Condition:CARDNAME enters with X +1/+1 counters on it, "
            + "where X is the total toughness of other creatures you control.";

    private final StringBuilder out = new StringBuilder();

    static String run() {
        final Probe p = new Probe();
        p.steps();
        return p.out.toString();
    }

    private void steps() {
        step("concaténation", () -> "a" + 1 + "b" + 'c' + 2.5 + true);
        step("concaténation avec null", () -> {
            final String none = null;
            return "Error in Card " + "X" + " with Keyword " + none;
        });
        step("split", () -> String.join(" | ", ETB.split(":")));
        step("mot-clé", () -> {
            final KeywordInterface k = Keyword.getInstance(ETB);
            return k.getClass().getName() + " / " + k.getKeyword() + " / " + k.getOriginal();
        });
        step("corps de keywordsToText (etbCounter)", () -> replica(List.of(Keyword.getInstance(ETB))));
        for (final String name : new String[] {"Forest", "Llanowar Elves", "Serra Angel", "Towering Titan"}) {
            step("carte " + name, () -> {
                final PaperCard pc = FModel.getMagicDb().getCommonCards().getCard(name);
                if (pc == null) {
                    return "introuvable";
                }
                final Card c = CardFactory.getCard(pc, null, null);
                final StringBuilder kws = new StringBuilder();
                for (final KeywordInterface k : c.getKeywords()) {
                    kws.append('[').append(k.getOriginal()).append("] ");
                }
                return kws.append("→ ").append(c.getAbilityText().replace("\r\n", " / ")).toString();
            });
        }
        step("keywordsToText (réflexion)", () -> {
            final Card c = CardFactory.getCard(FModel.getMagicDb().getCommonCards().getCard("Forest"), null, null);
            final Method m = Card.class.getDeclaredMethod("keywordsToText", Collection.class);
            m.setAccessible(true);
            return m.invoke(c, List.of(Keyword.getInstance(ETB)));
        });
    }

    /** Ce que fait Card.keywordsToText pour un mot-clé etbCounter, sans le reste de la méthode. */
    private static String replica(final Collection<KeywordInterface> keywords) {
        final StringBuilder sb = new StringBuilder();
        final StringBuilder sbLong = new StringBuilder();
        int i = 0;
        for (final KeywordInterface inst : keywords) {
            final String keyword = inst.getOriginal();
            if (keyword.startsWith("etbCounter")) {
                final String[] p = keyword.split(":");
                final StringBuilder s = new StringBuilder();
                if (p.length > 4) {
                    if (!"no desc".equals(p[4])) {
                        s.append(p[4]);
                    }
                }
                sbLong.append(s).append("\r\n");
            }
            if (keyword.equals("Flash") || keyword.startsWith("Backup")) {
                sb.append("\r\n\r\n");
                i = 0;
            } else {
                i++;
            }
        }
        sb.append(sbLong);
        return sb.toString().trim() + " (" + i + ")";
    }

    private void step(final String label, final Callable<Object> body) {
        System.out.println("[sonde] " + label);
        out.append("== ").append(label).append(" : ");
        try {
            out.append(body.call());
        } catch (final Throwable t) {
            final StringWriter w = new StringWriter();
            t.printStackTrace(new PrintWriter(w));
            out.append("ÉCHEC\n").append(w);
        }
        out.append('\n');
    }
}
