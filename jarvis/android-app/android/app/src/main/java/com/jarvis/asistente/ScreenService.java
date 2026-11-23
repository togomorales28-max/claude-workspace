package com.jarvis.asistente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Jarvis ve la pantalla: captura (MediaProjection) + burbuja flotante. Al tocar la burbuja, la visión
 * describe la pantalla y el cerebro contesta en español en voz alta. Todo dentro del teléfono.
 */
public class ScreenService extends Service {

    static volatile boolean running = false;
    private static final String CHANNEL = "jarvis_screen";
    private static final int NOTIF_ID = 7;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService work = Executors.newSingleThreadExecutor();
    private MediaProjection projection;
    private VirtualDisplay display;
    private ImageReader reader;
    private HandlerThread capThread;
    private volatile Bitmap lastFrame;
    private volatile boolean wantFresh = false;
    private long lastGrab = 0;

    private WindowManager wm;
    private TextView bubble, panel;
    private WindowManager.LayoutParams bubbleLp;
    private TextToSpeech tts;
    private volatile boolean busy = false;
    private String visionModel, visionMmproj;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || "stop".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        if (running) return START_NOT_STICKY;
        startForegroundCompat(); // Android exige el servicio en primer plano ANTES de usar la captura
        visionModel = intent.getStringExtra("model");
        visionMmproj = intent.getStringExtra("mmproj");
        Intent data = intent.getParcelableExtra("data");
        int code = intent.getIntExtra("code", 0);
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        try { projection = mpm.getMediaProjection(code, data); } catch (Exception e) { projection = null; }
        if (projection == null) { stopSelf(); return START_NOT_STICKY; }

