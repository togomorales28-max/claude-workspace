/**
 * Single source of truth for timing. Scenes, captions, SFX and music all read
 * from here, so animation and narration stay in sync. All values are frames
 * at 30 fps; scene beats are relative to the scene (or sub-scene) start.
 */
export const FPS = 30;
export const TOTAL_FRAMES = 1950; // 65 s
export const XFADE = 12; // overlap used for cross-dissolves between scenes

export const SCENES = {
  intro: { from: 0, dur: 150 },
  objetivo: { from: 150, dur: 210 },
  piezas: { from: 360, dur: 600 },
  reglas: { from: 960, dur: 450 },
  partida: { from: 1410, dur: 390 },
  final: { from: 1800, dur: 150 },
} as const;

export const INTRO = { title: 14, subtitle: 80 };

export const OBJETIVO = { title: 6, king: 40, arrow: 96, move: 124, mate: 144 };

export const KNIGHT_JUMP_DUR = 22;

export const PIEZAS = {
  K: { from: 0, dur: 90, move: 58 },
  Q: { from: 90, dur: 95, move: 64 },
  R: { from: 185, dur: 80, move: 52 },
  B: { from: 265, dur: 75, move: 48 },
  N: { from: 340, dur: 120, move: 72 },
  P: { from: 460, dur: 140, move: 52, capture: 106 },
} as const;

export const REGLAS = {
  jaque: { from: 0, dur: 100, move: 22, check: 40, escape: 70 },
  mate: { from: 100, dur: 115, move: 35, mate: 53 },
  enroque: { from: 215, dur: 120, king: 40, rook: 58 },
  promocion: { from: 335, dur: 115, move: 28, transform: 58 },
} as const;

export const PARTIDA = {
  moves: [60, 120, 180, 240, 300],
  center: 330,
};

export const FINAL = { title: 8, subtitle: 66 };

export type SfxName =
  | "move"
  | "capture"
  | "whoosh"
  | "impact"
  | "check"
  | "shimmer";
export type SfxEvent = { name: SfxName; frame: number; volume?: number };

const s = SCENES;
export const SFX_EVENTS: SfxEvent[] = [
  // scene transitions
  ...[s.objetivo, s.piezas, s.reglas, s.partida, s.final].map(
    (sc): SfxEvent => ({ name: "whoosh", frame: sc.from - 8, volume: 0.5 }),
  ),
  // piece sub-scene changes inside "piezas" and "reglas"
  ...Object.values(PIEZAS)
    .slice(1)
    .map(
      (p): SfxEvent => ({
        name: "whoosh",
        frame: s.piezas.from + p.from - 4,
        volume: 0.22,
      }),
    ),
  ...Object.values(REGLAS)
    .slice(1)
    .map(
      (p): SfxEvent => ({
        name: "whoosh",
        frame: s.reglas.from + p.from - 4,
        volume: 0.22,
      }),
    ),

  { name: "impact", frame: INTRO.title, volume: 0.8 },

  { name: "move", frame: s.objetivo.from + OBJETIVO.move + 16 },
  { name: "impact", frame: s.objetivo.from + OBJETIVO.mate, volume: 0.65 },

  ...Object.entries(PIEZAS).map(
    ([key, p]): SfxEvent => ({
      name: "move",
      frame:
        s.piezas.from + p.from + p.move + (key === "N" ? KNIGHT_JUMP_DUR : 16),
    }),
  ),
  {
    name: "capture",
    frame: s.piezas.from + PIEZAS.P.from + PIEZAS.P.capture + 16,
  },

  { name: "move", frame: s.reglas.from + REGLAS.jaque.move + 16 },
  { name: "check", frame: s.reglas.from + REGLAS.jaque.check },
  {
    name: "move",
    frame: s.reglas.from + REGLAS.jaque.from + REGLAS.jaque.escape + 14,
  },
  {
    name: "move",
    frame: s.reglas.from + REGLAS.mate.from + REGLAS.mate.move + 16,
  },
  {
    name: "impact",
    frame: s.reglas.from + REGLAS.mate.from + REGLAS.mate.mate,
    volume: 0.65,
  },
  {
    name: "move",
    frame: s.reglas.from + REGLAS.enroque.from + REGLAS.enroque.king + 16,
  },
  {
    name: "move",
    frame: s.reglas.from + REGLAS.enroque.from + REGLAS.enroque.rook + 18,
  },
  {
    name: "move",
    frame: s.reglas.from + REGLAS.promocion.from + REGLAS.promocion.move + 16,
  },
  {
    name: "shimmer",
    frame: s.reglas.from + REGLAS.promocion.from + REGLAS.promocion.transform,
  },

  ...PARTIDA.moves.map(
    (m): SfxEvent => ({ name: "move", frame: s.partida.from + m + 16 }),
  ),
  { name: "shimmer", frame: s.partida.from + PARTIDA.center, volume: 0.5 },

  { name: "impact", frame: s.final.from + FINAL.title, volume: 0.75 },
];
