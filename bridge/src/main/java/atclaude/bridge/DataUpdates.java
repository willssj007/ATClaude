package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Reader;
import java.io.Writer;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.function.Consumer;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Nouvelles cartes, éditions, decks préconstruits, jetons et formats de Forge sans nouvelle version de l'appli.
 *
 * Chaque jour, .github/workflows/forge-data.yml compare le dernier Forge à celui de l'appli, vérifie les nouvelles cartes
 * avec le moteur de l'appli (voir {@link DataCheck}) et publie un petit paquet (les fichiers qui changent) avec sa fiche,
 * pour chaque base de cartes. Au démarrage, rien ne se télécharge : si un paquet a été préparé lors d'un lancement
 * précédent, Forge lit une copie de ses ressources où il est déjà appliqué (le choix ne coûte que la lecture de deux
 * petits fichiers). Après le démarrage, en tâche de fond, l'appli lit la fiche du dernier paquet, le télécharge s'il est
 * nouveau, et prépare la copie pour le lancement suivant.
 *
 * Seuls des fichiers de java.io servent ici : l'iPhone n'a qu'un java.nio.file minimal.
 */
public final class DataUpdates {

    /** Version du format des paquets que l'appli sait appliquer. */
    static final int FORMAT = 1;
    static final String RES_PROPS = "atclaude-res.properties";
    private static final String DEFAULT_URL = "https://github.com/willssj007/atclaude/releases/download/forge-data/";
    /** Fichiers des données en cours d'utilisation, et du dernier paquet préparé. */
    private static final String CURRENT = "current.properties";
    /** Écrit avant le démarrage de Forge avec une copie, effacé une fois Forge prêt : un démarrage qui n'aboutit pas le laisse. */
    private static final String LAUNCHING = "launching";
    private static final String READY = "ready.properties";

    private static volatile File root;
    private static volatile File baseAssets;
    /** Les ressources de l'appli (null : ressources de développement, sans fiche, donc sans mises à jour). */
    private static volatile Properties base;
    /** Les données utilisées par ce lancement (null : celles de l'appli). */
    private static volatile Properties active;
    private static volatile String activeDir = "";
    private static volatile boolean announce;
    private static volatile boolean running;
    private static volatile long lastCheck;
    private static volatile String status = "";

    private DataUpdates() { }

    static String url() {
        final String u = System.getProperty("atclaude.dataUrl", DEFAULT_URL);
        return u.endsWith("/") ? u : u + "/";
    }

    // ------------------------------------------------------------------ au démarrage

    /**
     * Le dossier des ressources que Forge doit lire : celui de l'appli, ou la copie où le dernier paquet préparé est
     * appliqué. Appelé une fois, avant le démarrage de Forge.
     */
    public static synchronized String select(final String assetsDir, final String cacheDir) {
        baseAssets = new File(assetsDir);
        root = new File(cacheDir, "forge-data");
        base = read(new File(baseAssets, "res" + File.separator + RES_PROPS));
        if (base == null || prop(base, "forge").length() < 12) {
            return assetsDir;
        }
        final Properties cur = read(new File(root, CURRENT));
        if (cur == null || !matchesBase(cur) || prop(cur, "dir").isEmpty()) {
            return assetsDir;
        }
        final File dir = new File(root, prop(cur, "dir"));
        if (!new File(dir, READY).isFile() || !new File(dir, "res" + File.separator + "cardsfolder").isDirectory()) {
            return assetsDir;
        }
        final File launching = new File(root, LAUNCHING);
        if (launching.isFile()) {
            // Le lancement précédent avec ces données n'a pas fini de démarrer (appli fermée pendant le chargement, ou
            // plantage) : un second échec d'affilée les écarte, et l'appli repart avec ses propres cartes.
            final int fails = intProp(cur, "fails") + 1;
            cur.setProperty("fails", String.valueOf(fails));
            if (fails >= 2) {
                discard(cur, "Les nouvelles cartes du " + day(prop(cur, "forgeDate"))
                        + " ont été écartées : Forge n'a pas pu démarrer avec elles. Le prochain paquet sera essayé.");
                launching.delete();
                return assetsDir;
            }
            write(cur, new File(root, CURRENT));
        }
        try {
            writeText(launching, prop(cur, "dir"));
        } catch (final IOException e) {
            // pas de garde-fou possible : les ressources de l'appli, plus sûres
            return assetsDir;
        }
        active = cur;
        activeDir = prop(cur, "dir");
        announce = !prop(cur, "forge").equals(prop(cur, "announced"));
        return dir.getPath();
    }

