package atclaude.bridge;

import java.io.ByteArrayOutputStream;

/** Base64 standard (RFC 4648) : java.util.Base64 n'existe pas sur l'iPhone (MobiVM). */
final class B64 {

    private static final char[] ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toCharArray();
    private static final int[] VALUE = new int[128];

    static {
        java.util.Arrays.fill(VALUE, -1);
        for (int i = 0; i < ALPHABET.length; i++) {
            VALUE[ALPHABET[i]] = i;
        }
        // Variante des adresses (base64url) acceptée aussi.
        VALUE['-'] = 62;
        VALUE['_'] = 63;
    }

    private B64() { }

    static String encode(final byte[] data) {
        final StringBuilder sb = new StringBuilder((data.length + 2) / 3 * 4);
        int i = 0;
        for (; i + 2 < data.length; i += 3) {
            final int n = (data[i] & 0xff) << 16 | (data[i + 1] & 0xff) << 8 | (data[i + 2] & 0xff);
            sb.append(ALPHABET[n >>> 18]).append(ALPHABET[n >>> 12 & 63]).append(ALPHABET[n >>> 6 & 63]).append(ALPHABET[n & 63]);
        }
        final int rest = data.length - i;
        if (rest == 1) {
            final int n = (data[i] & 0xff) << 16;
            sb.append(ALPHABET[n >>> 18]).append(ALPHABET[n >>> 12 & 63]).append("==");
        } else if (rest == 2) {
            final int n = (data[i] & 0xff) << 16 | (data[i + 1] & 0xff) << 8;
            sb.append(ALPHABET[n >>> 18]).append(ALPHABET[n >>> 12 & 63]).append(ALPHABET[n >>> 6 & 63]).append('=');
        }
        return sb.toString();
    }

    /** Décode (blancs ignorés, « = » final facultatif) ; un caractère hors de l'alphabet est une erreur. */
    static byte[] decode(final String text) {
        final ByteArrayOutputStream out = new ByteArrayOutputStream(text.length() * 3 / 4);
        int buffer = 0;
        int bits = 0;
        for (int i = 0; i < text.length(); i++) {
            final char c = text.charAt(i);
            if (c == '=') {
                break;
            }
            if (c == ' ' || c == '\n' || c == '\r' || c == '\t') {
                continue;
            }
            final int v = c < 128 ? VALUE[c] : -1;
            if (v < 0) {
                throw new IllegalArgumentException("Base64 invalide.");
            }
            buffer = buffer << 6 | v;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out.write(buffer >>> bits & 0xff);
            }
        }
        return out.toByteArray();
    }
}
