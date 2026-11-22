package com.jarvis.asistente;

import android.Manifest;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Funciones nativas de Jarvis en Android, todas sin internet salvo la descarga del modelo:
 * IA local (llama.cpp), reconocimiento de voz de Android y voz de Android.
 */
@CapacitorPlugin(
    name = "Jarvis",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class JarvisPlugin extends Plugin {

    private final ExecutorService llmThread = Executors.newSingleThreadExecutor();
    private final ExecutorService ioThread = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean cancelDownload = new AtomicBoolean(false);

    private String loadedModel = null;
    private SpeechRecognizer recognizer;
    private PluginCall listenCall;
    private boolean triedFallback;

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String ttsLang = "";
    private final Map<String, PluginCall> speaking = new HashMap<>();
    private final ArrayList<PluginCall> waitingTts = new ArrayList<>();

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (ttsReady) {
                for (Locale l : new Locale[] { new Locale("es", "MX"), new Locale("es", "US"), new Locale("es", "ES"), new Locale("es") }) {
                    int r = tts.setLanguage(l);
                    if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) { ttsLang = l.toLanguageTag(); break; }
                }
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { notifyListeners("speak", obj("state", "speaking")); }
                    @Override public void onDone(String id) { finishSpeak(id); }
                    @Override public void onError(String id) { finishSpeak(id); }
                    @Override public void onStop(String id, boolean interrupted) { finishSpeak(id); }
                });
            }
            for (PluginCall c : waitingTts) speakNow(c);
            waitingTts.clear();
        });
    }

    private static JSObject obj(String k, Object v) { JSObject o = new JSObject(); o.put(k, v); return o; }

    private File modelsDir() {
        File d = new File(getContext().getFilesDir(), "models");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    // ---------------------------------------------------------------- información del teléfono

    @PluginMethod
    public void info(PluginCall call) {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        JSObject r = new JSObject();
        r.put("ramMB", mi.totalMem / (1024 * 1024));
        r.put("freeMB", mi.availMem / (1024 * 1024));
        r.put("cores", Runtime.getRuntime().availableProcessors());
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("device", Build.MANUFACTURER + " " + Build.MODEL);
        r.put("loaded", loadedModel);
        r.put("freeDiskMB", modelsDir().getUsableSpace() / (1024 * 1024));
        JSArray files = new JSArray();
        File[] list = modelsDir().listFiles();
        if (list != null) for (File f : list) {
            JSObject o = new JSObject();
            o.put("file", f.getName());
            o.put("sizeMB", f.length() / (1024 * 1024));
            files.put(o);
        }
        r.put("models", files);
        r.put("speechAvailable", SpeechRecognizer.isRecognitionAvailable(getContext()));
        r.put("onDeviceSpeech", Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()));
        r.put("ttsReady", ttsReady);
        r.put("ttsLang", ttsLang);
        call.resolve(r);
    }

    // ---------------------------------------------------------------- descarga del modelo (una sola vez)

    @PluginMethod
    public void downloadModel(PluginCall call) {
        final String url = call.getString("url");
        final String name = call.getString("file");
        if (url == null || name == null || name.contains("/")) { call.reject("Faltan datos del modelo."); return; }
        cancelDownload.set(false);
        ioThread.execute(() -> {
            File part = new File(modelsDir(), name + ".part");
            File done = new File(modelsDir(), name);
            try {
                long have = part.exists() ? part.length() : 0;
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(20000);
                c.setReadTimeout(60000);
                if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
                int code = c.getResponseCode();
                if (code == 200) have = 0; // el servidor no aceptó continuar: empezar de nuevo
                else if (code != 206) throw new Exception("El servidor respondió " + code);
                long total = have + c.getContentLengthLong();
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(part, have > 0)) {
                    byte[] buf = new byte[1 << 16];
                    long got = have, last = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        if (cancelDownload.get()) throw new Exception("Descarga cancelada.");
                        out.write(buf, 0, n);
                        got += n;
                        long now = System.currentTimeMillis();
                        if (now - last > 400) {
                            last = now;
                            JSObject p = new JSObject();
                            p.put("file", name); p.put("received", got); p.put("total", total);
                            notifyListeners("download", p);
                        }
                    }
                }
                if (!part.renameTo(done)) throw new Exception("No pude guardar el modelo.");
                call.resolve(obj("file", name));
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Falló la descarga." : e.getMessage());
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) { cancelDownload.set(true); call.resolve(); }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        String name = call.getString("file", "");
        if (name.equals(loadedModel)) { LlamaEngine.nativeUnload(); loadedModel = null; }
        new File(modelsDir(), name).delete();
        new File(modelsDir(), name + ".part").delete();
        call.resolve();
    }

    // ---------------------------------------------------------------- IA local (llama.cpp)

    @PluginMethod
    public void loadModel(PluginCall call) {
        final String name = call.getString("file");
        final int ctx = call.getInt("ctx", 2048);
        final File f = new File(modelsDir(), name == null ? "" : name);
        if (!f.exists()) { call.reject("El modelo no está descargado."); return; }
        llmThread.execute(() -> {
            int threads = Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors()));
            String err = LlamaEngine.nativeLoad(f.getAbsolutePath(), ctx, threads);
            if (err != null) { loadedModel = null; call.reject(err); return; }
            loadedModel = name;
            call.resolve(obj("file", name));
        });
    }

    @PluginMethod
    public void resetChat(PluginCall call) {
        final String system = call.getString("system", "");
        llmThread.execute(() -> { LlamaEngine.nativeReset(system); call.resolve(); });
    }

    @PluginMethod
    public void generate(PluginCall call) {
        final String text = call.getString("text", "");
        final int max = call.getInt("maxTokens", 320);
        if (loadedModel == null) { call.reject("La IA aún no está cargada."); return; }
        llmThread.execute(() -> {
            byte[] out = LlamaEngine.nativeGenerate(text, max, piece -> {
                notifyListeners("token", obj("text", new String(piece, StandardCharsets.UTF_8)));
                return true;
            });
            if (out == null) { call.reject("La IA no pudo responder (mensaje demasiado largo)."); return; }
            call.resolve(obj("text", new String(out, StandardCharsets.UTF_8)));
        });
    }

    @PluginMethod
    public void stopGenerate(PluginCall call) { LlamaEngine.nativeStop(); call.resolve(); }

    // ---------------------------------------------------------------- oído: reconocimiento de voz de Android

    @PluginMethod
    public void listen(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermission");
            return;
        }
        startListening(call, true);
    }

    @PermissionCallback
    private void micPermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) startListening(call, true);
        else call.reject("Sin permiso de micrófono.", "not_granted");
    }

    private void startListening(PluginCall call, boolean preferOnDevice) {
        main.post(() -> {
            destroyRecognizer();
            Context ctx = getContext();
            listenCall = call;
            triedFallback = !preferOnDevice;
            boolean onDevice = preferOnDevice && Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx);
            if (onDevice) recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx);
            else if (SpeechRecognizer.isRecognitionAvailable(ctx)) recognizer = SpeechRecognizer.createSpeechRecognizer(ctx);
            else { listenCall = null; call.reject("Este teléfono no tiene reconocimiento de voz.", "unavailable"); return; }
            if (!onDevice) triedFallback = true;
            recognizer.setRecognitionListener(new Listener(onDevice));
            recognizer.startListening(recognizerIntent(call.getString("lang", "es-MX")));
        });
    }

    private Intent recognizerIntent(String lang) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        return i;
    }

    private class Listener implements RecognitionListener {
        private final boolean onDevice;
        private long lastLevel = 0;
        Listener(boolean onDevice) { this.onDevice = onDevice; }

        @Override public void onReadyForSpeech(Bundle b) { notifyListeners("listen", obj("state", "listening")); }
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rms) {
            long now = System.currentTimeMillis();
            if (now - lastLevel > 80) { lastLevel = now; notifyListeners("level", obj("level", Math.max(0, Math.min(1, (rms + 2) / 12)))); }
        }
        @Override public void onBufferReceived(byte[] b) {}
        @Override public void onEndOfSpeech() { notifyListeners("listen", obj("state", "processing")); }
        @Override public void onPartialResults(Bundle b) {
            ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (r != null && !r.isEmpty()) notifyListeners("partial", obj("text", r.get(0)));
        }
        @Override public void onResults(Bundle b) {
            ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            finishListen(r != null && !r.isEmpty() ? r.get(0) : "", null);
        }
        @Override public void onError(int error) {
            // El reconocedor sin conexión no tiene el idioma: probar con el normal (que también prefiere sin conexión).
            if (onDevice && !triedFallback && error != SpeechRecognizer.ERROR_NO_MATCH && error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                PluginCall c = listenCall;
                if (c != null) { startListening(c, false); return; }
            }
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) finishListen("", null);
            else finishListen(null, "error_" + error);
        }
        @Override public void onEvent(int t, Bundle b) {}
    }

    private void finishListen(String text, String error) {
        PluginCall c = listenCall;
        listenCall = null;
        notifyListeners("listen", obj("state", "idle"));
        main.post(this::destroyRecognizer);
        if (c == null) return;
        if (error != null) c.reject(errorText(error), error);
        else c.resolve(obj("text", text));
    }

    private static String errorText(String code) {
        switch (code) {
            case "error_9": return "Sin permiso de micrófono.";
            case "error_12": case "error_13": return "Falta el paquete de voz en español sin conexión.";
            case "error_2": case "error_4": case "error_11": return "El reconocimiento de voz necesita el paquete sin conexión o internet.";
            case "error_8": return "El reconocimiento de voz está ocupado; inténtalo otra vez.";
            default: return "No pude escucharte (" + code + ").";
        }
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        main.post(() -> { if (recognizer != null) recognizer.stopListening(); });
        call.resolve();
    }

    private void destroyRecognizer() {
        if (recognizer != null) { try { recognizer.destroy(); } catch (Exception ignored) {} recognizer = null; }
    }

    // ---------------------------------------------------------------- voz: texto a voz de Android

    @PluginMethod
    public void speak(PluginCall call) {
        if (tts == null || (!ttsReady && waitingTts.size() < 20)) { waitingTts.add(call); return; }
        speakNow(call);
    }

    private void speakNow(PluginCall call) {
        if (!ttsReady) { call.reject("La voz del teléfono no está disponible."); return; }
        String text = call.getString("text", "");
        if (text.trim().isEmpty()) { call.resolve(); return; }
        float rate = call.getFloat("rate", 1.0f);
        tts.setSpeechRate(rate);
        String id = "u" + System.nanoTime();
        synchronized (speaking) { speaking.put(id, call); }
        Bundle params = new Bundle();
        tts.speak(text, TextToSpeech.QUEUE_ADD, params, id);
    }

    private void finishSpeak(String id) {
        PluginCall c;
        boolean empty;
        synchronized (speaking) { c = speaking.remove(id); empty = speaking.isEmpty(); }
        if (c != null) c.resolve();
        if (empty) notifyListeners("speak", obj("state", "idle"));
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (tts != null) tts.stop();
        ArrayList<String> ids;
        synchronized (speaking) { ids = new ArrayList<>(speaking.keySet()); }
        for (String id : ids) finishSpeak(id);
        call.resolve();
    }

    @PluginMethod
    public void voices(PluginCall call) {
        JSArray arr = new JSArray();
        if (ttsReady && tts.getVoices() != null) for (Voice v : tts.getVoices()) {
            if (!v.getLocale().getLanguage().equals("es")) continue;
            JSObject o = new JSObject();
            o.put("name", v.getName());
            o.put("lang", v.getLocale().toLanguageTag());
            o.put("offline", !v.isNetworkConnectionRequired());
            o.put("installed", !v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED));
            arr.put(o);
        }
        call.resolve(obj("voices", arr));
    }

    @PluginMethod
    public void setVoice(PluginCall call) {
        String name = call.getString("name", "");
        if (ttsReady && tts.getVoices() != null) for (Voice v : tts.getVoices()) {
            if (v.getName().equals(name)) { tts.setVoice(v); break; }
        }
        call.resolve();
    }

    @PluginMethod
    public void openVoiceSettings(PluginCall call) {
        try {
            Intent i = new Intent("com.android.settings.TTS_SETTINGS");
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject("No pude abrir los ajustes de voz."); }
    }

    @Override
    protected void handleOnDestroy() {
        main.post(this::destroyRecognizer);
        if (tts != null) tts.shutdown();
        LlamaEngine.nativeStop();
    }
}
