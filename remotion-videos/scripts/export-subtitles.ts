/**
 * Writes the subtitle files and the narration script from the single source
 * of truth (src/ajedrez/data/narration.json + captions.ts).
 *
 *   npm run ajedrez:subtitulos
 *
 * Output (entregables/ajedrez/):
 *   subtitulos.srt          one cue per narration line (upload to TikTok / editors)
 *   subtitulos-tiktok.srt   short cues, identical to the burned-in captions
 *   guion-narracion.md      voice-over script with timings and file names
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LINES, chunkLine, plainText } from "../src/ajedrez/captions";
import { FPS, SCENES } from "../src/ajedrez/timeline";

const OUT = join(__dirname, "..", "entregables", "ajedrez");
mkdirSync(OUT, { recursive: true });

const ts = (frame: number) => {
  const ms = Math.round((frame / FPS) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};
const sec = (frame: number) => (frame / FPS).toFixed(1).replace(".", ",");

const srt = (cues: { start: number; end: number; text: string }[]) =>
  cues
    .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`)
    .join("\n");

writeFileSync(
  join(OUT, "subtitulos.srt"),
  srt(
    LINES.map((l) => ({ start: l.start, end: l.end, text: plainText(l.text) })),
  ),
);
writeFileSync(
  join(OUT, "subtitulos-tiktok.srt"),
  srt(
    LINES.flatMap(chunkLine).map((c) => ({
      start: c.start,
      end: c.end,
      text: c.words.map((w) => w.text).join(" "),
    })),
  ),
);

const SCENE_TITLES: Record<string, string> = {
  intro: "Escena 1 — Introducción",
  objetivo: "Escena 2 — Objetivo",
  piezas: "Escena 3 — Las piezas",
  reglas: "Escena 4 — Reglas importantes",
  partida: "Escena 5 — Ejemplo de partida",
  final: "Escena 6 — Final",
};

let md = `# Guion de narración — "Cómo jugar ajedrez desde cero"

Video vertical 1080×1920 · 30 fps · 65 s · español latino.

**Dirección de voz:** voz joven, clara y cercana, con energía de creador educativo
(no de locutor de radio). Ritmo ágil pero sin atropellarse; sonríe en "¡ganaste!" y
en el cierre. Las palabras en **negrita** se enfatizan. Pronuncia las casillas como
letra + número ("e cuatro", "efe tres").

**Archivos de voz:** la versión actual está generada con Kokoro (\`scripts/generate_voice.py\`). Para reemplazarla, graba o genera una toma por línea y guárdala como
\`public/ajedrez/audio/voz/<archivo>.mp3\` (o .wav / .m4a). Cada toma debe caber
en su ventana ("Duración máx."). Después ejecuta \`npm run ajedrez:voz\` y vuelve a renderizar.

`;

for (const [key, title] of Object.entries(SCENE_TITLES)) {
  const sc = SCENES[key as keyof typeof SCENES];
  md += `## ${title} (${sec(sc.from)}–${sec(sc.from + sc.dur)} s)\n\n`;
  md += `| Archivo | Inicio | Duración máx. | Texto |\n|---|---|---|---|\n`;
  const lines = LINES.filter((l) => l.scene === key);
  for (const l of lines) {
    const next = LINES[LINES.indexOf(l) + 1];
    const max =
      (next ? next.start : SCENES.final.from + SCENES.final.dur) - l.start;
    const text = l.text
      .replace(/\s\|\s/g, " ")
      .replace(/\*([^*]+)\*/g, "**$1**");
    md += `| \`${l.id}\` | ${sec(l.start)} s | ${sec(max)} s | ${text} |\n`;
  }
  md += "\n";
}

md += `## Texto corrido

${LINES.map((l) => plainText(l.text)).join("\n")}
`;

writeFileSync(join(OUT, "guion-narracion.md"), md);
console.log(
  `Escrito en ${OUT}: subtitulos.srt, subtitulos-tiktok.srt, guion-narracion.md`,
);
