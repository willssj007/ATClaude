package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forge.card.CardEdition;
import forge.card.CardRules;
import forge.card.ICardFace;
import forge.gui.GuiBase;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgeConstants;
import forge.model.FModel;
import forge.util.CardTranslation;
import forge.util.ScryfallRateLimiter;

import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Texte français des cartes récentes. Le fichier de traductions de Forge s'arrête aux extensions qu'il connaissait :
 * les cartes plus récentes restaient en anglais (nom, type et texte). On prend leur impression française sur Scryfall
 * (nom, ligne de type et texte imprimés), extension par extension, et on la garde dans un cache sur l'appareil ; elle
 * rejoint les traductions de Forge, si bien que le catalogue, la partie et la pile l'utilisent comme les autres.
 */
final class FrenchCards {

    private FrenchCards() { }

    private static final String API = System.getProperty("atclaude.scryfallApi", "https://api.scryfall.com/");
    /** Une extension sans impression française n'est redemandée qu'au bout d'une semaine. */
    private static final long RETRY = 7L * 24 * 3600 * 1000;
    /** Au plus une mise à jour par jour (sauf demande depuis les réglages). */
    private static final long DAILY = 24L * 3600 * 1000;
    private static final int MAX_SETS = 40;

    /** Nom anglais d'une face → [nom, type, texte] en français. */
    private static final Map<String, String[]> CARDS = new LinkedHashMap<>();
    /** Code Scryfall d'une extension → date de la dernière demande. */
    private static final Map<String, Long> SETS = new HashMap<>();
    private static long lastRun;
    private static volatile boolean running;
    private static volatile String status = "";

    private static File file() {
        return new File(ForgeConstants.USER_DIR, "atclaude-fr.json");
    }

    // ------------------------------------------------------------------ cache et traductions de Forge

