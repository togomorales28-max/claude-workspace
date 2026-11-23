package com.jarvis.asistente;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Búsqueda gratis y sin llaves: marcadores deportivos (ESPN), DuckDuckGo y Wikipedia.
 * Java puro (más org.json) para poder probarla fuera de Android.
 */
public final class WebSearch {

    public static final class Result {
        public final String title, snippet, source;
        Result(String title, String snippet, String source) { this.title = title; this.snippet = snippet; this.source = source; }
        @Override public String toString() { return "[" + source + "] " + title + " — " + snippet; }
    }

    private static final String UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

    private static final String[] LEAGUES = {
        "football/nfl", "basketball/nba", "baseball/mlb", "hockey/nhl",
        "soccer/mex.1", "soccer/usa.1", "soccer/esp.1", "soccer/eng.1", "soccer/uefa.champions",
    };
    private static final Pattern SPORTS = Pattern.compile(
        "\\b(partido|partidos|juego|juegan|jugo|juega|gano|ganaron|perdio|marcador|resultado|score|vs|contra|liga|nfl|nba|mlb|nhl|futbol|beisbol|basquet|americano|jornada|temporada|campeonato)\\b");

    // Palabras comunes del español que también son nombres de equipos o ciudades: no cuentan como coincidencia.
    private static final java.util.Set<String> COMMON = new java.util.HashSet<>(java.util.Arrays.asList(
        "como", "cuando", "donde", "hoy", "real", "city", "united", "club", "atletico", "deportivo", "sporting", "nacional"));
    private static final Pattern NEWS = Pattern.compile(
        "\\b(noticia|noticias|hoy|ayer|ultim[oa]s?|actual|reciente|paso|sucedio|eleccion|presidente|gobierno|clima|precio|dolar|estreno)\\b");

    private WebSearch() {}

    public static List<Result> search(String query) {
        final String q = norm(query);
        ExecutorService pool = Executors.newFixedThreadPool(4);
        List<Future<List<Result>>> jobs = new ArrayList<>();
        if (SPORTS.matcher(q).find()) for (String lg : LEAGUES) jobs.add(pool.submit(() -> sports(lg, q)));
        Future<List<Result>> news = NEWS.matcher(q).find() ? pool.submit(() -> googleNews(query)) : null;
        Future<List<Result>> ddg = pool.submit(() -> duckduckgo(query));
        List<Result> out = new ArrayList<>();
        for (Future<List<Result>> f : jobs) out.addAll(safe(f));
        if (news != null) out.addAll(safe(news));
        out.addAll(safe(ddg));
        if (out.size() < 2 && news == null) out.addAll(safe(pool.submit(() -> googleNews(query))));
        if (out.size() < 2) out.addAll(safe(pool.submit(() -> wikipedia(query))));
        pool.shutdownNow();
        return out.size() > 8 ? out.subList(0, 8) : out;
    }

    private static List<Result> safe(Future<List<Result>> f) {
        try { return f.get(12, TimeUnit.SECONDS); } catch (Exception e) { return new ArrayList<>(); }
    }

    // ------------------------------------------------------------------ deportes (ESPN, sin llave)

    static List<Result> sports(String league, String q) throws Exception {
        List<Result> out = new ArrayList<>();
        JSONObject root = new JSONObject(get("https://site.api.espn.com/apis/site/v2/sports/" + league + "/scoreboard", null));
        JSONArray events = root.optJSONArray("events");
        if (events == null) return out;
        String leagueName = root.optJSONArray("leagues") != null && root.getJSONArray("leagues").length() > 0
            ? root.getJSONArray("leagues").getJSONObject(0).optString("abbreviation", league) : league;
        for (int i = 0; i < events.length(); i++) {
            JSONObject ev = events.getJSONObject(i);
            JSONObject comp = ev.getJSONArray("competitions").getJSONObject(0);
            JSONArray teams = comp.getJSONArray("competitors");
            boolean match = false;
            StringBuilder line = new StringBuilder();
            for (int t = 0; t < teams.length(); t++) {
                JSONObject c = teams.getJSONObject(t);
                JSONObject team = c.getJSONObject("team");
                for (String key : new String[] { "name", "shortDisplayName", "displayName", "location" }) {
                    String n = norm(team.optString(key, ""));
                    if (n.length() >= 4 && !COMMON.contains(n) && containsWord(q, n)) match = true;
                }
                if (t > 0) line.append(" - ");
                line.append(team.optString("displayName")).append(' ').append(c.optString("score", ""));
            }
            if (!match) continue;
            JSONObject st = comp.optJSONObject("status") != null ? comp.getJSONObject("status") : ev.optJSONObject("status");
            String state = st == null ? "" : st.getJSONObject("type").optString("detail", st.getJSONObject("type").optString("shortDetail", ""));
            out.add(new Result(leagueName + ": " + ev.optString("name"), line.toString().trim() + " · " + state + " · fecha " + ev.optString("date", ""), "ESPN"));
        }
        return out;
    }

    // ------------------------------------------------------------------ Google News (RSS público, sin llave)

    private static final Pattern RSS_ITEM = Pattern.compile("<item>(.*?)</item>", Pattern.DOTALL);

    static List<Result> googleNews(String query) throws Exception {
        String url = "https://news.google.com/rss/search?hl=es-419&gl=MX&ceid=MX:es-419&q=" + URLEncoder.encode(query, "UTF-8");
        return parseRss(get(url, null));
    }

