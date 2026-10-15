package cat.lletraamiga.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Exposa al JavaScript (com a AndroidBridge) el que el WebView no fa sol:
 *  desar o compartir fitxers (informes CSV, paquets de contingut) i imprimir / desar en PDF. */
public class AppBridge {

    private final Activity activity;
    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());

    AppBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /** Desa el fitxer a Baixades (Android 10 o posterior) i obre el menú per compartir-lo. */
    @JavascriptInterface
    public void saveFile(String name, String mime, String content) {
        final String fileName = safeName(name);
        final byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        main.post(() -> {
            boolean inDownloads = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                inDownloads = saveToDownloads(fileName, mime, bytes);
            }
            try {
                File dir = new File(activity.getCacheDir(), "exports");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("No es pot crear la carpeta");
                File file = new File(dir, fileName);
                try (FileOutputStream out = new FileOutputStream(file)) { out.write(bytes); }
                Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".files", file);
                Intent send = new Intent(Intent.ACTION_SEND)
                        .setType(mime)
                        .putExtra(Intent.EXTRA_STREAM, uri)
                        .putExtra(Intent.EXTRA_SUBJECT, fileName)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(Intent.createChooser(send, "Comparteix " + fileName));
            } catch (Exception e) {
                if (!inDownloads) toast("No s'ha pogut desar el fitxer.");
            }
            if (inDownloads) toast("Desat a Baixades: " + fileName);
        });
    }

    /** Imprimeix la pàgina actual (amb els estils d'impressió); des del diàleg es pot desar en PDF. */
    @JavascriptInterface
    public void print(String title) {
        final String jobName = (title == null || title.isEmpty()) ? "Lletra Amiga" : title;
        main.post(() -> {
            PrintManager pm = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
            if (pm == null) { toast("Aquest dispositiu no permet imprimir."); return; }
            PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
            pm.print(jobName, adapter, new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .build());
        });
    }

    private boolean saveToDownloads(String name, String mime, byte[] bytes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
        ContentResolver resolver = activity.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        Uri uri = null;
        try {
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) return false;
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) return false;
                out.write(bytes);
            }
            return true;
        } catch (Exception e) {
            if (uri != null) resolver.delete(uri, null, null);
            return false;
        }
    }

    private static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return n.isEmpty() ? "lletra-amiga.txt" : n;
    }

    private void toast(String msg) {
        Toast.makeText(activity, msg, Toast.LENGTH_LONG).show();
    }
}
