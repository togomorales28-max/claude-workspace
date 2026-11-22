# Jarvis local

Asistente de voz que corre **solo en tu computador** (`http://localhost:7777`):
núcleo holográfico dorado, te escucha por el micrófono, piensa con **Claude Code**
(tus chats, herramientas y conectores) y te contesta con voz de **ElevenLabs**.

```
Navegador (micrófono + esfera)  ──►  server.js (127.0.0.1)  ──►  claude -p   (tu Claude Code)
                                                         └──►  ElevenLabs   (voz; la llave vive en .env)
```

## Permisos que necesita cada pieza

| Pieza | Qué permiso | Dónde se concede | Encendido por defecto |
|---|---|---|---|
| Micrófono | Acceso al micrófono del navegador. El reconocimiento de voz de Chrome/Edge envía el audio a los servidores de Google para transcribirlo. | Ventana emergente del navegador | Te lo pide al primer uso |
| Voz ElevenLabs | Tu llave de API. Se envía el **texto de cada respuesta** a ElevenLabs. Consume créditos de tu cuenta. | `ELEVENLABS_API_KEY` en `.env` | No hasta que pongas la llave |
| Claude Code (cerebro) | Usa tu sesión de Claude Code ya iniciada. Cada mensaje consume tu plan/uso de Claude. | `claude` instalado y con sesión iniciada | Sí |
| Tus chats de Claude Code | Lectura de `~/.claude/projects` para listar y retomar conversaciones. Al retomar una, Jarvis añade mensajes a ese chat. | Automático | Sí (solo lectura del listado) |
| Leer archivos / buscar en la web | `Read Glob Grep WebSearch WebFetch` | `JARVIS_ALLOWED_TOOLS` | **Sí** (solo lectura) |
| Funciones del computador | `Bash` (ejecutar comandos), `Edit Write` (modificar archivos). Puede hacer cualquier cosa que puedas hacer tú en la terminal. | `JARVIS_ALLOWED_TOOLS` | **No** |
| Correo | Herramientas MCP de tu conector de correo (leer, buscar, redactar, enviar). Se recomienda empezar solo con las de lectura. | Conector en Claude Code + `JARVIS_ALLOWED_TOOLS` | **No** |
| Calendario | Herramientas MCP de tu conector de calendario (ver, crear, mover eventos). | Conector en Claude Code + `JARVIS_ALLOWED_TOOLS` | **No** |

Cualquier herramienta que **no** esté en `JARVIS_ALLOWED_TOOLS` se rechaza sola, y la página te avisa con
“Permiso denegado: …”. Jarvis también tiene instrucciones de pedirte confirmación antes de enviar correos,
crear eventos o cambiar cosas en el computador.

**Seguridad del servidor:** escucha solo en `127.0.0.1` (nadie de tu red puede entrar), rechaza peticiones
de otras páginas web (comprueba `Host`, `Origin` y una cabecera propia) y la llave de ElevenLabs nunca llega al navegador.

## Cómo lo prendes

Requisitos: **Node 18+**, **Claude Code** instalado (`claude` en la terminal, sesión iniciada) y **Chrome o Edge**
(Firefox no trae reconocimiento de voz).

```bash
cd jarvis
cp .env.example .env          # en Windows: copy .env.example .env
# abre .env con tu editor y pega tu ELEVENLABS_API_KEY
npm start                     # o: node server.js
```

Abre **http://localhost:7777**, acepta el micrófono y:

- **Toca la esfera** o pulsa **Espacio** para hablar (vuelve a tocar para cortar).
- O escribe en la caja de abajo.
- **Manos libres**: vuelve a escuchar solo después de cada respuesta.
- Arriba a la derecha eliges **un chat existente de Claude Code** para continuarlo, o “Nueva conversación”.

Para apagarlo: `Ctrl + C` en la terminal.

## Conectar correo y calendario (cuando decidas)

1. Abre `claude` en una terminal y escribe `/mcp`. Verás tus conectores (por ejemplo los de claude.ai si iniciaste
   sesión con tu cuenta, o los que añadas con `claude mcp add`). Si no aparece el de correo o calendario, añádelo ahí primero.
2. Anota el nombre del servidor y de las herramientas (formato `mcp__<servidor>__<herramienta>`).
3. Añádelos a `JARVIS_ALLOWED_TOOLS` en `.env`. Ejemplo prudente, solo lectura:
   `JARVIS_ALLOWED_TOOLS=Read Glob Grep WebSearch WebFetch mcp__<correo>__search_messages mcp__<calendario>__list_events`
4. Reinicia `npm start`.

Para darle control del computador añade `Bash` (y `Edit Write` si quieres que modifique archivos).
Puedes limitar Bash a comandos concretos, por ejemplo `Bash(open:*)` o `Bash(ls:*)`.

## Problemas comunes

- **“No encuentro el comando claude”** → instala Claude Code o pon la ruta completa en `CLAUDE_BIN`.
- **MIC · NO SOPORTADO** → usa Chrome o Edge.
- **Habla con voz robótica** → falta `ELEVENLABS_API_KEY` o la llave/voz no es válida (mira la terminal).
- **Tarda unos segundos en responder** → es normal: cada mensaje arranca Claude Code.
