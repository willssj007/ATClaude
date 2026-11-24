package atclaude.bridge;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.card.CardRules;
import forge.game.card.Card;
import forge.item.PaperCard;
import forge.model.FModel;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Vérification d'un paquet de données avant sa publication (.github/workflows/forge-data.yml) : la copie des ressources
 * est faite comme dans l'appli ({@link DataUpdates#buildMirror}), Forge y démarre, puis chaque nouvelle carte est lue et
 * créée avec toutes ses capacités (comme une carte de l'Atelier), chaque jeton et chaque édition doit être chargé, et
 * chaque deck préconstruit ne doit citer que des cartes connues. Le rapport liste ce qui ne passe pas : le paquet est
 * refait sans, puis vérifié de nouveau.
 *
 * Usage : DataCheck DOSSIER_RESSOURCES PAQUET.zip FICHE.json RAPPORT.json DOSSIER_DE_TRAVAIL
 */
public final class DataCheck {

    private DataCheck() { }

    public static void main(final String[] args) throws Exception {
        if (args.length < 5) {
            System.err.println("Usage : DataCheck DOSSIER_RESSOURCES PAQUET.zip FICHE.json RAPPORT.json DOSSIER_DE_TRAVAIL");
            System.exit(64);
        }
        final File assets = new File(args[0]);
        final File zip = new File(args[1]);
        final JsonObject fiche = JsonParser.parseString(read(new File(args[2]))).getAsJsonObject();
        final File reportFile = new File(args[3]);
        final File work = new File(args[4]);
        DataUpdates.deleteTree(work);
        final File mirror = new File(work, "forge");

        final JsonObject report = new JsonObject();
        final JsonArray bad = new JsonArray();
        report.add("bad", bad);
        int code = 0;
        try {
            final List<String> deleted = new ArrayList<>();
            if (fiche.has("deleted")) {
                for (final JsonElement e : fiche.getAsJsonArray("deleted")) {
                    deleted.add(e.getAsString());
                }
            }
            final long t0 = System.nanoTime();
            DataUpdates.buildMirror(assets, zip, deleted, mirror);
            report.addProperty("mirrorMs", (System.nanoTime() - t0) / 1_000_000);
            final JsonObject inside;
            try (ZipFile z = new ZipFile(zip)) {
                final ZipEntry e = z.getEntry("manifest.json");
                inside = JsonParser.parseString(read(z.getInputStream(e))).getAsJsonObject();
            }

            final Bridge bridge = new Bridge(json -> { });
            ForgeRuntime.init(bridge, new ForgeRuntime.Paths(mirror.getPath(), new File(work, "user").getPath(),
                    new File(work, "cache").getPath()), true);

            final File res = new File(mirror, "res");
            final Set<String> keywords = knownKeywords(new File(assets, "res/cardsfolder/cardsfolder.zip"));
            report.addProperty("cards", checkCards(inside, res, keywords, bad));
            report.addProperty("tokens", checkTokens(inside, bad));
            report.addProperty("editions", checkEditions(inside, bad));
            report.addProperty("precons", checkPrecons(inside, res, bad));
            report.addProperty("ok", bad.size() == 0);
        } catch (final Throwable e) {
            e.printStackTrace();
            report.addProperty("ok", false);
            report.addProperty("fatal", String.valueOf(e));
            code = 2;
        }
        Files.write(reportFile.toPath(), new GsonBuilder().setPrettyPrinting().create().toJson(report).getBytes(StandardCharsets.UTF_8));
        System.out.println("Vérification : " + (report.get("ok").getAsBoolean() ? "tout passe" : bad.size() + " refus"
                + (report.has("fatal") ? ", " + report.get("fatal").getAsString() : "")));
        System.exit(code);
    }

    private static void refuse(final JsonArray bad, final String kind, final String file, final String name, final String why) {
        final JsonObject o = new JsonObject();
        o.addProperty("kind", kind);
        o.addProperty("file", file);
        o.addProperty("name", name);
        o.addProperty("reason", why);
        bad.add(o);
        System.out.println("Refus (" + kind + ") " + file + " : " + why);
    }

    private static final Pattern API = Pattern.compile("\\b(?:AB|SP|DB)\\$\\s*([A-Za-z]+)");
    private static final Pattern MODE = Pattern.compile("\\bMode\\$\\s*([A-Za-z]+)");

    /** Les lignes « K: » des cartes de l'appli, entières et jusqu'au premier « : » : ce moteur les lit déjà. */
    static Set<String> knownKeywords(final File cardsZip) throws IOException {
        final Set<String> out = new HashSet<>();
        try (ZipFile z = new ZipFile(cardsZip)) {
            for (final Enumeration<? extends ZipEntry> en = z.entries(); en.hasMoreElements();) {
                final ZipEntry e = en.nextElement();
                if (e.isDirectory()) {
                    continue;
                }
                for (final String line : read(z.getInputStream(e)).split("\n")) {
                    final String t = line.trim();
                    if (t.startsWith("K:")) {
                        final String k = t.substring(2).trim();
                        out.add(k);
                        out.add(head(k));
                    }
                }
            }
        }
        return out;
    }

    private static String head(final String keyword) {
        final int colon = keyword.indexOf(':');
        return colon < 0 ? keyword : keyword.substring(0, colon);
    }

    /**
     * Ce que ce moteur accepterait sans rien dire mais ne saurait pas jouer : un effet, un déclencheur, une capacité
     * statique ou un mot-clé qu'il ne connaît pas (la capacité ne ferait rien). Un mot-clé déjà présent dans une carte de
     * l'appli est connu (Forge en lit plusieurs à part : coûts supplémentaires, attractions, autocollants...).
     */
    static void engineLint(final String script, final Set<String> keywords) {
        final String[] lines = script.replace("\r", "").split("\n");
        for (int i = 0; i < lines.length; i++) {
            final String line = lines[i].trim();
            final String where = " (ligne " + (i + 1) + ")";
            final Matcher api = API.matcher(line);
            while (api.find()) {
                try {
                    forge.game.ability.ApiType.smartValueOf(api.group(1));
                } catch (final RuntimeException e) {
                    throw new IllegalArgumentException("effet inconnu de ce moteur : " + api.group(1) + where);
                }
            }
            final Matcher mode = MODE.matcher(line);
            if (mode.find()) {
                try {
                    if (line.startsWith("T:")) {
                        forge.game.trigger.TriggerType.smartValueOf(mode.group(1));
                    } else if (line.startsWith("S:")) {
                        forge.game.staticability.StaticAbilityMode.smartValueOf(mode.group(1));
                    }
                } catch (final RuntimeException e) {
                    throw new IllegalArgumentException((line.startsWith("T:") ? "déclencheur" : "capacité statique")
                            + " inconnu(e) de ce moteur : " + mode.group(1) + where);
                }
            }
            if (line.startsWith("K:")) {
                final String k = line.substring(2).trim();
                if (!keywords.contains(k) && !keywords.contains(head(k))
                        && forge.game.keyword.Keyword.getInstance(k).getKeyword() == forge.game.keyword.Keyword.UNDEFINED) {
                    throw new IllegalArgumentException("mot-clé inconnu de ce moteur : " + k + where);
                }
            }
        }
    }

    private static int checkCards(final JsonObject inside, final File res, final Set<String> keywords, final JsonArray bad) throws IOException {
        int n = 0;
        for (final JsonElement e : list(inside, "cards")) {
            final JsonObject c = e.getAsJsonObject();
            final String file = c.get("file").getAsString();
            final String name = c.get("name").getAsString();
            n++;
            CardRules rules = FModel.getMagicDb().getCommonCards().getRules(name, false);
            PaperCard pc = rules == null ? null : FModel.getMagicDb().getCommonCards().getCard(name);
            if (rules == null) {
                rules = FModel.getMagicDb().getVariantCards().getRules(name, false);
                pc = rules == null ? null : FModel.getMagicDb().getVariantCards().getCard(name);
            }
            if (rules == null) {
                refuse(bad, "card", file, name, "script illisible par ce moteur");
                continue;
            }
            if (pc == null) {
                refuse(bad, "card", file, name, "dans aucune édition connue");
                continue;
            }
            try {
                engineLint(read(new File(res, file)), keywords);
            } catch (final IllegalArgumentException ex) {
                refuse(bad, "card", file, name, ex.getMessage());
                continue;
            }
            try {
                if (Card.fromPaperCard(pc, null) == null) {
                    refuse(bad, "card", file, name, "carte impossible à créer");
                }
            } catch (final Throwable ex) {
                refuse(bad, "card", file, name, "création refusée : " + ex);
            }
        }
        return n;
    }

    private static int checkTokens(final JsonObject inside, final JsonArray bad) {
        int n = 0;
        for (final JsonElement e : list(inside, "tokens")) {
            final String file = e.getAsString();
            final String script = new File(file).getName().replaceFirst("\\.txt$", "");
            n++;
            if (!FModel.getMagicDb().getAllTokens().containsRule(script)) {
                refuse(bad, "token", file, script, "jeton illisible par ce moteur");
            }
        }
        return n;
    }

    private static int checkEditions(final JsonObject inside, final JsonArray bad) {
        int n = 0;
        for (final JsonElement e : list(inside, "editions")) {
            final JsonObject ed = e.getAsJsonObject();
            final String code = ed.get("code").getAsString();
            n++;
            if (FModel.getMagicDb().getEditions().get(code) == null) {
                refuse(bad, "edition", ed.get("file").getAsString(), code, "édition non chargée");
            }
        }
        return n;
    }

    /** Chaque carte citée par un deck préconstruit (nouveau ou modifié) doit exister. */
    private static int checkPrecons(final JsonObject inside, final File res, final JsonArray bad) throws IOException {
        int n = 0;
        for (final JsonElement e : list(inside, "decks")) {
            final String file = e.getAsString();
            n++;
            final List<String> missing = new ArrayList<>();
            for (final String raw : read(new File(res, file)).split("\n")) {
                final String line = raw.trim();
                if (line.isEmpty() || line.startsWith("[") || line.contains("=") || line.startsWith("#")) {
                    continue;
                }
                String name = line.replaceFirst("^\\d+\\s+", "");
                final int bar = name.indexOf('|');
                if (bar >= 0) {
                    name = name.substring(0, bar);
                }
                name = name.trim();
                if (!name.isEmpty() && FModel.getMagicDb().getCommonCards().getCard(name) == null
                        && FModel.getMagicDb().getVariantCards().getCard(name) == null) {
                    missing.add(name);
                }
            }
            if (!missing.isEmpty()) {
                refuse(bad, "deck", file, new File(file).getName(), "cartes inconnues : " + String.join(", ", missing));
            }
        }
        return n;
    }

    private static JsonArray list(final JsonObject o, final String key) {
        return o.has(key) && o.get(key).isJsonArray() ? o.getAsJsonArray(key) : new JsonArray();
    }

    private static String read(final File f) throws IOException {
        return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
    }

    private static String read(final InputStream in) throws IOException {
        try (InputStream s = in) {
            final ByteArrayOutputStream out = new ByteArrayOutputStream();
            final byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = s.read(buf)) > 0) {
                out.write(buf, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
