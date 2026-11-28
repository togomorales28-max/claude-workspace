import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { DemoMix, type Demo } from "../components/DemoMix";
import { OnSquare } from "../components/Stage";
import { Badge } from "../components/Typography";
import type { Arrow, Highlight } from "../components/Board";
import {
  BISHOP_DIRS,
  KING_STEPS,
  KNIGHT_JUMPS,
  ROOK_DIRS,
  moveAt,
  piece,
  progress,
  slide,
  sq,
  steps,
} from "../chess";
import { KNIGHT_JUMP_DUR, PIEZAS as T } from "../timeline";
import { BOARD_SIZE } from "../layout";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Piece pops onto its square with a short gold glow. */
const popIn = (f: number) => ({
  scale: interpolate(f, [0, 10], [0.6, 1], {
    ...clamp,
    easing: Easing.out(Easing.back(2)),
  }),
  opacity: interpolate(f, [0, 6], [0, 1], clamp),
  glow: interpolate(f, [0, 8, 30], [0, 1, 0], clamp),
});

const edgesFrom = (from: string, dirs: [number, number][]) =>
  dirs
    .map(([dx, dy]) => {
      const o = sq(from);
      let x = o.x;
      let y = o.y;
      while (x + dx >= 0 && x + dx < 8 && y + dy >= 0 && y + dy < 8) {
        x += dx;
        y += dy;
      }
      return x === o.x && y === o.y
        ? null
        : `${String.fromCharCode(97 + x)}${y + 1}`;
    })
    .filter((s): s is string => s !== null);

/** Sliding piece demo: rays + filled squares, then a move along one ray. */
const sliderDemo =
  (
    type: "Q" | "R" | "B",
    dirs: [number, number][],
    target: string,
    moveAtFrame: number,
  ) =>
  (f: number) => {
    const from = "d4";
    const origin = sq(from);
    const fade = 1 - progress(f, moveAtFrame - 8, 8);
    const highlights: Highlight[] = slide(from, dirs).map((s) => {
      const p = sq(s);
      const dist = Math.max(Math.abs(p.x - origin.x), Math.abs(p.y - origin.y));
      return {
        square: s,
        kind: "fill",
        appear: progress(f, 10 + dist * 4, 8) * (0.35 + 0.65 * fade),
      };
    });
    const arrows: Arrow[] = edgesFrom(from, dirs).map((to, i) => ({
      from,
      to,
      progress: progress(f, 8 + i * 2, 22),
      opacity: isOnRay(from, to, target)
        ? 1 - progress(f, moveAtFrame + 14, 6)
        : fade,
    }));
    const pos = moveAt(f, from, target, moveAtFrame, 16);
    return {
      pieces: [piece("p", type, "w", from, { ...popIn(f), ...pos })],
      highlights: [
        ...highlights,
        { square: from, kind: "origin" as const, appear: progress(f, 6, 8) },
      ],
      arrows,
    };
  };

/** True when `target` lies on the ray from `from` towards `edge`. */
const isOnRay = (from: string, edge: string, target: string) => {
  const a = sq(from);
  const e = sq(edge);
  const t = sq(target);
  const dx = Math.sign(e.x - a.x);
  const dy = Math.sign(e.y - a.y);
  const k = dx !== 0 ? (t.x - a.x) / dx : (t.y - a.y) / dy;
  return (
    k > 0 && Number.isInteger(k) && a.x + dx * k === t.x && a.y + dy * k === t.y
  );
};

const KNIGHT_WALL = ["c3", "d3", "e3", "c4", "e4", "c5", "d5", "e5"];

