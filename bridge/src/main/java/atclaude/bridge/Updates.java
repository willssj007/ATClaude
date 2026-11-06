package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.function.BiConsumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Mises à jour : la dernière version publiée sur GitHub (Arcane Table, ou AT TEST pour l'appli de test), comparée à
 * celle de l'appli ; puis son téléchargement (Android : l'APK, que l'appli fait installer ; Windows : le zip, qui
 * remplace l'appli et la relance). Sur iPhone, l'appli ne peut que prévenir : l'IPA se réinstalle avec l'outil qui
 * l'a installé.
 */
final class Updates {

    private Updates() { }

    /** Le serveur des versions (un faux GitHub pour les essais : -Datclaude.updatesApi=http://127.0.0.1:8799/). */
    private static String api() {
        final String base = System.getProperty("atclaude.updatesApi", "https://api.github.com/");
        return base.endsWith("/") ? base : base + "/";
    }

    private static final String REPO = "willssj007/atclaude";
    private static final Pattern VERSION = Pattern.compile("(\\d+)\\.(\\d+)\\.(\\d+)(?:-test\\.(\\d+))?");

    /** Android, iPhone, Windows (application installée) ou ordinateur (hôte de développement). */
    static String platform(final boolean ios) {
        if (ios) {
            return "ios";
        }
        final String vm = System.getProperty("java.vm.name", "") + System.getProperty("java.vendor", "");
        if (vm.toLowerCase(Locale.ROOT).contains("dalvik") || vm.toLowerCase(Locale.ROOT).contains("android")) {
            return "android";
        }
        final boolean windows = System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win");
        return windows && System.getProperty("jpackage.app-path") != null ? "windows" : "desktop";
    }

    /** -1, 0 ou 1 : « 0.6.10 » après « 0.6.9 », « 0.6.4-test.12 » après « 0.6.4-test.9 ». */
    static int compare(final String a, final String b) {
        final Matcher x = VERSION.matcher(a == null ? "" : a);
        final Matcher y = VERSION.matcher(b == null ? "" : b);
        if (!x.find() || !y.find()) {
            return 0;
        }
        for (int i = 1; i <= 4; i++) {
            final long p = x.group(i) == null ? -1 : Long.parseLong(x.group(i));
            final long q = y.group(i) == null ? -1 : Long.parseLong(y.group(i));
            if (p != q) {
                return p < q ? -1 : 1;
            }
        }
        return 0;
    }

    /**
     * La dernière version : {current, latest, newer, notes, page, platform, asset {name, url, size} pour cette plateforme,
     * install (l'appli peut se mettre à jour toute seule)}.
     */
    static JsonObject check(final String current, final String channel, final boolean ios) throws IOException {
        final String tag = "test".equals(channel) ? "apk-test" : "apk-latest";
        final JsonObject release = getJson(api() + "repos/" + REPO + "/releases/tags/" + tag);
        final String name = str(release, "name");
        final Matcher m = VERSION.matcher(name);
        final String latest = m.find() ? m.group() : "";
        final String platform = platform(ios);
        final JsonObject o = new JsonObject();
        o.addProperty("current", current == null ? "" : current);
        o.addProperty("latest", latest);
        o.addProperty("title", name);
        o.addProperty("newer", !latest.isEmpty() && current != null && !current.isEmpty() && compare(latest, current) > 0);
        String notes = str(release, "body");
        if (notes.length() > 6000) {
            notes = notes.substring(0, 6000) + "…";
        }
        o.addProperty("notes", notes);
        o.addProperty("page", str(release, "html_url"));
        o.addProperty("platform", platform);
        final String suffix = switch (platform) {
            case "android" -> ".apk";
            case "windows" -> ".zip";
            case "ios" -> ".ipa";
            default -> null;
        };
        final JsonElement assets = release.get("assets");
        if (suffix != null && assets != null && assets.isJsonArray()) {
            for (final JsonElement e : (JsonArray) assets) {
                final JsonObject a = e.getAsJsonObject();
                final String n = str(a, "name");
                if (n.toLowerCase(Locale.ROOT).endsWith(suffix)) {
                    final JsonObject asset = new JsonObject();
                    asset.addProperty("name", n);
                    asset.addProperty("url", str(a, "browser_download_url"));
                    asset.addProperty("size", a.has("size") ? a.get("size").getAsLong() : 0);
                    o.add("asset", asset);
                    break;
                }
            }
        }
        o.addProperty("install", o.has("asset") && ("android".equals(platform) || "windows".equals(platform)));
        return o;
    }

    /**
     * Télécharge le fichier de la mise à jour (Android : dans le dossier que l'appli donne, -Datclaude.updatesDir ; sinon
     * dans le dossier temporaire). progress(reçus, total) au fil du téléchargement. Renvoie le fichier.
     */
    static File download(final String url, final String name, final BiConsumer<Long, Long> progress) throws IOException {
        if (url == null || !url.startsWith("http")) {
            throw new IOException("adresse de téléchargement absente");
        }
        final String safe = name == null || name.trim().isEmpty() ? "mise-a-jour" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        final File dir = new File(System.getProperty("atclaude.updatesDir", new File(System.getProperty("java.io.tmpdir"), "arcane-table-maj").getPath()));
        dir.mkdirs();
        // Les anciens téléchargements ne servent plus.
        final File[] old = dir.listFiles();
        if (old != null) {
            for (final File f : old) {
                if (f.isFile()) {
                    f.delete();
                }
            }
        }
        final File out = new File(dir, safe);
        final File part = new File(dir, safe + ".part");
        HttpURLConnection c = Net.open(url);
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(20_000);
        c.setReadTimeout(60_000);
        c.setRequestProperty("User-Agent", "ArcaneTable");
        // GitHub renvoie vers son stockage (autre adresse) : on suit les renvois à la main si Java ne l'a pas fait.
        for (int hop = 0; hop < 5; hop++) {
            final int code = c.getResponseCode();
            if (code / 100 != 3) {
                break;
            }
            final String next = c.getHeaderField("Location");
            c.disconnect();
            if (next == null) {
                throw new IOException("renvoi sans adresse");
            }
            c = Net.open(next);
            c.setConnectTimeout(20_000);
            c.setReadTimeout(60_000);
            c.setRequestProperty("User-Agent", "ArcaneTable");
        }
        if (c.getResponseCode() != 200) {
            throw new IOException("téléchargement refusé (" + c.getResponseCode() + ")");
        }
        // La taille annoncée (sans getContentLengthLong, absent sur iPhone).
        long total = -1;
        try {
            final String len = c.getHeaderField("Content-Length");
            total = len == null ? -1 : Long.parseLong(len.trim());
        } catch (final NumberFormatException e) {
            total = -1;
        }
        try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(part)) {
            final byte[] buf = new byte[64 * 1024];
            long done = 0;
            long lastReport = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                os.write(buf, 0, n);
                done += n;
                if (progress != null && (done - lastReport > 512 * 1024 || done == total)) {
                    lastReport = done;
                    progress.accept(done, total);
                }
            }
        } finally {
            c.disconnect();
        }
        if (total > 0 && part.length() != total) {
            part.delete();
            throw new IOException("téléchargement incomplet");
        }
        if (!part.renameTo(out)) {
            Files.move(part.toPath(), out.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        return out;
    }

    /**
     * Windows : décompresse le zip à côté, écrit un petit script qui attend la fermeture de l'appli, copie la nouvelle
     * version par-dessus (les fichiers en plus, comme les données, restent) et relance ArcaneTable.exe ; puis le lance.
     * L'appli se ferme ensuite (le script l'arrête si elle est encore ouverte).
     */
    static void installWindows(final File zip) throws IOException {
        final String appPath = System.getProperty("jpackage.app-path");
        if (appPath == null) {
            throw new IOException("emplacement de l'application inconnu");
        }
        // …\ArcaneTable\moteur\ArcaneTableMoteur.exe → …\ArcaneTable
        final Path install = java.nio.file.Paths.get(appPath).toAbsolutePath().getParent().getParent();
        final Path unpack = new File(zip.getParentFile(), "nouvelle-version").toPath();
        deleteTree(unpack);
        Files.createDirectories(unpack);
        try (ZipInputStream in = new ZipInputStream(Files.newInputStream(zip.toPath()))) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                final Path target = unpack.resolve(e.getName().replace('\\', '/')).normalize();
                if (!target.startsWith(unpack)) {
                    throw new IOException("fichier suspect dans la mise à jour : " + e.getName());
                }
                if (e.isDirectory()) {
                    Files.createDirectories(target);
                } else {
                    Files.createDirectories(target.getParent());
                    try (OutputStream os = new FileOutputStream(target.toFile())) {
                        final byte[] buf = new byte[64 * 1024];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            os.write(buf, 0, n);
                        }
                    }
                }
            }
        }
        // Le zip contient le dossier ArcaneTable (ArcaneTable.exe et moteur\).
        Path source = unpack.resolve("ArcaneTable");
        if (!Files.isRegularFile(source.resolve("ArcaneTable.exe"))) {
            source = unpack;
        }
        if (!Files.isRegularFile(source.resolve("ArcaneTable.exe"))) {
            throw new IOException("ArcaneTable.exe absent de la mise à jour");
        }
        final Path script = new File(zip.getParentFile(), "mettre-a-jour.ps1").toPath();
        final String ps = String.join("\r\n",
                "$ErrorActionPreference = 'SilentlyContinue'",
                "Start-Sleep -Seconds 3",
                "Get-Process ArcaneTable | Stop-Process -Force",
                "Get-Process ArcaneTableMoteur | Stop-Process -Force",
                "Start-Sleep -Seconds 2",
                "robocopy '" + psQuote(source) + "' '" + psQuote(install) + "' /E /R:5 /W:1 /NFL /NDL /NJH /NJS | Out-Null",
                "Start-Process -FilePath '" + psQuote(install.resolve("ArcaneTable.exe")) + "' -WorkingDirectory '" + psQuote(install) + "'",
                "");
        Files.write(script, ps.getBytes(StandardCharsets.UTF_8));
        new ProcessBuilder("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script.toString())
                .redirectErrorStream(true).start();
    }

    private static String psQuote(final Path p) {
        return p.toString().replace("'", "''");
    }

    private static void deleteTree(final Path p) throws IOException {
        if (!Files.exists(p)) {
            return;
        }
        try (java.util.stream.Stream<Path> walk = Files.walk(p)) {
            walk.sorted(java.util.Comparator.reverseOrder()).forEach(x -> x.toFile().delete());
        }
    }

    private static JsonObject getJson(final String url) throws IOException {
        final HttpURLConnection c = Net.open(url);
        c.setConnectTimeout(15_000);
        c.setReadTimeout(20_000);
        c.setRequestProperty("Accept", "application/vnd.github+json");
        c.setRequestProperty("User-Agent", "ArcaneTable");
        try {
            final int code = c.getResponseCode();
            if (code != 200) {
                throw new IOException("GitHub répond " + code);
            }
            try (InputStream in = c.getInputStream()) {
                final java.io.ByteArrayOutputStream all = new java.io.ByteArrayOutputStream();
                final byte[] buf = new byte[16 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) {
                    all.write(buf, 0, n);
                }
                return JsonParser.parseString(new String(all.toByteArray(), StandardCharsets.UTF_8)).getAsJsonObject();
            }
        } finally {
            c.disconnect();
        }
    }

    private static String str(final JsonObject o, final String k) {
        return o != null && o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : "";
    }
}
