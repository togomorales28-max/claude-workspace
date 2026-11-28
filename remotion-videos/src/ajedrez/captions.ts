import narration from "./data/narration.json";
import voiceManifest from "./data/voice-manifest.json";

const VOICE = voiceManifest.files as Record<
  string,
  { durationInFrames: number }
>;

export type NarrationLine = {
  id: string;
  scene: string;
  start: number;
  end: number;
  text: string;
  onScreen?: boolean;
};

export type CaptionWord = { text: string; em: boolean };
export type CaptionChunk = {
  lineId: string;
  start: number;
  end: number;
  words: CaptionWord[];
};

/** Narration text without caption markup. */
export const plainText = (text: string) =>
  text.replace(/\s\|\s/g, " ").replace(/\*/g, "");

export const LINES = narration.lines as NarrationLine[];

const MAX_WORDS = 4;

/** Split a narration line into short TikTok-style chunks timed by length. */
export const chunkLine = (line: NarrationLine): CaptionChunk[] => {
  const words: CaptionWord[] = [];
  let em = false;
  const breaks = new Set<number>();
  for (const raw of line.text.split(/\s+/)) {
    if (raw === "|") {
      breaks.add(words.length);
      continue;
    }
    // A word can open and/or close emphasis: *jaque mate* spans 2 words.
    const opens =
      raw.startsWith("*") || raw.startsWith("¡*") || raw.startsWith("¿*");
    const stars = (raw.match(/\*/g) ?? []).length;
    const wordEm = em || opens;
    words.push({ text: raw.replace(/\*/g, ""), em: wordEm });
    if (stars % 2 === 1) em = !em;
  }

  // Split into phrases at punctuation, then into balanced chunks of <= MAX_WORDS.
  const phrases: CaptionWord[][] = [[]];
  words.forEach((w, i) => {
    phrases[phrases.length - 1].push(w);
    if (/[.,:;?!…]$/.test(w.text) && i < words.length - 1) phrases.push([]);
  });
  // Merge one-word phrases into a neighbour so no chunk is a lonely word.
  for (let i = phrases.length - 1; i >= 0; i--) {
    if (phrases[i].length === 1 && phrases.length > 1) {
      const j = i > 0 ? i - 1 : i + 1;
      if (phrases[j].length < MAX_WORDS) {
        phrases[j] =
          j < i
            ? [...phrases[j], ...phrases[i]]
            : [...phrases[i], ...phrases[j]];
        phrases.splice(i, 1);
      }
    }
  }
  const manual: CaptionWord[][] = [];
  words.forEach((w, i) => {
    if (i === 0 || breaks.has(i)) manual.push([]);
    manual[manual.length - 1].push(w);
  });
  const groups: CaptionWord[][] = breaks.size
    ? manual
    : phrases.flatMap((p) => {
        const n = Math.ceil(p.length / MAX_WORDS);
        const size = Math.ceil(p.length / n);
        return Array.from({ length: n }, (_, k) =>
          p.slice(k * size, (k + 1) * size),
        ).filter((g) => g.length);
      });

  const weight = (g: CaptionWord[]) =>
    g.reduce((n, w) => n + w.text.length + 2, 0);
  const total = groups.reduce((n, g) => n + weight(g), 0);
  // With a recorded/generated take, spread the chunks over the real speech
  // and keep the last chunk on screen until the line's end.
  const spoken = VOICE[line.id]?.durationInFrames;
  const span = spoken
    ? Math.min(spoken, line.end - line.start)
    : line.end - line.start;
  let t = line.start;
  return groups.map((g, i) => {
    const d = (weight(g) / total) * span;
    const isLast = i === groups.length - 1;
    const chunk = {
      lineId: line.id,
      start: Math.round(t),
      end: isLast ? Math.max(Math.round(t + d), line.end) : Math.round(t + d),
      words: g,
    };
    t += d;
    return chunk;
  });
};

export const CAPTION_CHUNKS: CaptionChunk[] = LINES.filter(
  (l) => !l.onScreen,
).flatMap(chunkLine);
