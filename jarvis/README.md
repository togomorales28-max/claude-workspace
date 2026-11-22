# Jarvis

Tu asistente de voz con núcleo holográfico. El **cerebro vive en tu PC con Windows** (Jarvis Hub) y lo usas desde:

- **El PC**: ventana propia con doble clic en `Jarvis.bat`.
- **Tu Android**: app Jarvis (APK) que se conecta a tu PC desde cualquier lugar por Tailscale.

```
 Android (app Jarvis) ──Tailscale (privado, cifrado)──┐
                                                      ▼
 PC: Jarvis Hub (server.js, solo 127.0.0.1) ── Cerebro: Claude Code  o  Ollama (código abierto)
                                             ── Oído:    Whisper (código abierto)
                                             ── Voz:     Piper (código abierto) o ElevenLabs
                                             ── Gmail:   solo lectura, avisos de correos nuevos
```

## Permisos que necesita cada pieza

| Pieza | Qué permiso | Dónde | Por defecto |
|---|---|---|---|
| Micrófono | Usar el micrófono del PC o del teléfono. Con Whisper el audio va solo a tu PC. | Aviso del navegador / Android | Te lo pide la primera vez |
| Claude Code | Tu sesión y tu plan de Claude. | `claude` instalado | Sí, si `BRAIN=claude` |
| Ollama | Ninguno: corre en tu PC sin internet. | Ollama instalado | Si `BRAIN=ollama` o lo eliges en la app |
| Archivos / web | `Read Glob Grep WebSearch WebFetch` (solo con Claude Code) | `JARVIS_ALLOWED_TOOLS` | **Sí** (solo lectura) |
| Control del PC | `Bash`, `Edit`, `Write` (solo con Claude Code) | `JARVIS_ALLOWED_TOOLS` | **No** |
| Gmail | `gmail.readonly`: leer remitente, asunto y vista previa. **No** puede enviar, borrar ni marcar como leído. El acceso se guarda solo en `data/` de tu PC. Los correos que pidas se mandan al cerebro elegido (Claude o Ollama local). | Botón «Conectar Gmail» | **No** |
| Acceso desde el celular | Tu PC queda visible **solo para tus dispositivos** en Tailscale, y además Jarvis exige una clave. | Tailscale + clave | **No** |
| Voz ElevenLabs | El texto de cada respuesta va a ElevenLabs; gasta créditos. | `ELEVENLABS_API_KEY` | No |

## 1 · Encender Jarvis en el PC

Requisitos: **Node 18+** y **Edge o Chrome**. Después, según lo que quieras usar:

| Para… | Instala | Comando |
|---|---|---|
| Cerebro de código abierto | [Ollama](https://ollama.com/download) | `ollama pull qwen2.5:7b` |
| Cerebro Claude | Claude Code | `claude` (inicia sesión una vez) |
| Oír con Whisper | [Python 3.10+](https://python.org) (marca *Add to PATH*) | `pip install faster-whisper` |
| Voz libre Piper | — | `pip install piper-tts` y `python -m piper.download_voices es_MX-ald-medium` |

```bash
cd jarvis
copy .env.example .env        # Mac/Linux: cp .env.example .env
notepad .env                  # elige BRAIN, y si usas Piper: TTS_PROVIDER=piper y PIPER_MODEL=es_MX-ald-medium.onnx
npm run app                   # o doble clic en Jarvis.bat
```

La primera vez, Whisper descarga su modelo (unos 500 MB con `small`). La ventana negra muestra el estado de cada
pieza y la **clave para el celular**.

En la app: toca la esfera o pulsa **Espacio**, habla, y Jarvis detecta solo cuando terminas. Arriba a la derecha
eliges el **cerebro** (Claude Code o código abierto) en cualquier momento.

## 2 · Conectar Gmail (solo lectura)

Una sola vez, en el PC:

1. Entra a <https://console.cloud.google.com> con tu cuenta de Google y crea un proyecto (por ejemplo «Jarvis»).
2. **APIs y servicios → Biblioteca** → busca **Gmail API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth** (o *Google Auth Platform*):
   tipo **Externo**, nombre «Jarvis», tu correo. En **Usuarios de prueba** añade tu propio Gmail.
   Luego pulsa **Publicar app** (*In production*): si se queda «en prueba», Google corta el acceso cada 7 días.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación de escritorio**.
   Descarga el JSON y guárdalo como **`jarvis/google-oauth.json`** (no se sube a git).
5. Reinicia Jarvis y pulsa **Conectar Gmail**. Google avisará de que «la app no está verificada»: es normal porque
   la app eres tú. Pulsa *Configuración avanzada → Ir a Jarvis*, acepta **solo lectura**, y listo.

Desde ahí:
- Pregúntale «¿tengo correos nuevos?», «resúmeme mis correos de hoy», o pulsa **Resumir correos**.
- Cada `GMAIL_POLL_MINUTES` minutos revisa si llegaron correos y, con **Avisarme de correos nuevos** activado,
  te dice en voz alta quién escribe y qué quiere, mientras tengas Jarvis abierto.
- Para quitar el acceso: <https://myaccount.google.com/permissions> → Jarvis → Quitar acceso.

## 3 · Usarlo desde tu Android

1. **Tailscale** (gratis, red privada entre tus dispositivos): instálalo en el PC (<https://tailscale.com/download>)
   y en el teléfono (Play Store), e inicia sesión con **la misma cuenta** en los dos.
2. En el PC, con Jarvis encendido, abre PowerShell y ejecuta una vez:
   ```
   tailscale serve --bg 7777
   ```
   Te muestra una dirección como `https://mi-pc.tu-red.ts.net`: solo tus dispositivos la pueden abrir.
   (Si te pide activar HTTPS en tu red de Tailscale, acepta.)
3. **Instala la app**: descarga `Jarvis-apk` desde la pestaña **Actions** del repositorio en GitHub
   (último run de «Jarvis APK»), descomprime y abre `app-debug.apk` en el teléfono. Android te pedirá permitir
   «instalar apps de fuentes desconocidas» para tu navegador o gestor de archivos.
4. Abre Jarvis, escribe la dirección de Tailscale y la clave que muestra tu PC, y pulsa **Conectar**.
   Acepta el permiso de micrófono.

En la app Android la voz sale del PC, así que configura **Piper** (gratis) o ElevenLabs en el `.env`;
la voz del navegador no existe dentro de la app.

¿Sin APK? En Chrome del teléfono abre `https://mi-pc.tu-red.ts.net/#k=TU_CLAVE` y usa menú ⋮ → *Instalar app*.

## 4 · Que arranque solo

- Windows: `Win + R` → `shell:startup` → pon un acceso directo a `Jarvis.bat`.
- Ollama y Tailscale ya arrancan solos con Windows por defecto.

## Problemas comunes

| Mensaje | Solución |
|---|---|
| `No puedo hablar con Ollama` | Abre Ollama (icono de llama junto al reloj) o ejecuta `ollama serve`. |
| `Falta el modelo qwen2.5:7b` | `ollama pull qwen2.5:7b` |
| `Falta faster-whisper` | `pip install faster-whisper` y reinicia Jarvis. |
| `Falta la clave de Jarvis` (celular) | En la app pulsa **Cambiar dirección** y vuelve a escribir la clave. |
| `No hay conexión con tu PC` | PC encendido, Jarvis abierto y Tailscale conectado en los dos equipos. |
| Gmail: «acceso bloqueado» | Añade tu correo en **Usuarios de prueba** (paso 3 de Gmail). |