    /** Au démarrage : le cache rejoint les traductions de Forge. */
    static synchronized void init() {
        final File f = file();
        if (!f.isFile()) {
            return;
        }
        try {
            final JsonObject o = JsonParser.parseString(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8)).getAsJsonObject();
            if (o.has("cards")) {
                for (final Map.Entry<String, JsonElement> e : o.getAsJsonObject("cards").entrySet()) {
                    final JsonArray a = e.getValue().getAsJsonArray();
                    CARDS.put(e.getKey(), new String[]{a.get(0).getAsString(), a.get(1).getAsString(), a.get(2).getAsString()});
                }
            }
            if (o.has("sets")) {
                for (final Map.Entry<String, JsonElement> e : o.getAsJsonObject("sets").entrySet()) {
                    SETS.put(e.getKey(), e.getValue().getAsLong());
                }
            }
            lastRun = o.has("at") ? o.get("at").getAsLong() : 0;
        } catch (final IOException | RuntimeException e) {
            System.err.println("Cache des textes français illisible : " + e.getMessage());
        }
        inject(CARDS);
    }

    private static synchronized void save() {
        final JsonObject o = new JsonObject();
        o.addProperty("at", lastRun);
        final JsonObject cards = new JsonObject();
        for (final Map.Entry<String, String[]> e : CARDS.entrySet()) {
            final JsonArray a = new JsonArray();
            for (final String s : e.getValue()) {
                a.add(s);
            }
            cards.add(e.getKey(), a);
        }
        o.add("cards", cards);
        final JsonObject sets = new JsonObject();
        SETS.forEach(sets::addProperty);
        o.add("sets", sets);
        try {
            Files.write(file().toPath(), o.toString().getBytes(StandardCharsets.UTF_8));
        } catch (final IOException e) {
            System.err.println("Cache des textes français non enregistré : " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> forgeMap(final String field) {
        try {
            final java.lang.reflect.Field f = CardTranslation.class.getDeclaredField(field);
            f.setAccessible(true);
            return (Map<String, String>) f.get(null);
        } catch (final ReflectiveOperationException | RuntimeException e) {
            return null;
        }
    }

    /** Ajoute ces traductions à celles de Forge (sans remplacer celles qu'il a déjà). */
    private static int inject(final Map<String, String[]> cards) {
        final Map<String, String> names = forgeMap("translatednames");
        final Map<String, String> types = forgeMap("translatedtypes");
        final Map<String, String> oracles = forgeMap("translatedoracles");
        if (names == null || types == null || oracles == null) {
            return 0;
        }
        int n = 0;
        synchronized (names) {
            for (final Map.Entry<String, String[]> e : cards.entrySet()) {
                final String en = e.getKey();
                final String[] fr = e.getValue();
                if (names.containsKey(en) && !names.get(en).isEmpty()) {
                    continue;
                }
                names.put(en, fr[0]);
                if (!fr[1].isEmpty()) {
                    types.put(en, fr[1]);
                }
                if (!fr[2].isEmpty()) {
                    oracles.put(en, fr[2].replace("\n", "\r\n\r\n"));
                }
                n++;
            }
        }
        return n;
    }

    /** Forge a-t-il déjà le nom français de cette face ? */
    private static boolean known(final Map<String, String> names, final String en) {
        final String fr = names.get(en);
        return fr != null && !fr.isEmpty();
    }

    // ------------------------------------------------------------------ mise à jour depuis Scryfall

    static JsonObject status() {
        final JsonObject o = new JsonObject();
        o.addProperty("cards", CARDS.size());
        o.addProperty("running", running);
        o.addProperty("status", status);
        o.addProperty("at", lastRun);
        return o;
    }

    /**
     * Cherche en tâche de fond les textes français qui manquent (au plus une fois par jour, sauf {@code force}).
     * {@code done} est appelé à la fin si de nouvelles cartes ont été traduites.
     */
    static synchronized JsonObject refresh(final boolean force, final Runnable done) {
        if (running || !force && System.currentTimeMillis() - lastRun < DAILY) {
            return status();
        }
        running = true;
        status = "Recherche des cartes sans texte français…";
        final Thread t = new Thread(() -> {
            int added = 0;
            try {
                added = run(force);
            } catch (final RuntimeException e) {
                status = "Interrompu : " + e.getMessage();
            } finally {
                running = false;
            }
            if (added > 0 && done != null) {
                done.run();
            }
        }, "atclaude-fr");
        t.setDaemon(true);
        t.start();
        return status();
    }

    /** Les extensions (code Scryfall) des cartes sans nom français, de la plus fournie à la moins fournie. */
    private static List<String> missingSets(final boolean force) {
        final Map<String, String> names = forgeMap("translatednames");
        if (names == null) {
            return List.of();
        }
        final Map<String, Integer> count = new HashMap<>();
        final long now = System.currentTimeMillis();
        for (final PaperCard pc : FModel.getMagicDb().getCommonCards().getUniqueCards()) {
            final CardRules r = pc.getRules();
            if (r == null || CustomCards.isCustom(pc.getName()) || r.getType().isBasicLand() || known(names, r.getName())
                    || r.getMainPart() != null && known(names, r.getMainPart().getName())) {
                continue;
            }
            final Set<String> seen = new java.util.HashSet<>();
            for (final PaperCard print : FModel.getMagicDb().getCommonCards().getAllCards(pc.getName())) {
                final CardEdition ed = FModel.getMagicDb().getEditions().get(print.getEdition());
                if (ed == null || ed.getType() == CardEdition.Type.ONLINE || ed.getType() == CardEdition.Type.FUNNY || ed.getType() == CardEdition.Type.CUSTOM_SET) {
                    continue;
                }
                final String code = ed.getScryfallCode();
                if (code != null && !code.isEmpty() && seen.add(code)) {
                    count.merge(code, 1, Integer::sum);
                }
            }
        }
        final List<String> out = new ArrayList<>(count.keySet());
        out.removeIf(c -> !force && SETS.containsKey(c) && now - SETS.get(c) < RETRY);
        out.sort((a, b) -> count.get(b) - count.get(a));
        return out.size() > MAX_SETS ? out.subList(0, MAX_SETS) : out;
    }

    private static int run(final boolean force) {
        final List<String> sets = missingSets(force);
        final Map<String, String> names = forgeMap("translatednames");
        final Map<String, String[]> found = new LinkedHashMap<>();
        int i = 0;
        for (final String code : sets) {
            i++;
            status = "Extension " + code.toUpperCase(Locale.ROOT) + " (" + i + "/" + sets.size() + ")…";
            try {
                fetchSet(code, names, found);
                SETS.put(code, System.currentTimeMillis());
            } catch (final IOException e) {
                status = "Scryfall injoignable : " + e.getMessage();
                break;
            }
        }
        final int added;
        synchronized (FrenchCards.class) {
            CARDS.putAll(found);
            added = inject(found);
            lastRun = System.currentTimeMillis();
            save();
        }
        status = added > 0 ? added + " carte(s) traduite(s)." : "Rien de nouveau.";
        return added;
    }

    /** Les impressions françaises d'une extension (toutes les pages de la recherche). */
    private static void fetchSet(final String code, final Map<String, String> names, final Map<String, String[]> found) throws IOException {
        String url = API + "cards/search?unique=prints&include_extras=true&q="
                + URLEncoder.encode("set:" + code + " lang:fr", "UTF-8");
        for (int page = 0; url != null && page < 12; page++) {
            final JsonObject o = get(url);
            if (o == null || !o.has("data")) {
                return; // aucune carte française dans cette extension
            }
            for (final JsonElement e : o.getAsJsonArray("data")) {
                addCard(e.getAsJsonObject(), names, found);
            }
            url = o.has("has_more") && o.get("has_more").getAsBoolean() && o.has("next_page") ? o.get("next_page").getAsString() : null;
        }
    }

    private static String str(final JsonObject o, final String k) {
        return o.has(k) && o.get(k).isJsonPrimitive() ? o.get(k).getAsString() : "";
    }

    /** Une carte française de Scryfall : chacune de ses faces (recto, verso, aventure…) qui manque à Forge. */
    private static void addCard(final JsonObject c, final Map<String, String> names, final Map<String, String[]> found) {
        if (!"fr".equals(str(c, "lang"))) {
            return;
        }
        final List<JsonObject> faces = new ArrayList<>();
        if (c.has("card_faces") && c.get("card_faces").isJsonArray()) {
            c.getAsJsonArray("card_faces").forEach(f -> faces.add(f.getAsJsonObject()));
        } else {
            faces.add(c);
        }
        for (final JsonObject f : faces) {
            final String en = str(f, "name");
            final String nameFr = str(f, "printed_name");
            if (en.isEmpty() || nameFr.isEmpty() || nameFr.equals(en) && str(f, "printed_text").isEmpty()
                    || names != null && known(names, en) || found.containsKey(en)) {
                continue;
            }
            found.put(en, new String[]{nameFr, str(f, "printed_type_line"), str(f, "printed_text")});
        }
    }

    private static JsonObject get(final String url) throws IOException {
        if (ScryfallRateLimiter.shouldSkip(url)) {
            throw new IOException("Scryfall en pause après trop de demandes");
        }
        ScryfallRateLimiter.acquire(url);
        final HttpURLConnection c = Net.open(url);
        c.setRequestProperty("User-Agent", GuiBase.getInterface().getUserAgent());
        c.setRequestProperty("Accept", "application/json");
        c.setConnectTimeout(10_000);
        c.setReadTimeout(30_000);
        final int code = c.getResponseCode();
        if (code == 404 || code == 400) {
            c.disconnect();
            return null;
        }
        if (code != 200) {
            ScryfallRateLimiter.noteIfRateLimited(code, url, c.getHeaderField("Retry-After"));
            c.disconnect();
            throw new IOException("Scryfall a répondu " + code);
        }
        try (Reader r = new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8)) {
            return JsonParser.parseReader(r).getAsJsonObject();
        }
    }

    /** Le texte français connu par ce cache (pour les tests). */
    static String[] get(final ICardFace face) {
        return face == null ? null : CARDS.get(face.getName());
    }
}