    /** Forge a démarré : les données choisies au démarrage sont bonnes. */
    static synchronized void launched() {
        if (root == null || active == null) {
            return;
        }
        new File(root, LAUNCHING).delete();
        final Properties cur = read(new File(root, CURRENT));
        if (cur != null && activeDir.equals(prop(cur, "dir")) && intProp(cur, "fails") > 0) {
            cur.setProperty("fails", "0");
            write(cur, new File(root, CURRENT));
        }
    }

    /** Forge n'a pas pu démarrer avec la copie : le prochain lancement reprendra les ressources de l'appli. */
    static synchronized void failed() {
        if (root == null || active == null) {
            return;
        }
        new File(root, LAUNCHING).delete();
        final Properties cur = read(new File(root, CURRENT));
        if (cur != null && activeDir.equals(prop(cur, "dir"))) {
            discard(cur, "Les nouvelles cartes ont été écartées : Forge n'a pas pu démarrer avec elles.");
        }
    }

    private static void discard(final Properties cur, final String why) {
        cur.setProperty("bad", prop(cur, "forge"));
        cur.setProperty("dir", "");
        cur.setProperty("fails", "0");
        write(cur, new File(root, CURRENT));
        status = why;
    }

    /**
     * L'empreinte des données de cartes de ce lancement (ressources de l'appli et paquet appliqué) : les calculs gardés
     * sur le disque (analyse des préconstruits...) sont refaits quand elle change.
     */
    static String id() {
        final Properties b = base;
        final Properties a = active;
        return (b == null ? "dev" : prop(b, "id")) + (a == null ? "" : "+" + prop(a, "forge"));
    }

    private static boolean matchesBase(final Properties p) {
        return base != null && prop(p, "base").equals(prop(base, "forge")) && prop(p, "baseId").equals(prop(base, "id"));
    }

    // ------------------------------------------------------------------ état (Réglages)

    static JsonObject status() {
        final JsonObject o = new JsonObject();
        final Properties b = base;
        o.addProperty("supported", b != null);
        o.addProperty("running", running);
        o.addProperty("status", status);
        o.addProperty("at", lastCheck);
        o.addProperty("baseDate", b == null ? "" : prop(b, "date"));
        final Properties a = active;
        if (a != null) {
            o.add("active", summary(a));
        }
        final Properties cur = root == null ? null : read(new File(root, CURRENT));
        if (cur != null && matchesBase(cur) && !prop(cur, "dir").isEmpty() && !prop(cur, "dir").equals(activeDir)
                && new File(new File(root, prop(cur, "dir")), READY).isFile()) {
            o.add("pending", summary(cur));
        }
        if (announce && a != null) {
            // Une seule fois : le premier lancement avec ces nouvelles cartes.
            o.addProperty("announce", true);
            announce = false;
            synchronized (DataUpdates.class) {
                final Properties c = read(new File(root, CURRENT));
                if (c != null) {
                    c.setProperty("announced", prop(a, "forge"));
                    write(c, new File(root, CURRENT));
                }
            }
        }
        return o;
    }

    private static JsonObject summary(final Properties p) {
        final JsonObject o = new JsonObject();
        o.addProperty("forgeDate", prop(p, "forgeDate"));
        o.addProperty("cards", intProp(p, "cards"));
        o.addProperty("editions", intProp(p, "editions"));
        o.addProperty("precons", intProp(p, "precons"));
        o.addProperty("tokens", intProp(p, "tokens"));
        o.add("editionNames", names(prop(p, "editionNames")));
        o.add("preconNames", names(prop(p, "preconNames")));
        return o;
    }

    private static JsonArray names(final String joined) {
        final JsonArray a = new JsonArray();
        for (final String s : joined.split("\n")) {
            if (!s.trim().isEmpty()) {
                a.add(s.trim());
            }
        }
        return a;
    }

    // ------------------------------------------------------------------ vérification en tâche de fond

    /**
     * Lit la fiche du dernier paquet ; s'il est nouveau, le télécharge et prépare la copie des ressources pour le
     * prochain lancement. En tâche de fond, à la priorité la plus basse ; {@code done} reçoit l'état à la fin.
     */
    static synchronized JsonObject check(final Consumer<JsonObject> done) {
        if (running || base == null || root == null) {
            if (base == null && root != null) {
                status = "Mises à jour des cartes indisponibles avec ces ressources (version de développement).";
            }
            return status();
        }
        running = true;
        status = "Recherche de nouvelles cartes…";
        final Thread t = new Thread(() -> {
            boolean staged = false;
            try {
                staged = run();
            } catch (final java.net.UnknownHostException | java.net.ConnectException | java.net.SocketTimeoutException e) {
                status = "Pas de connexion : nouvelle vérification au prochain lancement.";
            } catch (final IOException | RuntimeException e) {
                status = "Vérification impossible pour l'instant : " + (e.getMessage() == null ? e.toString() : e.getMessage()) + ".";
            } finally {
                lastCheck = System.currentTimeMillis();
                running = false;
            }
            if (done != null) {
                final JsonObject st = status();
                st.addProperty("staged", staged);
                done.accept(st);
            }
        }, "atclaude-data");
        t.setDaemon(true);
        t.setPriority(Thread.MIN_PRIORITY);
        t.start();
        return status();
    }

