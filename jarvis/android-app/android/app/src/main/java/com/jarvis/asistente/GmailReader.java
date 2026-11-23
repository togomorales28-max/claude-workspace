package com.jarvis.asistente;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Pattern;

/**
 * Lee (solo lectura) los correos sin leer de Gmail y los ordena de más a menos importante.
 * El orden usa reglas fijas (rápido y sin inventar): etiquetas de Gmail, remitente y palabras clave.
 */
public final class GmailReader {

    public static final class Mail {
        public String id, from, email, subject, snippet, category = "";
        public boolean important, starred;
        public long date;
        public int score;
    }

    private static final String API = "https://gmail.googleapis.com/gmail/v1/users/me/";
    private static final Pattern URGENT = Pattern.compile(
        "\\b(urgente|importante|inmediato|hoy|vence|vencimiento|vencid[oa]|pago|pagar|factura|cobro|cargo|adeudo|deposito|transferencia|"
        + "banco|tarjeta|cita|entrevista|reunion|junta|contrato|seguridad|contrasena|codigo|verificacion|acceso|alerta|"
        + "aprobad[oa]|rechazad[oa]|oferta|cancelad[oa]|reembolso|envio|entrega|paquete|examen|tarea|calificacion)\\b");
    private static final Pattern AUTOMATED = Pattern.compile(
        "(no-?reply|noreply|newsletter|boletin|notificacion|notification|marketing|promo|mailer|news@|info@|hello@|team@)");

    private GmailReader() {}

    public static List<Mail> unread(String token, int max) throws Exception {
        String q = URLEncoder.encode("is:unread in:inbox newer_than:3d", "UTF-8");
        JSONObject list = new JSONObject(get(API + "messages?maxResults=" + max + "&q=" + q, token));
        JSONArray ids = list.optJSONArray("messages");
        List<Mail> out = new ArrayList<>();
        if (ids == null) return out;
        ExecutorService pool = Executors.newFixedThreadPool(6);
        List<Future<Mail>> jobs = new ArrayList<>();
        for (int i = 0; i < ids.length(); i++) {
            final String id = ids.getJSONObject(i).getString("id");
            jobs.add(pool.submit(() -> read(id, token)));
        }
        for (Future<Mail> f : jobs) { try { out.add(f.get()); } catch (Exception ignored) {} }
        pool.shutdown();
        for (Mail m : out) m.score = score(m);
        out.sort(Comparator.comparingInt((Mail m) -> -m.score).thenComparingLong(m -> -m.date));
        return out;
    }

    private static Mail read(String id, String token) throws Exception {
        JSONObject j = new JSONObject(get(API + "messages/" + id
            + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject", token));
        Mail m = new Mail();
        m.id = id;
        m.snippet = WebSearch.text(j.optString("snippet", ""));
        m.date = j.optLong("internalDate", 0);
        JSONArray labels = j.optJSONArray("labelIds");
        if (labels != null) for (int i = 0; i < labels.length(); i++) {
            String l = labels.getString(i);
            if (l.equals("IMPORTANT")) m.important = true;
            else if (l.equals("STARRED")) m.starred = true;
            else if (l.startsWith("CATEGORY_")) m.category = l.substring(9).toLowerCase(Locale.ROOT);
        }
        JSONArray headers = j.getJSONObject("payload").optJSONArray("headers");
        String from = "";
        m.subject = "(sin asunto)";
        if (headers != null) for (int i = 0; i < headers.length(); i++) {
            JSONObject h = headers.getJSONObject(i);
            if (h.optString("name").equalsIgnoreCase("From")) from = h.optString("value");
            if (h.optString("name").equalsIgnoreCase("Subject") && !h.optString("value").trim().isEmpty()) m.subject = h.optString("value").trim();
        }
        int lt = from.indexOf('<');
        m.email = lt >= 0 ? from.substring(lt + 1).replace(">", "").trim() : from.trim();
        m.from = (lt > 0 ? from.substring(0, lt) : from).replace("\"", "").trim();
        if (m.from.isEmpty()) m.from = m.email;
        return m;
    }

    /** Puntuación de importancia: más alto = más importante. */
    static int score(Mail m) {
        int s = 0;
        if (m.important) s += 4;
        if (m.starred) s += 3;
        switch (m.category) {
            case "personal": case "": s += 2; break;
            case "updates": s -= 1; break;
            case "forums": s -= 2; break;
            case "social": s -= 3; break;
            case "promotions": s -= 5; break;
        }
        String who = norm(m.from + " " + m.email);
        if (AUTOMATED.matcher(who).find()) s -= 2;
        if (URGENT.matcher(norm(m.subject + " " + m.snippet)).find()) s += 3;
        if (System.currentTimeMillis() - m.date < 6 * 3600 * 1000L) s += 1; // llegó hace poco
        return s;
    }

    private static String norm(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    private static String get(String url, String token) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setRequestProperty("Authorization", "Bearer " + token);
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
        if (code == 401) throw new Exception("token");
        if (code == 403) throw new Exception("Gmail API no está activada en tu proyecto de Google Cloud.");
        if (code >= 400) throw new Exception("Gmail respondió " + code);
        return b.toString("UTF-8");
    }
}
