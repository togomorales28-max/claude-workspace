# Video educativo de ajedrez para TikTok

"Cómo jugar ajedrez desde cero": vertical 1080×1920, 30 fps, 65 s, H.264 + AAC, en español latino.

## Contenido de esta carpeta

| Archivo | Qué es |
|---|---|
| `ajedrez-tiktok.mp4` | Video final con narración, subtítulos, música y efectos |
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

## Narración (voz)

La voz está generada con **Kokoro**, un sistema de texto a voz neuronal, gratuito y de código abierto (licencia Apache-2.0). Sus archivos de modelo se publican en GitHub: [thewh1teagle/kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx).

- La voz es `em_alex`, masculina y juvenil. Otras opciones: `ef_dora` (femenina) y `em_santa` (masculina, más grave).
- El acento es latinoamericano: la pronunciación se genera con la variante `es-419` de espeak-ng, que usa *seseo* (s en lugar de θ) y *yeísmo* (y en lugar de ll).
- Las casillas se leen en voz alta ("e cuatro", "efe tres", "ce seis").
- Cada toma se ajusta a su tiempo (solo `10_peon_a` se aceleró, a 1,23×) y se normaliza.
- Los subtítulos se sincronizan con la duración real de cada toma.
- La música baja unos 11 dB mientras habla la voz. Así la voz queda unos 9 dB por encima de la música y los efectos.

Para regenerarla (por ejemplo, con otra voz o tras cambiar el guion):

```bash
pip install kokoro-onnx soundfile
python3 scripts/generate_voice.py --voice ef_dora   # descarga el modelo (~350 MB) la primera vez
npm run ajedrez:voz                                  # registra las tomas
npm run ajedrez:render
```

Para usar una voz grabada por una persona, reemplaza los archivos de `public/ajedrez/audio/voz/` (mismos nombres, en .wav, .mp3 o .m4a) y ejecuta `npm run ajedrez:voz`.

## Recursos y licencias

- **Piezas, tablero y animaciones:** dibujados en SVG para este proyecto. Son originales.
- **Voz:** Kokoro (Apache-2.0), generada localmente.
- **Música y efectos:** sintetizados con `scripts/generate_audio.py`, sin muestras de terceros, así que no tienen derechos de autor de terceros.
- **Tipografías:** Montserrat y Playfair Display, ambas con licencia SIL Open Font License (ver `public/ajedrez/fonts/`).
