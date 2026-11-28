# Video educativo de ajedrez para TikTok

"Cómo jugar ajedrez desde cero": vertical 1080×1920, 30 fps, 65 s, H.264 + AAC, en español latino.

## Contenido de esta carpeta

| Archivo | Qué es |
|---|---|
| `ajedrez-tiktok.mp4` | Video final con subtítulos, música y efectos |
| `guion-narracion.md` | Guion de voz por escenas, con tiempos, duración máxima y nombre de archivo de cada toma |
| `subtitulos.srt` | Una línea por frase (para TikTok, CapCut o Premiere) |
| `subtitulos-tiktok.srt` | Frases cortas, idénticas a los subtítulos grabados en el video |
| `portada.jpg` | Fotograma sugerido como portada |

## Estructura

| Escena | Tiempo | Qué muestra |
|---|---|---|
| 1. Introducción | 0–5 s | Tablero 3D con luz cenital, acercamiento de cámara y piezas que se colocan |
| 2. Objetivo | 5–12 s | Dama a g7, jaque mate protegido por el rey en f6 |
| 3. Las piezas | 12–32 s | Rey, dama, torre, alfil, caballo (salta sobre peones) y peón (doble avance y captura) |
| 4. Reglas | 32–47 s | Jaque (y cómo salir de él), mate del pasillo, enroque corto y promoción a dama |
| 5. Partida | 47–60 s | 1. e4 e5 2. Cf3 Cc6 3. Ac4, con lista de jugadas y control del centro |
| 6. Final | 60–65 s | "AHORA TE TOCA JUGAR" y "Guarda este video y empieza a practicar." |

Todas las posiciones y jugadas son legales.

## Proyecto Remotion

Todo el video está en `src/ajedrez/`:

- `timeline.ts`: única fuente de tiempos. Las escenas, los efectos y la música se sincronizan desde aquí.
- `data/narration.json`: guion, tiempos de cada frase y palabras destacadas (`*palabra*`).
- `components/`: piezas (`Piece`), tablero con flechas y casillas resaltadas (`Board`), tipografía, subtítulos, atmósfera, audio.
- `scenes/`: una carpeta por escena.

La zona segura de TikTok está en `layout.ts`. El contenido está centrado en x=500 para no quedar bajo los botones de la derecha, y los subtítulos van entre el tablero y la descripción.

## Comandos (desde `remotion-videos/`)

```bash
npm run dev                            # previsualizar en Remotion Studio (composición AjedrezTikTok)
npm run ajedrez:render                 # exportar out/ajedrez-tiktok.mp4
npm run ajedrez:render-sin-subtitulos  # versión limpia, para subir con los subtítulos de TikTok
npm run ajedrez:subtitulos             # regenerar los SRT y el guion desde narration.json
npm run ajedrez:audio                  # regenerar música y efectos (Python 3, numpy, scipy)
npm run ajedrez:voz                    # registrar las tomas de voz (ver abajo)
```

Si Remotion no puede descargar su navegador (red restringida), indícale uno local:
`REMOTION_BROWSER_EXECUTABLE=/ruta/a/chrome-headless-shell npm run ajedrez:render`.

## Añadir la narración

En el entorno de producción no había ningún servicio de voz (TTS) disponible, así que el video final lleva subtítulos, música y efectos, pero **no voz**. La estructura para añadirla ya está lista:

1. Graba o genera cada frase de `guion-narracion.md`. Puedes usar un locutor, ElevenLabs, Azure TTS (voz `es-MX`) u otro servicio.
2. Guarda cada toma como `public/ajedrez/audio/voz/<archivo>.mp3`, por ejemplo `05_rey.mp3`. También sirven .wav y .m4a.
3. Ejecuta `npm run ajedrez:voz`. El script mide cada toma y avisa si alguna no cabe en su ventana.
4. Ejecuta `npm run ajedrez:render`. La música baja de volumen automáticamente mientras habla la voz.

Si una toma dura más de lo previsto, ajusta `start`/`end` en `narration.json` y los tiempos de la escena en `timeline.ts`. Los subtítulos y el SRT se actualizan solos.

## Recursos y licencias

- **Piezas, tablero y animaciones:** dibujados en SVG para este proyecto. Son originales.
- **Música y efectos:** sintetizados con `scripts/generate_audio.py`, sin muestras de terceros, así que no tienen derechos de autor de terceros.
- **Tipografías:** Montserrat y Playfair Display, ambas con licencia SIL Open Font License (ver `public/ajedrez/fonts/`).