    static List<Result> parseRss(String xml) {
        List<Result> out = new ArrayList<>();
        Matcher m = RSS_ITEM.matcher(xml);
        while (m.find() && out.size() < 4) {
            String item = m.group(1);
            String title = text(cdata(tag(item, "title")));
            String source = text(cdata(tag(item, "source")));
            String date = tag(item, "pubDate");
            if (!source.isEmpty() && title.endsWith(" - " + source)) title = title.substring(0, title.length() - source.length() - 3);
            if (!title.isEmpty()) out.add(new Result(title, "publicado " + date, source.isEmpty() ? "Google News" : source));
        }
        return out;
    }

    private static String tag(String xml, String name) {
        Matcher m = Pattern.compile("<" + name + "[^>]*>(.*?)</" + name + ">", Pattern.DOTALL).matcher(xml);
        return m.find() ? m.group(1).trim() : "";
    }

    private static String cdata(String s) { return s.replace("<![CDATA[", "").replace("]]>", ""); }

    // ------------------------------------------------------------------ DuckDuckGo (HTML, sin llave)

    private static final Pattern DDG_LINK = Pattern.compile("<a[^>]*class=\"result__a\"[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>", Pattern.DOTALL);
    private static final Pattern DDG_SNIPPET = Pattern.compile("class=\"result__snippet\"[^>]*>(.*?)</a>", Pattern.DOTALL);

    static List<Result> duckduckgo(String query) throws Exception {
        return parseDuckDuckGo(get("https://html.duckduckgo.com/html/", "q=" + URLEncoder.encode(query, "UTF-8") + "&kl=mx-es"));
    }

    static List<Result> parseDuckDuckGo(String html) {
        List<Result> out = new ArrayList<>();
        Matcher a = DDG_LINK.matcher(html), s = DDG_SNIPPET.matcher(html);
        int from = 0;
        while (a.find() && out.size() < 5) {
            String href = a.group(1);
            String title = text(a.group(2));
            String snippet = "";
            if (s.find(Math.max(from, a.end()))) { snippet = text(s.group(1)); from = s.end(); }
            if (href.contains("duckduckgo.com/y.js") || title.isEmpty()) continue; // anuncios
            out.add(new Result(title, snippet, host(href)));
        }
        return out;
    }

    private static String host(String href) {
        try {
            Matcher m = Pattern.compile("uddg=([^&]+)").matcher(href);
            String u = m.find() ? URLDecoder.decode(m.group(1), "UTF-8") : href;
            return new URL(u.startsWith("//") ? "https:" + u : u).getHost().replaceFirst("^www\\.", "");
        } catch (Exception e) { return "web"; }
    }

    // ------------------------------------------------------------------ Wikipedia (respaldo)

    static List<Result> wikipedia(String query) throws Exception {
        String url = "https://es.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=" + URLEncoder.encode(query, "UTF-8");
        JSONArray arr = new JSONObject(get(url, null)).getJSONObject("query").getJSONArray("search");
        List<Result> out = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.getJSONObject(i);
            out.add(new Result(o.optString("title"), text(o.optString("snippet")), "Wikipedia"));
        }
        return out;
    }

    // ------------------------------------------------------------------ utilidades

    static String get(String url, String postBody) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(10000);
        c.setRequestProperty("User-Agent", UA);
        c.setRequestProperty("Accept-Language", "es-MX,es;q=0.9");
        if (postBody != null) {
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            try (OutputStream o = c.getOutputStream()) { o.write(postBody.getBytes(StandardCharsets.UTF_8)); }
        }
        int code = c.getResponseCode();
        if (code >= 400) throw new Exception("HTTP " + code);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0 && b.size() < 3_000_000) b.write(buf, 0, n);
            return b.toString("UTF-8");
        }
    }

    static String text(String html) {
        String t = html.replaceAll("<[^>]+>", "")
            .replace("&amp;", "&").replace("&quot;", "\"").replace("&#x27;", "'").replace("&#39;", "'")
            .replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ");
        Matcher m = Pattern.compile("&#(x?)([0-9a-fA-F]+);").matcher(t);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            int cp = Integer.parseInt(m.group(2), m.group(1).isEmpty() ? 10 : 16);
            m.appendReplacement(sb, Matcher.quoteReplacement(new String(Character.toChars(cp))));
        }
        m.appendTail(sb);
        return sb.toString().replaceAll("\\s+", " ").trim();
    }

    static String norm(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    private static boolean containsWord(String haystack, String word) {
        return Pattern.compile("(^|[^a-z0-9])" + Pattern.quote(word) + "([^a-z0-9]|$)").matcher(haystack).find();
    }

    /** Prueba fuera de Android: java WebSearch "pregunta" */
    public static void main(String[] args) {
        String q = args.length > 0 ? String.join(" ", args) : "partido 49ers vikings";
        long t = System.currentTimeMillis();
        List<Result> r = search(q);
        System.out.println(r.size() + " resultados en " + (System.currentTimeMillis() - t) + " ms para: " + q);
        for (Result x : r) System.out.println("  " + x);
        try { System.out.println("  (DuckDuckGo solo: " + duckduckgo(q).size() + " resultados)"); }
        catch (Exception e) { System.out.println("  (DuckDuckGo falló: " + e.getMessage() + ")"); }
    }
}
