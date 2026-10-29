package atclaude.bridge;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Lecture et écriture de fichiers avec des appels qui existent dès Android 8 (API 26) et sur iPhone (MobiVM, dont
 * java.nio.file est réduit à l'essentiel).
 */
final class Io {

    private Io() { }

    static String read(final File f) throws IOException {
        return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
    }

    static void write(final File f, final String s) throws IOException {
        Files.write(f.toPath(), s.getBytes(StandardCharsets.UTF_8));
    }

    /** Copie un flux dans un fichier (remplacé s'il existe). */
    static void copy(final InputStream in, final File dest) throws IOException {
        try (OutputStream out = new FileOutputStream(dest)) {
            final byte[] buf = new byte[65_536];
            for (int n; (n = in.read(buf)) > 0; ) {
                out.write(buf, 0, n);
            }
        }
    }

    static String readAll(final InputStream in) throws IOException {
        final ByteArrayOutputStream out = new ByteArrayOutputStream();
        final byte[] buf = new byte[16_384];
        for (int n; (n = in.read(buf)) > 0; ) {
            out.write(buf, 0, n);
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
}
