package atclaude.web;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.function.IntConsumer;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Installe les ressources de Forge (res.zip, publié avec le site) dans le stockage persistant du navigateur,
 * au premier lancement et quand elles changent (empreinte de l'archive), comme l'application Android.
 */
final class ResInstall {

    private ResInstall() { }

    /** Renvoie le dossier qui contient res/, prêt à être lu par Forge. */
    static File ensure(final String zipPath, final File root, final String hash, final long size, final IntConsumer progress) throws IOException {
        final File stamp = new File(root, "res.version");
        if (stamp.isFile() && new File(root, "res").isDirectory()
                && hash.equals(new String(Files.readAllBytes(stamp.toPath()), StandardCharsets.UTF_8).trim())) {
            return root;
        }
        deleteRecursively(new File(root, "res"));
        root.mkdirs();
        final long[] read = {0};
        final int[] last = {-1};
        progress.accept(0);
        try (InputStream raw = new BufferedInputStream(new FileInputStream(zipPath), 256 * 1024);
             ZipInputStream zip = new ZipInputStream(new FilterInputStream(raw) {
                 @Override
                 public int read(final byte[] b, final int off, final int len) throws IOException {
                     final int n = super.read(b, off, len);
                     if (n > 0 && size > 0) {
                         read[0] += n;
                         final int percent = (int) Math.min(99, read[0] * 100 / size);
                         if (percent != last[0]) {
                             last[0] = percent;
                             progress.accept(percent);
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
                try (OutputStream out = new BufferedOutputStream(new FileOutputStream(target), 256 * 1024)) {
                    int n;
                    while ((n = zip.read(buffer)) > 0) {
                        out.write(buffer, 0, n);
                    }
                }
            }
        }
        Files.write(stamp.toPath(), hash.getBytes(StandardCharsets.UTF_8));
        progress.accept(100);
        return root;
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
