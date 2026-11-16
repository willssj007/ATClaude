package atclaude.bridge;

import forge.util.Localizer;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.ResourceBundle;
import java.util.Set;

/**
 * Textes de l'interface de Forge mal traduits en français (« Supprimer 2 carte(s) » pour « Discard 2 card(s) ») :
 * ui-fr.txt les remplace, sans toucher aux fichiers de Forge. Le paquet de textes français de Forge est enveloppé :
 * une clé corrigée vient de ui-fr.txt, les autres de Forge.
 */
final class UiFrench {
    private UiFrench() {
    }

    static void apply() {
        final Map<String, String> fixes = read();
        if (fixes.isEmpty()) {
            return;
        }
        try {
            final Localizer loc = Localizer.getInstance();
            final Field f = Localizer.class.getDeclaredField("resourceBundle");
            f.setAccessible(true);
            final ResourceBundle base = (ResourceBundle) f.get(loc);
            // Le paquet de Forge s'appelle « fr-FR » (sa langue n'est pas renseignée) : on se fie à son nom.
            final String name = base == null ? null : base.getBaseBundleName();
            if (base == null || base instanceof Fixed || name == null || !name.startsWith("fr")) {
                return;
            }
            f.set(loc, new Fixed(base, fixes));
        } catch (final ReflectiveOperationException | RuntimeException e) {
            System.err.println("Textes de l'interface non corrigés : " + e);
        }
    }

    private static Map<String, String> read() {
        final Map<String, String> out = new HashMap<>();
        try (InputStream in = UiFrench.class.getResourceAsStream("ui-fr.txt")) {
            if (in == null) {
                return out;
            }
            for (final String line : new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\n")) {
                final int bar = line.indexOf('|');
                if (line.startsWith("#") || bar <= 0) {
                    continue;
                }
                out.put(line.substring(0, bar).trim(), line.substring(bar + 1).replace("\r", ""));
            }
        } catch (final IOException e) {
            System.err.println("ui-fr.txt illisible : " + e.getMessage());
        }
        return out;
    }

    /** Le paquet de Forge, avec les textes corrigés devant. */
    private static final class Fixed extends ResourceBundle {
        private final Map<String, String> fixes;

        Fixed(final ResourceBundle base, final Map<String, String> fixes) {
            this.fixes = fixes;
            setParent(base);
        }

        @Override
        protected Object handleGetObject(final String key) {
            return fixes.get(key);
        }

        @Override
        public Enumeration<String> getKeys() {
            final Set<String> keys = new LinkedHashSet<>(fixes.keySet());
            keys.addAll(Collections.list(parent.getKeys()));
            return Collections.enumeration(keys);
        }

        @Override
        public java.util.Locale getLocale() {
            return parent.getLocale();
        }
    }
}
