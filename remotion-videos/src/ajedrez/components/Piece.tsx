import React from "react";
import type { PieceColor, PieceType } from "../chess";

/**
 * Original Staunton-inspired piece artwork, drawn in a 100x100 box.
 * Every piece shares the same pedestal so the set reads as one family.
 */
const PEDESTAL =
  "M24 92 L76 92 C80 92 81 89 80 86 L78 82 C77 80 74 79 71 79 L29 79 C26 79 23 80 22 82 L20 86 C19 89 20 92 24 92 Z";

type Shape = {
  d: string[];
  circles?: [number, number, number][];
  details?: string[];
};

const SHAPES: Record<PieceType, Shape> = {
  P: {
    d: [
      "M40 46 C40 58 33 69 29 79 L71 79 C67 69 60 58 60 46 Z",
      "M33 47 C33 43 41 41 50 41 C59 41 67 43 67 47 C67 50 59 52 50 52 C41 52 33 50 33 47 Z",
    ],
    circles: [[50, 29, 13.5]],
  },
  R: {
    d: [
      "M35 79 L38 47 L62 47 L65 79 Z",
      "M29 19 L38 19 L38 26 L45.5 26 L45.5 19 L54.5 19 L54.5 26 L62 26 L62 19 L71 19 L71 36 L64 45 L36 45 L29 36 Z",
      "M32 48 C32 44.5 40 43.5 50 43.5 C60 43.5 68 44.5 68 48 C68 51 60 52 50 52 C40 52 32 51 32 48 Z",
    ],
    details: ["M31 36 L69 36"],
  },
  B: {
    d: [
      "M41 52 C41 63 34 71 30 79 L70 79 C66 71 59 63 59 52 Z",
      "M50 14 C39 23 34 33 37 42 C39 48 61 48 63 42 C66 33 61 23 50 14 Z",
      "M34 51 C34 47.5 41 46.5 50 46.5 C59 46.5 66 47.5 66 51 C66 54 59 55.5 50 55.5 C41 55.5 34 54 34 51 Z",
    ],
    circles: [[50, 11, 4.6]],
    details: ["M55 24 L47 34"],
  },
  N: {
    d: [
      "M31 79 C30 66 37 58 45 51 C40 52 34 55 28 59 C23 62 17 59 17 53 C17 47 25 41 32 34 C37 29 39 22 44 16 L45 7 L51 13 L54 9 L56 15 C67 18 75 30 75 45 C75 60 69 69 70 79 Z",
    ],
    circles: [],
    details: ["M56 18 C64 25 68 36 67 50", "M22 54 C24 53 26 53 27 54"],
  },
  Q: {
    d: [
      "M38 57 C39 67 34 73 30 79 L70 79 C66 73 61 67 62 57 Z",
      "M32 53 L24 27 L37 40 L38 20 L46 36 L50 15 L54 36 L62 20 L63 40 L76 27 L68 53 Z",
      "M30 55 C30 51 39 50 50 50 C61 50 70 51 70 55 C70 58.5 61 60 50 60 C39 60 30 58.5 30 55 Z",
    ],
    circles: [
      [24, 25, 3.8],
      [38, 18, 3.8],
      [50, 12.5, 4.2],
      [62, 18, 3.8],
      [76, 25, 3.8],
    ],
  },
  K: {
    d: [
      "M38 57 C39 67 34 73 30 79 L70 79 C66 73 61 67 62 57 Z",
      "M32 50 C25 37 34 27 44 31 C46 31.5 48 33 50 35 C52 33 54 31.5 56 31 C66 27 75 37 68 50 Z",
      "M30 54 C30 50 39 49 50 49 C61 49 70 50 70 54 C70 57.5 61 59 50 59 C39 59 30 57.5 30 54 Z",
      "M46.5 3 L53.5 3 L53.5 9 L59 9 L59 15 L53.5 15 L53.5 26 L46.5 26 L46.5 15 L41 15 L41 9 L46.5 9 Z",
    ],
  },
};

const PALETTE = {
  w: {
    hi: "#fffdf6",
    mid: "#efe5cc",
    lo: "#c4b28a",
    stroke: "#3b2f1e",
    detail: "rgba(59,47,30,0.55)",
    eye: "#3b2f1e",
  },
  b: {
    hi: "#4a5367",
    mid: "#1c2230",
    lo: "#07090e",
    stroke: "#d8b25a",
    detail: "rgba(216,178,90,0.7)",
    eye: "#d8b25a",
  },
} as const;

export const PieceSvg: React.FC<{
  type: PieceType;
  color: PieceColor;
  size: number;
  glow?: number;
  style?: React.CSSProperties;
}> = ({ type, color, size, glow = 0, style }) => {
  const p = PALETTE[color];
  const shape = SHAPES[type];
  const gid = `g-${color}`;
  const sid = `s-${color}`;
  const fill = `url(#${gid})`;
  const strokeW = color === "w" ? 2.2 : 1.8;
  const glowFilter =
    glow > 0
      ? `drop-shadow(0 0 ${6 + 18 * glow}px rgba(243,220,155,${0.85 * glow}))`
      : "";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{
        overflow: "visible",
        filter: `drop-shadow(0 ${size * 0.04}px ${size * 0.05}px rgba(0,0,0,0.55)) ${glowFilter}`,
        ...style,
      }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor={p.hi} />
          <stop offset="0.45" stopColor={p.mid} />
          <stop offset="1" stopColor={p.lo} />
        </linearGradient>
        <linearGradient id={sid} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            stopColor="#fff"
            stopOpacity={color === "w" ? 0.55 : 0.28}
          />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g
        stroke={p.stroke}
        strokeWidth={strokeW}
        strokeLinejoin="round"
        fill={fill}
      >
        <path d={PEDESTAL} />
        {shape.d.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {shape.circles?.map(([cx, cy, r], i) => (
          <circle key={`c${i}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      {/* specular rim on the lit side */}
      <g
        fill="none"
        stroke={`url(#${sid})`}
        strokeWidth={3}
        strokeLinecap="round"
      >
        <path d="M27 88 L30 83" />
        {type === "P" && <path d="M41 23 C43 19 46 18 48 17.5" />}
        {type !== "P" && type !== "N" && <path d="M37 75 C39 70 40 65 40 59" />}
        {type === "N" && <path d="M40 24 C37 30 33 34 28 39" />}
      </g>
      {shape.details && (
        <g fill="none" stroke={p.detail} strokeWidth={2} strokeLinecap="round">
          {shape.details.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
      {type === "N" && <circle cx={45} cy={26} r={2.6} fill={p.eye} />}
    </svg>
  );
};