    /** Vrai si un nouveau paquet vient d'être préparé. */
    private static boolean run() throws IOException {
        final String baseForge = prop(base, "forge");
        final Properties cur = read(new File(root, CURRENT));
        // Les copies qui ne servent plus (écartées, remplacées, faites pour une ancienne version de l'appli) : seules
        // celle du prochain lancement et celle en service restent.
        cleanup(cur != null && matchesBase(cur) ? prop(cur, "dir") : "");
        final JsonObject m;
        try {
            m = JsonParser.parseString(getText(url() + "manifest-" + baseForge.substring(0, 12) + ".json")).getAsJsonObject();
        } catch (final NotFound e) {
            status = "À jour : pas encore de nouvelles cartes pour cette version de l'appli.";
            return false;
        }
        if (num(m, "format") > FORMAT) {
            status = "Nouvelles cartes publiées pour une version plus récente de l'appli : mets-la à jour pour les avoir.";
            return false;
        }
        if (!baseForge.equals(str(m, "base"))) {
            throw new IOException("paquet prévu pour une autre base de cartes");
        }
        final String forge = str(m, "forge");
        if (forge.length() < 12 || forge.equals(baseForge)) {
            status = "À jour.";
            return false;
        }
        if (cur != null && forge.equals(prop(cur, "bad"))) {
            status = "Les dernières nouvelles cartes ont été écartées (Forge n'a pas pu démarrer avec elles) : le prochain paquet sera essayé.";
            return false;
        }
        if (cur != null && matchesBase(cur) && forge.equals(prop(cur, "forge")) && !prop(cur, "dir").isEmpty()
                && new File(new File(root, prop(cur, "dir")), READY).isFile()) {
            status = prop(cur, "dir").equals(activeDir) ? "À jour." : "Nouvelles cartes prêtes : elles arrivent au prochain lancement de l'appli.";
            return false;
        }

        root.mkdirs();
        final String forge12 = forge.substring(0, 12);
        final File zip = new File(root, "paquet.zip");
        status = "Téléchargement des nouvelles cartes…";
        download(url() + str(m, "zip"), zip, num(m, "size"));
        try {
            final String sha = str(m, "sha256");
            final String got = sha256(zip);
            if (got != null && !sha.isEmpty() && !sha.equalsIgnoreCase(got)) {
                throw new IOException("paquet abîmé (empreinte différente)");
            }
            final List<String> deleted = new ArrayList<>();
            if (m.has("deleted") && m.get("deleted").isJsonArray()) {
                for (final JsonElement e : m.getAsJsonArray("deleted")) {
                    deleted.add(e.getAsString());
                }
            }
            status = "Préparation des nouvelles cartes…";
            final File build = new File(root, "build-" + forge12);
            deleteTree(build);
            buildMirror(baseAssets, zip, deleted, build);

            final JsonObject sum = m.has("summary") ? m.getAsJsonObject("summary") : new JsonObject();
            final Properties p = new Properties();
            p.setProperty("base", baseForge);
            p.setProperty("baseId", prop(base, "id"));
            p.setProperty("forge", forge);
            p.setProperty("forgeDate", str(m, "forgeDate"));
            for (final String k : new String[] {"cards", "editions", "precons", "tokens"}) {
                p.setProperty(k, String.valueOf(num(sum, k)));
            }
            p.setProperty("editionNames", joined(sum, "editionNames"));
            p.setProperty("preconNames", joined(sum, "preconNames"));
            write(p, new File(build, READY));

            final String name = "m-" + forge12 + "-" + prop(base, "id").substring(0, Math.min(8, prop(base, "id").length()));
            final File dir = new File(root, name);
            if (name.equals(activeDir)) {
                // Le même paquet que celui en service (refait après un échec) : rien à remplacer.
                deleteTree(build);
            } else {
                deleteTree(dir);
                if (!build.renameTo(dir)) {
                    throw new IOException("copie des ressources impossible à mettre en place");
                }
            }
            p.setProperty("dir", name);
            if (cur != null) {
                p.setProperty("announced", prop(cur, "announced"));
            }
            synchronized (DataUpdates.class) {
                write(p, new File(root, CURRENT));
            }
            cleanup(name);
            status = "Nouvelles cartes prêtes : elles arrivent au prochain lancement de l'appli.";
            return true;
        } finally {
            zip.delete();
        }
    }

