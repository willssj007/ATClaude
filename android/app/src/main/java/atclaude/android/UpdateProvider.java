package atclaude.android;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Donne à l'installateur d'Android l'APK de la mise à jour téléchargée (dossier « updates » du cache de l'appli), en
 * lecture seule et seulement à qui l'appli le permet (l'intention d'installation). Rien d'autre n'est servi.
 */
public class UpdateProvider extends ContentProvider {

    static final String MIME = "application/vnd.android.package-archive";

    static File dir(final android.content.Context context) {
        return new File(context.getCacheDir(), "updates");
    }

    private File file(final Uri uri) throws FileNotFoundException {
        final String name = uri.getLastPathSegment();
        if (name == null || name.contains("/") || name.contains("..") || !name.endsWith(".apk")) {
            throw new FileNotFoundException(String.valueOf(uri));
        }
        final File f = new File(dir(getContext()), name);
        if (!f.isFile()) {
            throw new FileNotFoundException(String.valueOf(uri));
        }
        return f;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(final Uri uri, final String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(file(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(final Uri uri) {
        return MIME;
    }

    @Override
    public Cursor query(final Uri uri, final String[] projection, final String selection, final String[] selectionArgs, final String sortOrder) {
        final File f;
        try {
            f = file(uri);
        } catch (final FileNotFoundException e) {
            return null;
        }
        final MatrixCursor c = new MatrixCursor(new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[] {f.getName(), f.length()});
        return c;
    }

    @Override
    public Uri insert(final Uri uri, final ContentValues values) {
        return null;
    }

    @Override
    public int delete(final Uri uri, final String selection, final String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(final Uri uri, final ContentValues values, final String selection, final String[] selectionArgs) {
        return 0;
    }
}
