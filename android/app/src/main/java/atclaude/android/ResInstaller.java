package atclaude.android;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Installe les ressources de Forge (res.zip, embarqué dans l'APK) dans le stockage privé de
 * l'application, au premier lancement et après chaque mise à jour.
 */
final class ResInstaller {

    interface Progress {
        void report(int percent);
    }

    private ResInstaller() { }

    /** Renvoie le dossier qui contient res/, prêt à être lu par Forge. */
    static File ensure(final Context context, final Progress progress) throws IOException {
        final File root = new File(context.getFilesDir(), "forge");
        final File stamp = new File(root, "res.version");
        final String version = installedVersion(context);
        if (stamp.isFile() && new File(root, "res").isDirectory()
                && version.equals(new String(Files.readAllBytes(stamp.toPath()), StandardCharsets.UTF_8))) {
            return root;
        }
        deleteRecursively(new File(root, "res"));
        root.mkdirs();

        long total = -1;
        try (AssetFileDescriptor fd = context.getAssets().openFd("res.zip")) {
            total = fd.getLength();
        } catch (final IOException e) {
            // archive compressée dans l'APK : pas de taille connue, la progression reste indéterminée
        }
        final long size = total;
        final long[] read = {0};
        final int[] lastPercent = {-1};
        try (InputStream raw = context.getAssets().open("res.zip");
             ZipInputStream zip = new ZipInputStream(new FilterInputStream(raw) {
                 @Override
                 public int read(final byte[] b, final int off, final int len) throws IOException {
                     final int n = super.read(b, off, len);
                     if (n > 0 && size > 0) {
                         read[0] += n;
                         final int percent = (int) (read[0] * 100 / size);
                         if (percent != lastPercent[0]) {
                             lastPercent[0] = percent;
                             progress.report(percent);
                         }
                     }
                     return n;
                 }
             })) {
            final byte[] buffer = new byte[64 * 1024];
            final String rootPath = root.getCanonicalPath() + File.separator;
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                final File target = new File(root, entry.getName());
                if (!target.getCanonicalPath().startsWith(rootPath)) {
                    throw new IOException("Entrée d'archive invalide : " + entry.getName());
                }
                if (entry.isDirectory()) {
                    target.mkdirs();
                    continue;
                }
                target.getParentFile().mkdirs();
                try (OutputStream out = new BufferedOutputStream(new FileOutputStream(target))) {
                    int n;
                    while ((n = zip.read(buffer)) > 0) {
                        out.write(buffer, 0, n);
                    }
                }
            }
        }
        Files.write(stamp.toPath(), version.getBytes(StandardCharsets.UTF_8));
        return root;
    }

    private static String installedVersion(final Context context) {
        try {
            final PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return info.getLongVersionCode() + "-" + info.lastUpdateTime;
        } catch (final PackageManager.NameNotFoundException e) {
            return "0";
        }
    }

    private static void deleteRecursively(final File file) {
        final File[] children = file.listFiles();
        if (children != null) {
            for (final File child : children) {
                deleteRecursively(child);
            }
        }
        file.delete();
    }
}