    /** Efface les anciennes copies (sauf celle que Forge lit en ce moment, encore ouverte). */
    private static void cleanup(final String keep) {
        final File[] children = root.isDirectory() ? root.listFiles() : null;
        if (children == null) {
            return;
        }
        for (final File f : children) {
            if (f.isDirectory() && !f.getName().equals(keep) && !f.getName().equals(activeDir)) {
                deleteTree(f);
            }
        }
    }

    private static String joined(final JsonObject o, final String key) {
        final StringBuilder sb = new StringBuilder();
        if (o.has(key) && o.get(key).isJsonArray()) {
            for (final JsonElement e : o.getAsJsonArray(key)) {
                sb.append(e.getAsString().replace('\n', ' ')).append('\n');
            }
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ copie des ressources avec le paquet appliqué

    /**
     * Copie les ressources de l'appli ({@code assets}/res) dans {@code target}/res, puis y écrit les fichiers du paquet
     * (entrées « res/... » du zip) et efface ceux qu'il retire. Sert aussi à la vérification des paquets ({@link DataCheck}).
     */
    static void buildMirror(final File assets, final File zip, final List<String> deleted, final File target) throws IOException {
        final File src = new File(assets, "res");
        final File dst = new File(target, "res");
        final byte[] buf = new byte[64 * 1024];
        copyTree(src, dst, buf);
        final String dstPath = dst.getCanonicalPath() + File.separator;
        int files = 0;
        try (ZipInputStream in = new ZipInputStream(new BufferedInputStream(new FileInputStream(zip), 64 * 1024))) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                final String n = e.getName().replace('\\', '/');
                if (e.isDirectory() || !n.startsWith("res/") || n.equals("res/" + RES_PROPS) || n.equals("res/cardsfolder/cardsfolder.zip")) {
                    continue;
                }
                final File out = new File(dst, n.substring(4));
                if (!out.getCanonicalPath().startsWith(dstPath)) {
                    throw new IOException("fichier suspect dans le paquet : " + n);
                }
                out.getParentFile().mkdirs();
                try (OutputStream os = new BufferedOutputStream(new FileOutputStream(out), 64 * 1024)) {
                    int r;
                    while ((r = in.read(buf)) > 0) {
                        os.write(buf, 0, r);
                    }
                }
                files++;
            }
        }
        if (files == 0) {
            throw new IOException("paquet vide");
        }
        for (final String d : deleted) {
            final String n = d.replace('\\', '/');
            final File f = new File(dst, n);
            if (n.startsWith("cardsfolder/") || n.equals(RES_PROPS) || !f.getCanonicalPath().startsWith(dstPath)) {
                continue;
            }
            f.delete();
        }
    }

    private static void copyTree(final File src, final File dst, final byte[] buf) throws IOException {
        final File[] children = src.listFiles();
        if (children == null) {
            throw new IOException("ressources illisibles : " + src);
        }
        dst.mkdirs();
        for (final File c : children) {
            final File d = new File(dst, c.getName());
            if (c.isDirectory()) {
                copyTree(c, d, buf);
            } else {
                try (InputStream in = new FileInputStream(c); OutputStream out = new FileOutputStream(d)) {
                    int r;
                    while ((r = in.read(buf)) > 0) {
                        out.write(buf, 0, r);
                    }
                }
            }
        }
    }

    static void deleteTree(final File f) {
        final File[] children = f.listFiles();
        if (children != null) {
            for (final File c : children) {
                deleteTree(c);
            }
        }
        f.delete();
    }

    // ------------------------------------------------------------------ réseau

    private static final class NotFound extends IOException {
        NotFound() {
            super("introuvable");
        }
    }

    /** Ouvre l'adresse en suivant les renvois (GitHub renvoie les fichiers des versions vers son stockage). */
    private static HttpURLConnection open(final String url) throws IOException {
        HttpURLConnection c = connect(url);
        for (int hop = 0; hop < 5 && c.getResponseCode() / 100 == 3; hop++) {
            final String next = c.getHeaderField("Location");
            c.disconnect();
            if (next == null) {
                throw new IOException("renvoi sans adresse");
            }
            c = connect(next);
        }
        final int code = c.getResponseCode();
        if (code == 404) {
            c.disconnect();
            throw new NotFound();
        }
        if (code != 200) {
            c.disconnect();
            throw new IOException("le serveur répond " + code);
        }
        return c;
    }

