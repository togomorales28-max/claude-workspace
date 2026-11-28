import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONT_SANS } from "../theme";
import { sq, type PlacedPiece } from "../chess";
import { PieceSvg } from "./Piece";

export type HighlightKind =
  | "move"
  | "fill"
  | "origin"
  | "capture"
  | "check"
  | "blocked";

export type Highlight = {
  square: string;
  kind: HighlightKind;
  /** 0..1 entrance progress (also used as opacity). */
  appear: number;
};

export type Arrow = {
  from: string;
  to: string;
  /** 0..1 draw progress. */
  progress: number;
  color?: string;
  /** Draw as an L (knight move): long leg first, then the short leg. */
  knight?: boolean;
  opacity?: number;
};

type Props = {
  size: number;
  pieces: PlacedPiece[];
  highlights?: Highlight[];
  arrows?: Arrow[];
  /** Tilt in degrees for the cinematic 3D view (0 = top-down). */
  tilt?: number;
  showCoords?: boolean;
  /** Extra light sweep across the board (0..1 position, or null). */
  sweep?: number | null;
  style?: React.CSSProperties;
};

const FILES = "abcdefgh";

export const Board: React.FC<Props> = ({
  size,
  pieces,
  highlights = [],
  arrows = [],
  tilt = 0,
  showCoords = true,
  sweep = null,
  style,
}) => {
  const s = size / 8;
  const frame = Math.max(10, size * 0.028);
  const cx = (x: number) => x * s + s / 2;
  const cy = (y: number) => (7 - y) * s + s / 2;

  // Draw order: farther ranks first so pieces in front overlap correctly.
  const ordered = [...pieces].sort(
    (a, b) => b.y - a.y || (a.lift ?? 0) - (b.lift ?? 0),
  );

  return (
    <div
      style={{
        position: "relative",
        width: size + frame * 2,
        height: size + frame * 2,
        transformStyle: "preserve-3d",
        transform: tilt ? `rotateX(${tilt}deg)` : undefined,
        ...style,
      }}
    >
      {/* Frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: frame * 0.7,
          background: `linear-gradient(145deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 28%, ${COLORS.goldDeep} 62%, #5c4718 100%)`,
          boxShadow: `0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.65), 0 0 ${size * 0.08}px rgba(216,178,90,0.18)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: frame * 0.35,
          borderRadius: frame * 0.5,
          background: "#0b1324",
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          left: frame,
          top: frame,
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient id="lightSq" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={COLORS.lightSquare} />
            <stop offset="1" stopColor={COLORS.lightSquareShade} />
          </linearGradient>
          <linearGradient id="darkSq" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={COLORS.darkSquare} />
            <stop offset="1" stopColor={COLORS.darkSquareShade} />
          </linearGradient>
          <radialGradient id="boardLight" cx="0.35" cy="0.25" r="0.9">
            <stop offset="0" stopColor="#fff" stopOpacity={0.16} />
            <stop offset="0.6" stopColor="#fff" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={0.32} />
          </radialGradient>
          <radialGradient id="checkGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={COLORS.danger} stopOpacity={0.95} />
            <stop offset="0.7" stopColor={COLORS.danger} stopOpacity={0.45} />
            <stop offset="1" stopColor={COLORS.danger} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity={0} />
            <stop offset="0.5" stopColor="#fff8e0" stopOpacity={0.22} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>

        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          const dark = (x + y) % 2 === 0;
          return (
            <rect
              key={i}
              x={x * s}
              y={(7 - y) * s}
              width={s + 0.5}
              height={s + 0.5}
              fill={dark ? "url(#darkSq)" : "url(#lightSq)"}
            />
          );
        })}
        <rect width={size} height={size} fill="url(#boardLight)" />
        <clipPath id="boardClip">
          <rect width={size} height={size} />
        </clipPath>
        {sweep !== null && (
          <rect
            clipPath="url(#boardClip)"
            x={-size * 0.5 + sweep * size * 2}
            y={-size * 0.5}
            width={size * 0.5}
            height={size * 2}
            fill="url(#sweepGrad)"
            transform={`rotate(25 ${size / 2} ${size / 2})`}
          />
        )}

        {showCoords &&
          Array.from({ length: 8 }, (_, i) => (
            <React.Fragment key={i}>
              <text
                x={i * s + s - s * 0.08}
                y={size - s * 0.08}
                textAnchor="end"
                fontFamily={FONT_SANS}
                fontWeight={800}
                fontSize={s * 0.17}
                fill={
                  (i + 0) % 2 === 0
                    ? COLORS.lightSquareShade
                    : COLORS.darkSquare
                }
                opacity={0.9}
              >
                {FILES[i]}
              </text>
              <text
                x={s * 0.07}
                y={(7 - i) * s + s * 0.22}
                fontFamily={FONT_SANS}
                fontWeight={800}
                fontSize={s * 0.17}
                fill={i % 2 === 0 ? COLORS.lightSquareShade : COLORS.darkSquare}
                opacity={0.9}
              >
                {i + 1}
              </text>
            </React.Fragment>
          ))}

        {highlights.map((h, i) => {
          const p = sq(h.square);
          const x = p.x * s;
          const y = (7 - p.y) * s;
          const a = Math.max(0, Math.min(1, h.appear));
          if (a <= 0) return null;
          switch (h.kind) {
            case "move":
              return (
                <g key={i} opacity={a}>
                  <circle
                    cx={x + s / 2}
                    cy={y + s / 2}
                    r={s * 0.3 * a}
                    fill={COLORS.gold}
                    opacity={0.18}
                  />
                  <circle
                    cx={x + s / 2}
                    cy={y + s / 2}
                    r={s * 0.14 * interpolate(a, [0, 1], [0.3, 1])}
                    fill={COLORS.goldLight}
                    stroke={COLORS.goldDeep}
                    strokeWidth={s * 0.02}
                  />
                </g>
              );
            case "fill":
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={s}
                  height={s}
                  fill={COLORS.gold}
                  opacity={0.5 * a}
                />
              );
            case "origin":
              return (
                <rect
                  key={i}
                  x={x + s * 0.04}
                  y={y + s * 0.04}
                  width={s * 0.92}
                  height={s * 0.92}
                  fill="rgba(243,220,155,0.28)"
                  stroke={COLORS.goldLight}
                  strokeWidth={s * 0.05}
                  rx={s * 0.06}
                  opacity={a}
                />
              );
            case "capture":
              return (
                <circle
                  key={i}
                  cx={x + s / 2}
                  cy={y + s / 2}
                  r={s * 0.44}
                  fill="none"
                  stroke={COLORS.danger}
                  strokeWidth={s * 0.07}
                  opacity={a}
                  strokeDasharray={`${Math.PI * 2 * s * 0.44 * a} 9999`}
                  transform={`rotate(-90 ${x + s / 2} ${y + s / 2})`}
                />
              );
            case "check":
              return (
                <rect
                  key={i}
                  x={x - s * 0.15}
                  y={y - s * 0.15}
                  width={s * 1.3}
                  height={s * 1.3}
                  fill="url(#checkGlow)"
                  opacity={a}
                />
              );
            case "blocked": {
              const m = s * 0.3;
              return (
                <g
                  key={i}
                  opacity={a}
                  stroke={COLORS.danger}
                  strokeWidth={s * 0.08}
                  strokeLinecap="round"
                >
                  <rect
                    x={x}
                    y={y}
                    width={s}
                    height={s}
                    fill={COLORS.dangerSoft}
                    stroke="none"
                    opacity={0.45}
                  />
                  <line x1={x + m} y1={y + m} x2={x + s - m} y2={y + s - m} />
                  <line x1={x + s - m} y1={y + m} x2={x + m} y2={y + s - m} />
                </g>
              );
            }
            default:
              return null;
          }
        })}
      </svg>

      {/* Pieces layer */}
      <div
        style={{
          position: "absolute",
          left: frame,
          top: frame,
          width: size,
          height: size,
          transformStyle: "preserve-3d",
        }}
      >
        {ordered.map((p) => {
          const lift = p.lift ?? 0;
          const scale = (p.scale ?? 1) * (tilt ? 1.18 : 1) * (1 + lift * 0.25);
          const pieceSize = s * 0.98 * scale;
          const left = cx(p.x) - pieceSize / 2;
          const bottom = cy(p.y) + s * 0.44; // base sits near the square's bottom edge
          return (
            <React.Fragment key={p.id}>
              {/* contact shadow stays on the board while the piece lifts */}
              <div
                style={{
                  position: "absolute",
                  left: cx(p.x) - s * 0.34,
                  top: cy(p.y) + s * 0.24,
                  width: s * 0.68,
                  height: s * 0.2,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0))",
                  opacity: (p.opacity ?? 1) * (1 - lift * 0.6),
                  transform: `scale(${1 - lift * 0.3})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left,
                  top: bottom - pieceSize,
                  width: pieceSize,
                  height: pieceSize,
                  opacity: p.opacity ?? 1,
                  transformOrigin: "50% 92%",
                  transform: tilt
                    ? `rotateX(${-tilt}deg) translateY(${-lift * s * 1.2}px)`
                    : `translateY(${-lift * s * 1.2}px)`,
                }}
              >
                <PieceSvg
                  type={p.type}
                  color={p.color}
                  size={pieceSize}
                  glow={p.glow}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Arrows on top of pieces so the path is always readable */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          left: frame,
          top: frame,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {arrows.map((a, i) => (
          <ArrowPath key={i} arrow={a} s={s} cx={cx} cy={cy} />
        ))}
      </svg>
    </div>
  );
};

const ArrowPath: React.FC<{
  arrow: Arrow;
  s: number;
  cx: (x: number) => number;
  cy: (y: number) => number;
}> = ({ arrow, s, cx, cy }) => {
  const t = Math.max(0, Math.min(1, arrow.progress));
  if (t <= 0) return null;
  const a = sq(arrow.from);
  const b = sq(arrow.to);
  const color = arrow.color ?? COLORS.gold;
  const pts: [number, number][] = [[cx(a.x), cy(a.y)]];
  if (arrow.knight) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const corner =
      Math.abs(dy) > Math.abs(dx) ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
    pts.push([cx(corner.x), cy(corner.y)]);
  }
  pts.push([cx(b.x), cy(b.y)]);

  // Shorten the tip so the head ends inside the target square.
  const [ex, ey] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2];
  const len = Math.hypot(ex - px, ey - py) || 1;
  const ux = (ex - px) / len;
  const uy = (ey - py) / len;
  const tipBack = s * 0.12;
  pts[pts.length - 1] = [ex - ux * tipBack, ey - uy * tipBack];

  const segLens = pts
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = segLens.reduce((m, v) => m + v, 0);
  // Point at the current draw position.
  let remaining = total * t;
  let head: [number, number] = pts[0];
  let dir: [number, number] = [ux, uy];
  for (let i = 0; i < segLens.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const l = segLens[i];
    dir = [(x1 - x0) / (l || 1), (y1 - y0) / (l || 1)];
    if (remaining <= l || i === segLens.length - 1) {
      const k = Math.min(remaining, l);
      head = [x0 + dir[0] * k, y0 + dir[1] * k];
      break;
    }
    remaining -= l;
  }
  const headLen = s * 0.3;
  const headW = s * 0.22;
  const bx = head[0] - dir[0] * headLen;
  const by = head[1] - dir[1] * headLen;
  const nx = -dir[1];
  const ny = dir[0];
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
  const shaftEnd = total * t - headLen * 0.6;

  return (
    <g
      opacity={arrow.opacity ?? 1}
      style={{ filter: `drop-shadow(0 0 ${s * 0.08}px ${color})` }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={s * 0.11}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${Math.max(0, shaftEnd)} 99999`}
        opacity={0.92}
      />
      <polygon
        points={`${head[0]},${head[1]} ${bx + nx * headW},${by + ny * headW} ${bx - nx * headW},${by - ny * headW}`}
        fill={color}
      />
      <circle cx={pts[0][0]} cy={pts[0][1]} r={s * 0.09} fill={color} />
    </g>
  );
};