        capThread = new HandlerThread("jarvis-captura");
        capThread.start();
        Handler cap = new Handler(capThread.getLooper());
        projection.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() { main.post(ScreenService.this::stopSelf); }
        }, cap);

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int w = Math.max(320, dm.widthPixels / 2), h = Math.max(480, dm.heightPixels / 2);
        reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2);
        reader.setOnImageAvailableListener(this::grab, cap);
        display = projection.createVirtualDisplay("jarvis-pantalla", w, h, Math.max(120, dm.densityDpi / 2),
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.getSurface(), null, cap);

        tts = new TextToSpeech(this, st -> {
            if (st == TextToSpeech.SUCCESS) {
                for (Locale l : new Locale[] { new Locale("es", "MX"), new Locale("es", "US"), new Locale("es") }) {
                    int r = tts.setLanguage(l);
                    if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) break;
                }
            }
        });
        showBubble();
        running = true;
        return START_NOT_STICKY;
    }

    // Guarda la última imagen de la pantalla (máx. ~2 por segundo para no gastar batería).
    private void grab(ImageReader r) {
        Image img = null;
        try {
            img = r.acquireLatestImage();
            if (img == null) return;
            long now = System.currentTimeMillis();
            if (!wantFresh && lastFrame != null && now - lastGrab < 500) return;
            lastGrab = now;
            Image.Plane p = img.getPlanes()[0];
            int pixelStride = p.getPixelStride(), rowStride = p.getRowStride();
            int w = img.getWidth(), h = img.getHeight();
            Bitmap b = Bitmap.createBitmap(rowStride / pixelStride, h, Bitmap.Config.ARGB_8888);
            b.copyPixelsFromBuffer(p.getBuffer());
            lastFrame = (rowStride / pixelStride == w) ? b : Bitmap.createBitmap(b, 0, 0, w, h);
            wantFresh = false;
        } catch (Exception ignored) {
        } finally { if (img != null) img.close(); }
    }

    // ------------------------------------------------------------------ burbuja flotante

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private void showBubble() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubble = new TextView(this);
        bubble.setText("J");
        bubble.setTextColor(0xFFFFE39A);
        bubble.setTextSize(22);
        bubble.setTypeface(Typeface.DEFAULT_BOLD);
        bubble.setGravity(Gravity.CENTER);
        bubble.setContentDescription("Jarvis: toca para que vea tu pantalla");
        setBubbleThinking(false);
        int size = dp(58);
        bubbleLp = new WindowManager.LayoutParams(size, size, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        bubbleLp.gravity = Gravity.TOP | Gravity.START;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        bubbleLp.x = dm.widthPixels - size - dp(10);
        bubbleLp.y = dm.heightPixels / 3;
        bubble.setOnTouchListener(new View.OnTouchListener() {
            float sx, sy; int ox, oy; boolean moved;
            @Override public boolean onTouch(View v, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN: sx = e.getRawX(); sy = e.getRawY(); ox = bubbleLp.x; oy = bubbleLp.y; moved = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        if (Math.abs(e.getRawX() - sx) > dp(8) || Math.abs(e.getRawY() - sy) > dp(8)) moved = true;
                        if (moved) { bubbleLp.x = ox + (int) (e.getRawX() - sx); bubbleLp.y = oy + (int) (e.getRawY() - sy); wm.updateViewLayout(bubble, bubbleLp); }
                        return true;
                    case MotionEvent.ACTION_UP: if (!moved) onTap(); return true;
                }
                return false;
            }
        });
        wm.addView(bubble, bubbleLp);
    }

    private void setBubbleThinking(boolean thinking) {
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(thinking ? 0xF2FFB52E : 0xE603060D);
        bg.setStroke(dp(2), 0xFFFFB52E);
        bubble.setBackground(bg);
        bubble.setTextColor(thinking ? 0xFF03060D : 0xFFFFE39A);
        bubble.setText(thinking ? "…" : "J");
    }

    private void onTap() {
        if (busy) { if (tts != null) tts.stop(); return; }
        busy = true;
        hidePanel();
        if (tts != null) tts.stop();
        wantFresh = true;
        bubble.setVisibility(View.INVISIBLE); // que la burbuja no salga en la captura
        main.postDelayed(() -> {
            final Bitmap frame = lastFrame;
            bubble.setVisibility(View.VISIBLE);
            setBubbleThinking(true);
            work.execute(() -> analyze(frame));
        }, 450);
    }

    private void analyze(Bitmap frame) {
        String answer;
        try {
            if (frame == null) answer = "Todavía no tengo imagen de la pantalla. Toca otra vez.";
            else if (!LlamaEngine.brainLoaded) answer = "Abre Jarvis una vez para que cargue su cerebro.";
            else if (!ensureVision()) answer = "Primero descarga la visión en Jarvis.";
            else {
                File jpg = new File(getCacheDir(), "pantalla.jpg");
                Bitmap small = scale(frame, 768);
                try (FileOutputStream o = new FileOutputStream(jpg)) { small.compress(Bitmap.CompressFormat.JPEG, 88, o); }
                byte[] d = LlamaEngine.nativeVisionDescribe(jpg.getAbsolutePath(),
                    "This is a phone screenshot. In one or two short sentences, say which app it is and what the main content or text is.",
                    70, null);
                jpg.delete();
                String desc = d == null ? "" : new String(d, StandardCharsets.UTF_8).trim();
                byte[] r = LlamaEngine.nativeGenerate(
                    "[Lo que hay ahora en la pantalla del teléfono, descripción automática en inglés]: " + desc
                        + "\n\nDile al usuario en español, en una o dos frases cortas, qué hay en su pantalla. Sin relleno.",
                    80, piece -> true);
                answer = r == null ? desc : new String(r, StandardCharsets.UTF_8).trim();
            }
        } catch (Throwable t) {
            answer = "No pude analizar la pantalla.";
        }
        final String text = firstSentences(answer.replaceAll("[*#_`]", ""), 2);
        main.post(() -> {
            setBubbleThinking(false);
            showPanel(text);
            if (tts != null) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "pantalla");
            busy = false;
        });
    }

    private boolean ensureVision() {
        if (visionModel == null || visionMmproj == null) return false;
        File dir = new File(getFilesDir(), "models");
        File m = new File(dir, visionModel), p = new File(dir, visionMmproj);
        if (!m.exists() || !p.exists()) return false;
        if (m.getName().equals(LlamaEngine.visionLoaded)) return true;
        int threads = Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors()));
        String err = LlamaEngine.nativeVisionLoad(m.getAbsolutePath(), p.getAbsolutePath(), threads);
        if (err != null) return false;
        LlamaEngine.visionLoaded = m.getName();
        return true;
    }

    private static Bitmap scale(Bitmap b, int max) {
        float k = Math.min(1f, (float) max / Math.max(b.getWidth(), b.getHeight()));
        return k >= 1f ? b : Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * k), Math.round(b.getHeight() * k), true);
    }

    private static String firstSentences(String t, int n) {
        String[] parts = t.trim().split("(?<=[.!?…])\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(n, parts.length); i++) sb.append(i > 0 ? " " : "").append(parts[i]);
        return sb.length() == 0 ? t : sb.toString();
    }

    // ------------------------------------------------------------------ panel con la respuesta

    private void showPanel(String text) {
        hidePanel();
        panel = new TextView(this);
        panel.setText(text);
        panel.setTextColor(0xFFF4E6C4);
        panel.setTextSize(16);
        panel.setPadding(dp(16), dp(12), dp(16), dp(12));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xF203060D);
        bg.setStroke(dp(1), 0xFFFFB52E);
        bg.setCornerRadius(dp(4));
        panel.setBackground(bg);
        panel.setOnClickListener(v -> { if (tts != null) tts.stop(); hidePanel(); });
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP;
        lp.y = dp(48);
        lp.horizontalMargin = 0.04f;
        wm.addView(panel, lp);
        final TextView shown = panel;
        main.postDelayed(() -> { if (panel == shown) hidePanel(); }, 15000);
    }

    private void hidePanel() {
        if (panel != null) { try { wm.removeView(panel); } catch (Exception ignored) {} panel = null; }
    }

    // ------------------------------------------------------------------ notificación obligatoria

    private void startForegroundCompat() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Jarvis viendo la pantalla", NotificationManager.IMPORTANCE_LOW));
        }
        PendingIntent stop = PendingIntent.getService(this, 1,
            new Intent(this, ScreenService.class).setAction("stop"), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent open = PendingIntent.getActivity(this, 2,
            new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        Notification n = b.setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("Jarvis puede ver tu pantalla")
            .setContentText("Toca la burbuja dorada para preguntarle qué hay.")
            .setOngoing(true)
            .setContentIntent(open)
            .addAction(new Notification.Action.Builder(null, "Detener", stop).build())
            .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(NOTIF_ID, n);
    }

    @Override
    public void onDestroy() {
        running = false;
        hidePanel();
        if (bubble != null) { try { wm.removeView(bubble); } catch (Exception ignored) {} }
        if (display != null) display.release();
        if (reader != null) reader.close();
        if (projection != null) { try { projection.stop(); } catch (Exception ignored) {} }
        if (tts != null) tts.shutdown();
        if (capThread != null) capThread.quitSafely();
        work.shutdownNow();
        super.onDestroy();
    }
}
