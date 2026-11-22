// Puente JNI entre la app y llama.cpp: carga un modelo GGUF y conversa con memoria (caché KV).
#include <jni.h>
#include <atomic>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

#include "llama.h"

namespace {

std::mutex g_mutex;
llama_model * g_model = nullptr;
llama_context * g_ctx = nullptr;
llama_sampler * g_smpl = nullptr;
llama_batch_ext * g_batch = nullptr;
const llama_vocab * g_vocab = nullptr;
std::vector<llama_chat_message> g_messages;
int g_prev_len = 0;
std::atomic<bool> g_stop{false};

char * dup(const std::string & s) { return strdup(s.c_str()); }

void free_messages() {
    for (auto & m : g_messages) { free((void *) m.role); free((void *) m.content); }
    g_messages.clear();
    g_prev_len = 0;
}

void unload_locked() {
    free_messages();
    if (g_batch) { llama_batch_ext_free(g_batch); g_batch = nullptr; }
    if (g_smpl) { llama_sampler_free(g_smpl); g_smpl = nullptr; }
    if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
    g_vocab = nullptr;
}

std::string jstr(JNIEnv * env, jstring s) {
    if (!s) return "";
    const jsize len = env->GetStringUTFLength(s);
    const char * c = env->GetStringUTFChars(s, nullptr);
    std::string out(c, len);
    env->ReleaseStringUTFChars(s, c);
    return out;
}

jbyteArray bytes(JNIEnv * env, const std::string & s) {
    jbyteArray a = env->NewByteArray((jsize) s.size());
    env->SetByteArrayRegion(a, 0, (jsize) s.size(), (const jbyte *) s.data());
    return a;
}

// Cuántos bytes del final forman un carácter UTF-8 todavía incompleto.
size_t incomplete_utf8_tail(const std::string & s) {
    size_t n = s.size();
    for (size_t i = 1; i <= 4 && i <= n; ++i) {
        unsigned char c = (unsigned char) s[n - i];
        if ((c & 0xC0) == 0x80) continue;            // byte de continuación
        size_t need = (c & 0x80) == 0 ? 1 : (c & 0xE0) == 0xC0 ? 2 : (c & 0xF0) == 0xE0 ? 3 : 4;
        return need > i ? i : 0;
    }
    return 0;
}

bool format_prompt(std::string & prompt) {
    const char * tmpl = llama_model_chat_template(g_model, nullptr);
    std::vector<char> buf(llama_n_ctx(g_ctx) * 4);
    int len = llama_chat_apply_template(tmpl, g_messages.data(), g_messages.size(), true, buf.data(), buf.size());
    if (len > (int) buf.size()) {
        buf.resize(len);
        len = llama_chat_apply_template(tmpl, g_messages.data(), g_messages.size(), true, buf.data(), buf.size());
    }
    if (len < 0) return false;
    prompt.assign(buf.begin() + g_prev_len, buf.begin() + len);
    return true;
}

// Mantiene solo el mensaje de sistema y el último del usuario cuando se llena la memoria.
void trim_history_locked() {
    llama_memory_clear(llama_get_memory(g_ctx), true);
    if (g_messages.size() > 2) {
        llama_chat_message sys = g_messages.front(), last = g_messages.back();
        for (size_t i = 1; i + 1 < g_messages.size(); ++i) { free((void *) g_messages[i].role); free((void *) g_messages[i].content); }
        g_messages = {sys, last};
    }
    g_prev_len = 0;
}

}  // namespace