const demos: Demo[] = [
  {
    key: "K",
    ...T.K,
    kicker: "Las piezas · 1/6",
    title: "El *rey*",
    rule: "Una casilla en *cualquier dirección*",
    state: (f) => {
      const fade = 1 - progress(f, T.K.move - 4, 8);
      return {
        pieces: [
          piece("k", "K", "w", "e4", {
            ...popIn(f),
            ...moveAt(f, "e4", "e5", T.K.move),
          }),
        ],
        highlights: [
          ...steps("e4", KING_STEPS).map((s, i) => ({
            square: s,
            kind: "move" as const,
            appear: progress(f, 12 + i * 3, 8) * fade,
          })),
          { square: "e4", kind: "origin", appear: progress(f, 6, 8) },
        ],
        arrows: [
          { from: "e4", to: "e5", progress: progress(f, T.K.move - 14, 12) },
        ],
      };
    },
  },
  {
    key: "Q",
    ...T.Q,
    kicker: "Las piezas · 2/6",
    title: "La *dama*",
    rule: "Recta o diagonal, *sin límite*",
    state: sliderDemo("Q", [...ROOK_DIRS, ...BISHOP_DIRS], "h8", T.Q.move),
  },
  {
    key: "R",
    ...T.R,
    kicker: "Las piezas · 3/6",
    title: "La *torre*",
    rule: "*Horizontal* y *vertical*",
    state: sliderDemo("R", ROOK_DIRS, "d8", T.R.move),
  },
  {
    key: "B",
    ...T.B,
    kicker: "Las piezas · 4/6",
    title: "El *alfil*",
    rule: "Solo en *diagonal*",
    state: sliderDemo("B", BISHOP_DIRS, "g7", T.B.move),
  },
  {
    key: "N",
    ...T.N,
    kicker: "Las piezas · 5/6",
    title: "El *caballo*",
    rule: "Se mueve en *L* y puede *saltar* piezas",
    state: (f) => {
      const targets = steps("d4", KNIGHT_JUMPS);
      const fade = 1 - progress(f, T.N.move - 4, 8);
      const jump = moveAt(f, "d4", "f5", T.N.move, KNIGHT_JUMP_DUR, 0.95);
      return {
        pieces: [
          ...KNIGHT_WALL.map((s, i) =>
            piece(`wall${s}`, "P", "w", s, {
              opacity: progress(f, 4 + i * 2, 8),
              scale: interpolate(progress(f, 4 + i * 2, 8), [0, 1], [0.7, 0.9]),
            }),
          ),
          piece("n", "N", "w", "d4", { ...popIn(f), ...jump }),
        ],
        highlights: [
          ...targets.map((s, i) => ({
            square: s,
            kind: "move" as const,
            appear:
              progress(f, 26 + i * 3, 8) *
              (s === "f5" ? 1 - progress(f, T.N.move + 18, 6) : fade),
          })),
          { square: "d4", kind: "origin", appear: progress(f, 6, 8) },
        ],
        arrows: targets.map((to, i) => ({
          from: "d4",
          to,
          knight: true,
          progress: progress(f, 22 + i * 3, 16),
          opacity: to === "f5" ? 1 - progress(f, T.N.move + 16, 6) : fade,
        })),
      };
    },
    overlay: () => (
      <OnSquare x={1.5} y={6.6} size={BOARD_SIZE}>
        <Badge
          text="¡SALTA!"
          start={T.N.move + 2}
          end={T.N.dur + 4}
          size={46}
        />
      </OnSquare>
    ),
  },
  {
    key: "P",
    ...T.P,
    kicker: "Las piezas · 6/6",
    title: "El *peón*",
    rule: "Avanza *1* (o *2* en su primera jugada)\ny *captura en diagonal*",
    state: (f) => {
      const firstFade = 1 - progress(f, T.P.move + 14, 8);
      const step1 = moveAt(f, "e2", "e4", T.P.move, 16);
      const cap = moveAt(f, "e4", "d5", T.P.capture, 16);
      const pawn = f < T.P.capture ? step1 : cap;
      const victimOut = progress(f, T.P.capture + 12, 6);
      return {
        pieces: [
          piece("p", "P", "w", "e2", { ...popIn(f), ...pawn }),
          piece("vic", "N", "b", "d5", {
            opacity: progress(f, 78, 8) * (1 - victimOut),
            scale: 1 - victimOut * 0.4,
          }),
        ],
        highlights: [
          {
            square: "e2",
            kind: "origin",
            appear: progress(f, 6, 8) * firstFade,
          },
          {
            square: "e3",
            kind: "move",
            appear: progress(f, 12, 8) * firstFade,
          },
          {
            square: "e4",
            kind: "move",
            appear: progress(f, 28, 8) * firstFade,
          },
          {
            square: "d5",
            kind: "capture",
            appear: progress(f, 90, 10) * (1 - progress(f, T.P.capture + 8, 6)),
          },
          {
            square: "e4",
            kind: "origin",
            appear: progress(f, 88, 8) * (1 - progress(f, T.P.capture + 10, 6)),
          },
        ],
        arrows: [
          {
            from: "e2",
            to: "e4",
            progress: progress(f, 34, 14),
            opacity: firstFade,
          },
          {
            from: "e4",
            to: "d5",
            progress: progress(f, 92, 12),
            color: "#e0473f",
            opacity: 1 - progress(f, T.P.capture + 12, 6),
          },
        ],
      };
    },
    overlay: () => (
      <>
        <OnSquare x={1.6} y={1.5} size={BOARD_SIZE}>
          <Badge text="1ª JUGADA: 2" start={30} end={T.P.move + 24} size={40} />
        </OnSquare>
        <OnSquare x={1.6} y={5.5} size={BOARD_SIZE}>
          <Badge
            text="CAPTURA"
            start={T.P.capture + 14}
            tone="danger"
            size={44}
          />
        </OnSquare>
      </>
    ),
  },
];

/** Scene 3: the six pieces and how each moves. */
export const Piezas: React.FC = () => (
  <AbsoluteFill>
    <DemoMix demos={demos} />
  </AbsoluteFill>
);