    private static HttpURLConnection connect(final String url) throws IOException {
        final HttpURLConnection c = Net.open(url);
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(15_000);
        c.setReadTimeout(30_000);
        c.setRequestProperty("User-Agent", "ArcaneTable");
        return c;
    }

    private static String getText(final String url) throws IOException {
        final HttpURLConnection c = open(url);
        try (InputStream in = c.getInputStream()) {
            final ByteArrayOutputStream all = new ByteArrayOutputStream();
            final byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                all.write(buf, 0, n);
                if (all.size() > 4 * 1024 * 1024) {
                    throw new IOException("fiche trop grande");
                }
            }
            return new String(all.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            c.disconnect();
        }
    }

    private static void download(final String url, final File out, final long size) throws IOException {
        final HttpURLConnection c = open(url);
        final File part = new File(out.getPath() + ".part");
        long done = 0;
        try (InputStream in = c.getInputStream(); OutputStream os = new BufferedOutputStream(new FileOutputStream(part), 64 * 1024)) {
            final byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                os.write(buf, 0, n);
                done += n;
                if (size > 0 && done > size) {
                    throw new IOException("paquet plus gros qu'annoncé");
                }
            }
        } finally {
            c.disconnect();
        }
        if (size > 0 && done != size) {
            part.delete();
            throw new IOException("téléchargement incomplet");
        }
        out.delete();
        if (!part.renameTo(out)) {
            throw new IOException("paquet impossible à enregistrer");
        }
    }

    /** L'empreinte SHA-256 du fichier, ou null si l'appareil ne sait pas la calculer (les CRC du zip restent vérifiés). */
    private static String sha256(final File f) throws IOException {
        final MessageDigest md;
        try {
            md = MessageDigest.getInstance("SHA-256");
        } catch (final NoSuchAlgorithmException e) {
            return null;
        }
        try (InputStream in = new FileInputStream(f)) {
            final byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                md.update(buf, 0, n);
            }
        }
        final StringBuilder sb = new StringBuilder();
        for (final byte b : md.digest()) {
            sb.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ petits fichiers

    static Properties read(final File f) {
        if (!f.isFile()) {
            return null;
        }
        try (Reader r = new InputStreamReader(new FileInputStream(f), StandardCharsets.UTF_8)) {
            final Properties p = new Properties();
            p.load(r);
            return p;
        } catch (final IOException | IllegalArgumentException e) {
            return null;
        }
    }

    /** Écrit à côté puis remplace : un fichier à moitié écrit ne remplace jamais le bon. */
    private static void write(final Properties p, final File f) {
        final File tmp = new File(f.getPath() + ".tmp");
        try {
            f.getParentFile().mkdirs();
            try (Writer w = new OutputStreamWriter(new FileOutputStream(tmp), StandardCharsets.UTF_8)) {
                p.store(w, null);
            }
            if (!tmp.renameTo(f)) {
                // Windows ne remplace pas un fichier existant en le renommant.
                f.delete();
                if (!tmp.renameTo(f)) {
                    throw new IOException("renommage impossible");
                }
            }
        } catch (final IOException e) {
            tmp.delete();
            System.err.println("Données de cartes : " + f.getName() + " non enregistré (" + e.getMessage() + ")");
        }
    }

    private static void writeText(final File f, final String text) throws IOException {
        f.getParentFile().mkdirs();
        try (OutputStream out = new FileOutputStream(f)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
        }
    }

    static String prop(final Properties p, final String k) {
        final String v = p == null ? null : p.getProperty(k);
        return v == null ? "" : v.trim();
    }

    private static int intProp(final Properties p, final String k) {
        try {
            return Integer.parseInt(prop(p, k));
        } catch (final NumberFormatException e) {
            return 0;
        }
    }

    private static String str(final JsonObject o, final String k) {
        return o != null && o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : "";
    }

    private static long num(final JsonObject o, final String k) {
        try {
            return o != null && o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsLong() : 0;
        } catch (final RuntimeException e) {
            return 0;
        }
    }

    /** « 2026-11-24T08:06:42+03:00 » → « 24/11/2026 ». */
    private static String day(final String iso) {
        return iso.length() >= 10 ? iso.substring(8, 10) + "/" + iso.substring(5, 7) + "/" + iso.substring(0, 4) : iso;
    }
}
