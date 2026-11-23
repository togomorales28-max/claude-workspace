import com.jarvis.asistente.LlamaEngine;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

/** Prueba real del puente nativo fuera de Android: carga SmolVLM y describe una imagen. */
public class VisionTest {
    public static void main(String[] a) throws Exception {
        Method load = m("nativeVisionLoad", String.class, String.class, int.class);
        Method desc = m("nativeVisionDescribe", String.class, String.class, int.class, LlamaEngine.TokenCallback.class);
        long t = System.currentTimeMillis();
        System.out.println("carga -> " + load.invoke(null, a[0], a[1], 4) + " (" + (System.currentTimeMillis() - t) + " ms)");
        for (String prompt : new String[] {
            "Describe this image in detail: the main objects, people, colors, any visible text, and where things are.",
            "Describe this image in detail, and transcribe all the visible text exactly, word by word." }) {
            t = System.currentTimeMillis();
            byte[] r = (byte[]) desc.invoke(null, a[2], prompt, 120, (LlamaEngine.TokenCallback) p -> true);
            System.out.println("\n[" + prompt.substring(0, 30) + "…] " + (System.currentTimeMillis() - t) + " ms:\n"
                + (r == null ? "NULL (falló)" : new String(r, StandardCharsets.UTF_8)));
        }
        m("nativeVisionUnload").invoke(null);
        System.out.println("\nliberado OK");
    }
    static Method m(String n, Class<?>... p) throws Exception { Method x = LlamaEngine.class.getDeclaredMethod(n, p); x.setAccessible(true); return x; }
}
