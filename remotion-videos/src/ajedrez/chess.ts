import { Easing, interpolate } from "remotion";

export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
export type PieceColor = "w" | "b";

/** Position in board units: x = file (0 = a), y = rank (0 = 1). */
export type Point = { x: number; y: number };

export type PlacedPiece = {
  id: string;
  type: PieceType;
  color: PieceColor;
  x: number;
  y: number;
  /** Visual lift while moving (0..1), used for the jump arc and shadow. */
  lift?: number;
  opacity?: number;
  scale?: number;
  glow?: number;
};

export const sq = (name: string): Point => {
  const file = name.charCodeAt(0) - 97;
  const rank = Number(name[1]) - 1;
  if (file < 0 || file > 7 || rank < 0 || rank > 7 || Number.isNaN(rank)) {
    throw new Error(`Invalid square ${name}`);
  }
  return { x: file, y: rank };
};

export const squareName = (p: Point) =>
  `${String.fromCharCode(97 + p.x)}${p.y + 1}`;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const progress = (
  frame: number,
  start: number,
  duration: number,
  easing: (t: number) => number = Easing.bezier(0.65, 0, 0.35, 1),
) =>
  interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing });

/** Interpolated piece position for a move from -> to, with a lift arc. */
export const moveAt = (
  frame: number,
  from: string,
  to: string,
  start: number,
  duration = 16,
  jumpHeight = 0.18,
): Point & { lift: number } => {
  const a = sq(from);
  const b = sq(to);
  const t = progress(frame, start, duration);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    lift: Math.sin(Math.PI * t) * jumpHeight,
  };
};

export const piece = (
  id: string,
  type: PieceType,
  color: PieceColor,
  square: string,
  extra: Partial<PlacedPiece> = {},
): PlacedPiece => ({ id, type, color, ...sq(square), ...extra });

/** Squares reachable by sliding along directions on an otherwise empty board. */
export const slide = (from: string, dirs: [number, number][]): string[] => {
  const o = sq(from);
  const out: string[] = [];
  for (const [dx, dy] of dirs) {
    let x = o.x + dx;
    let y = o.y + dy;
    while (x >= 0 && x < 8 && y >= 0 && y < 8) {
      out.push(squareName({ x, y }));
      x += dx;
      y += dy;
    }
  }
  return out;
};

export const ROOK_DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const BISHOP_DIRS: [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];
export const KING_STEPS = [...ROOK_DIRS, ...BISHOP_DIRS];

export const steps = (from: string, deltas: [number, number][]) => {
  const o = sq(from);
  return deltas
    .map(([dx, dy]) => ({ x: o.x + dx, y: o.y + dy }))
    .filter((p) => p.x >= 0 && p.x < 8 && p.y >= 0 && p.y < 8)
    .map(squareName);
};

export const KNIGHT_JUMPS: [number, number][] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

export const STARTING_POSITION: PlacedPiece[] = (() => {
  const back: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const out: PlacedPiece[] = [];
  const files = "abcdefgh";
  back.forEach((t, i) => {
    out.push(piece(`w${t}${files[i]}`, t, "w", `${files[i]}1`));
    out.push(piece(`b${t}${files[i]}`, t, "b", `${files[i]}8`));
    out.push(piece(`wP${files[i]}`, "P", "w", `${files[i]}2`));
    out.push(piece(`bP${files[i]}`, "P", "b", `${files[i]}7`));
  });
  return out;
})();