extern "C" {

JNIEXPORT jstring JNICALL
Java_com_jarvis_asistente_LlamaEngine_nativeLoad(JNIEnv * env, jclass, jstring jpath, jint n_ctx, jint n_threads) {
    std::lock_guard<std::mutex> lock(g_mutex);
    unload_locked();
    llama_log_set([](enum ggml_log_level, const char *, void *) {}, nullptr);
    llama_backend_init();

    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    g_model = llama_model_load_from_file(jstr(env, jpath).c_str(), mp);
    if (!g_model) return env->NewStringUTF("No pude abrir el modelo (archivo dañado o incompleto).");
    g_vocab = llama_model_get_vocab(g_model);

    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = n_ctx;
    cp.n_batch = n_ctx;
    cp.n_threads = n_threads;
    cp.n_threads_batch = n_threads;
    g_ctx = llama_init_from_model(g_model, cp);
    if (!g_ctx) { unload_locked(); return env->NewStringUTF("No hay memoria suficiente para este modelo."); }

    g_smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(g_smpl, llama_sampler_init_top_k(40));
    llama_sampler_chain_add(g_smpl, llama_sampler_init_min_p(0.05f, 1));
    llama_sampler_chain_add(g_smpl, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(g_smpl, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
    g_batch = llama_batch_ext_init(g_ctx);
    return nullptr;  // sin error
}

JNIEXPORT void JNICALL
Java_com_jarvis_asistente_LlamaEngine_nativeReset(JNIEnv * env, jclass, jstring jsystem) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_ctx) return;
    free_messages();
    llama_memory_clear(llama_get_memory(g_ctx), true);
    llama_sampler_reset(g_smpl);
    const std::string sys = jstr(env, jsystem);
    if (!sys.empty()) g_messages.push_back({dup("system"), dup(sys)});
}

JNIEXPORT void JNICALL
Java_com_jarvis_asistente_LlamaEngine_nativeStop(JNIEnv *, jclass) { g_stop = true; }

JNIEXPORT void JNICALL
Java_com_jarvis_asistente_LlamaEngine_nativeUnload(JNIEnv *, jclass) {
    std::lock_guard<std::mutex> lock(g_mutex);
    unload_locked();
}

// Devuelve la respuesta completa (UTF-8). Llama a callback.onToken(byte[]) con cada trozo; si devuelve false, se detiene.
JNIEXPORT jbyteArray JNICALL
Java_com_jarvis_asistente_LlamaEngine_nativeGenerate(JNIEnv * env, jclass, jstring juser, jint max_tokens, jobject callback) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_ctx) return nullptr;
    g_stop = false;
    jmethodID on_token = env->GetMethodID(env->GetObjectClass(callback), "onToken", "([B)Z");

    g_messages.push_back({dup("user"), dup(jstr(env, juser))});
    std::string prompt;
    if (!format_prompt(prompt)) return nullptr;

    const bool is_first = llama_memory_seq_pos_max(llama_get_memory(g_ctx), 0) == -1;
    int n = -llama_tokenize(g_vocab, prompt.c_str(), (int32_t) prompt.size(), nullptr, 0, is_first, true);
    std::vector<llama_token> toks(n);
    llama_tokenize(g_vocab, prompt.c_str(), (int32_t) prompt.size(), toks.data(), n, is_first, true);

    const int n_ctx = llama_n_ctx(g_ctx);
    int used = llama_memory_seq_pos_max(llama_get_memory(g_ctx), 0) + 1;
    if (used + n + 16 > n_ctx) {  // memoria llena: olvidar la conversación antigua y volver a formatear
        trim_history_locked();
        if (!format_prompt(prompt)) return nullptr;
        n = -llama_tokenize(g_vocab, prompt.c_str(), (int32_t) prompt.size(), nullptr, 0, true, true);
        toks.assign(n, 0);
        llama_tokenize(g_vocab, prompt.c_str(), (int32_t) prompt.size(), toks.data(), n, true, true);
        used = 0;
        if (n + 16 > n_ctx) return nullptr;
    }

    std::string response, pending;
    const llama_token * cur = toks.data();
    int n_cur = n;
    llama_token tok;
    for (int generated = 0; generated < max_tokens && !g_stop; ++generated) {
        if (used + n_cur > n_ctx) break;
        llama_batch_ext_clear(g_batch);
        for (int i = 0; i < n_cur; ++i) {
            const int32_t idx = llama_batch_ext_add_token(g_batch, 0, cur[i]);
            const llama_pos pos = used + i;
            llama_batch_ext_set_pos(g_batch, idx, &pos);
        }
        llama_batch_ext_set_output_logits(g_batch, n_cur - 1, true);
        if (llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, g_batch) != 0) break;
        used += n_cur;

        tok = llama_sampler_sample(g_smpl, g_ctx, -1);
        if (llama_vocab_is_eog(g_vocab, tok)) break;
        char buf[256];
        const int len = llama_token_to_piece(g_vocab, tok, buf, sizeof(buf), 0, false);
        if (len > 0) {
            pending.append(buf, len);
            const size_t keep = incomplete_utf8_tail(pending);
            const std::string ready = pending.substr(0, pending.size() - keep);
            pending.erase(0, pending.size() - keep);
            if (!ready.empty()) {
                response += ready;
                jbyteArray arr = bytes(env, ready);
                const jboolean go = env->CallBooleanMethod(callback, on_token, arr);
                env->DeleteLocalRef(arr);
                if (!go) g_stop = true;
            }
        }
        cur = &tok;
        n_cur = 1;
    }
    // Si se cortó, la memoria no incluye el último token: se reinicia la siguiente vez desde el historial.
    g_messages.push_back({dup("assistant"), dup(response)});
    const char * tmpl = llama_model_chat_template(g_model, nullptr);
    g_prev_len = llama_chat_apply_template(tmpl, g_messages.data(), g_messages.size(), false, nullptr, 0);
    if (g_prev_len < 0) g_prev_len = 0;
    if (g_stop) { llama_memory_clear(llama_get_memory(g_ctx), true); g_prev_len = 0; }
    return bytes(env, response);
}

}  // extern "C"
