package com.jarvis.asistente;

/** Acceso a llama.cpp (código abierto) compilado dentro de la app. */
public final class LlamaEngine {
    static { System.loadLibrary("jarvis_llm"); }

    public interface TokenCallback { boolean onToken(byte[] piece); }

    /** Devuelve null si cargó bien, o el mensaje de error. */
    static native String nativeLoad(String path, int nCtx, int nThreads);
    static native void nativeReset(String system);
    static native byte[] nativeGenerate(String user, int maxTokens, TokenCallback cb);
    static native void nativeStop();
    static native void nativeUnload();

    private LlamaEngine() {}
}
