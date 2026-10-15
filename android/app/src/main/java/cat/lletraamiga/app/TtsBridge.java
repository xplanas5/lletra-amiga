package cat.lletraamiga.app;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Exposa el TextToSpeech d'Android al JavaScript (js/android-tts.js) com a AndroidTTS.
 *  Els textos llargs es parteixen en trossos; els esdeveniments es reporten amb
 *  l'identificador de la locució i la posició relativa al text complet. */
public class TtsBridge {

    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final TextToSpeech tts;
    private volatile boolean ready = false;
    private Runnable pending;

    // Locució en curs i desplaçament de cada tros dins el text complet.
    private String currentId;
    private int[] chunkOffsets = new int[0];

    TtsBridge(Context context, WebView webView) {
        this.webView = webView;
        this.tts = new TextToSpeech(context.getApplicationContext(), status -> main.post(() -> onInit(status)));
    }

    private void onInit(int status) {
        ready = status == TextToSpeech.SUCCESS;
        if (ready) {
            tts.setOnUtteranceProgressListener(listener);
            js("window.__androidTtsVoicesChanged && window.__androidTtsVoicesChanged()");
        }
        if (pending != null) { Runnable r = pending; pending = null; r.run(); }
    }

    private final UtteranceProgressListener listener = new UtteranceProgressListener() {
        @Override public void onStart(String uttId) {
            if (chunkIndex(uttId) == 0) emit(baseId(uttId), "start", 0);
        }
        @Override public void onDone(String uttId) {
            if (chunkIndex(uttId) == lastChunk(uttId)) emit(baseId(uttId), "end", 0);
        }
        @Override public void onError(String uttId) { emit(baseId(uttId), "error", 0); }
        @Override public void onError(String uttId, int code) { emit(baseId(uttId), "error", 0); }
        @Override public void onRangeStart(String uttId, int start, int end, int frame) {
            final int k = chunkIndex(uttId);
            final String id = baseId(uttId);
            main.post(() -> {
                int[] offs = chunkOffsets;
                if (k >= 0 && k < offs.length) emitNow(id, "boundary", offs[k] + start);
            });
        }
    };

    @JavascriptInterface
    public void speak(String id, String text, String lang, String voiceName, double rate) {
        main.post(() -> {
            if (!ready) { pending = () -> speak(id, text, lang, voiceName, rate); return; }
            tts.stop();
            applyVoice(lang, voiceName);
            tts.setSpeechRate((float) Math.max(0.1, Math.min(rate, 4.0)));

            List<String> chunks = new ArrayList<>();
            List<Integer> offsets = new ArrayList<>();
            split(text, chunks, offsets);
            currentId = id;
            chunkOffsets = new int[offsets.size()];
            for (int i = 0; i < offsets.size(); i++) chunkOffsets[i] = offsets.get(i);

            if (chunks.isEmpty()) { emitNow(id, "end", 0); return; }
            int last = chunks.size() - 1;
            for (int i = 0; i <= last; i++) {
                tts.speak(chunks.get(i), i == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD,
                        new Bundle(), id + "#" + i + "/" + last);
            }
        });
    }

    @JavascriptInterface
    public void stop() {
        main.post(() -> {
            pending = null;
            currentId = null;
            if (ready) tts.stop();
        });
    }

    @JavascriptInterface
    public String getVoices() {
        JSONArray out = new JSONArray();
        if (!ready) return out.toString();
        try {
            Set<Voice> voices = tts.getVoices();
            if (voices != null) {
                for (Voice v : voices) {
                    Set<String> f = v.getFeatures();
                    if (f != null && f.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                    JSONObject o = new JSONObject();
                    o.put("name", v.getName());
                    o.put("lang", v.getLocale().toLanguageTag());
                    out.put(o);
                }
            }
        } catch (Exception ignored) { }
        return out.toString();
    }

    void shutdown() {
        tts.stop();
        tts.shutdown();
    }

    private void applyVoice(String lang, String voiceName) {
        if (voiceName != null && !voiceName.isEmpty()) {
            try {
                for (Voice v : tts.getVoices()) {
                    if (v.getName().equals(voiceName)) { tts.setVoice(v); return; }
                }
            } catch (Exception ignored) { }
        }
        Locale loc = Locale.forLanguageTag(lang == null || lang.isEmpty() ? "ca-ES" : lang);
        int r = tts.setLanguage(loc);
        if (r < TextToSpeech.LANG_AVAILABLE) r = tts.setLanguage(new Locale("ca"));
        if (r < TextToSpeech.LANG_AVAILABLE) tts.setLanguage(Locale.forLanguageTag("es-ES"));
    }

    /** Parteix el text en trossos que el motor accepti, tallant preferentment en final de frase. */
    private static void split(String text, List<String> chunks, List<Integer> offsets) {
        int max = Math.min(TextToSpeech.getMaxSpeechInputLength() - 1, 3000);
        int pos = 0, n = text.length();
        while (pos < n) {
            int end = Math.min(pos + max, n);
            if (end < n) {
                int cut = -1;
                for (int i = end - 1; i > pos + max / 2; i--) {
                    char c = text.charAt(i);
                    if (c == '.' || c == '!' || c == '?' || c == '\n') { cut = i + 1; break; }
                }
                if (cut < 0) { int sp = text.lastIndexOf(' ', end - 1); if (sp > pos) cut = sp + 1; }
                if (cut > pos) end = cut;
            }
            String part = text.substring(pos, end);
            if (!part.trim().isEmpty()) { chunks.add(part); offsets.add(pos); }
            pos = end;
        }
    }

    private static String baseId(String uttId) {
        int h = uttId.indexOf('#');
        return h < 0 ? uttId : uttId.substring(0, h);
    }
    private static int chunkIndex(String uttId) {
        try { return Integer.parseInt(uttId.substring(uttId.indexOf('#') + 1, uttId.indexOf('/'))); }
        catch (Exception e) { return -1; }
    }
    private static int lastChunk(String uttId) {
        try { return Integer.parseInt(uttId.substring(uttId.indexOf('/') + 1)); }
        catch (Exception e) { return -2; }
    }

    private void emit(String id, String type, int charIndex) {
        main.post(() -> emitNow(id, type, charIndex));
    }

    /** S'executa al fil principal; descarta esdeveniments de locucions ja aturades. */
    private void emitNow(String id, String type, int charIndex) {
        if (!id.equals(currentId)) return;
        if (type.equals("end") || type.equals("error")) currentId = null;
        js("window.__androidTtsEvent && window.__androidTtsEvent(" + JSONObject.quote(id) + ",'" + type + "'," + charIndex + ")");
    }

    private void js(String code) {
        webView.evaluateJavascript(code, null);
    }
}
