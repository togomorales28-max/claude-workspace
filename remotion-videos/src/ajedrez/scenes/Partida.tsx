import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BoardStage, HeaderSlot } from "../components/Stage";
import { Headline, Kicker, enter } from "../components/Typography";
import type { Arrow, Highlight } from "../components/Board";
import { STARTING_POSITION, moveAt, progress } from "../chess";
import { PARTIDA as T } from "../timeline";
import { BOARD_SIZE } from "../layout";
import { COLORS, FONT_SANS } from "../theme";

/** 1. e4 e5 2. Cf3 Cc6 3. Ac4 (Spanish notation: C = caballo, A = alfil). */
const MOVES = [
  { id: "wPe", from: "e2", to: "e4", san: "e4", num: "1." },
  { id: "bPe", from: "e7", to: "e5", san: "e5", num: "" },
  { id: "wNg", from: "g1", to: "f3", san: "Cf3", num: "2." },
  { id: "bNb", from: "b8", to: "c6", san: "Cc6", num: "" },
  { id: "wBf", from: "f1", to: "c4", san: "Ac4", num: "3." },
] as const;

const CENTER = ["d4", "e4", "d5", "e5"];

/** Scene 5: a short, legal opening sequence. */
export const Partida: React.FC = () => {
  const frame = useCurrentFrame();

  const pieces = STARTING_POSITION.map((p) => {
    const i = MOVES.findIndex((m) => m.id === p.id);
    if (i < 0) return p;
    const m = MOVES[i];
    const isKnight = p.type === "N";
    const pos = moveAt(
      frame,
      m.from,
      m.to,
      T.moves[i],
      16,
      isKnight ? 0.5 : 0.2,
    );
    const glow = interpolate(
      frame,
      [T.moves[i] + 10, T.moves[i] + 18, T.moves[i] + 44],
      [0, 0.8, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    return { ...p, ...pos, glow };
  });

  const highlights: Highlight[] = [];
  const arrows: Arrow[] = [];
  MOVES.forEach((m, i) => {
    const start = T.moves[i];
    const next = T.moves[i + 1] ?? T.center;
    const live =
      progress(frame, start - 14, 8) * (1 - progress(frame, next - 6, 8));
    highlights.push({ square: m.from, kind: "origin", appear: live * 0.7 });
    highlights.push({
      square: m.to,
      kind: "fill",
      appear: live * progress(frame, start + 12, 6),
    });
    arrows.push({
      from: m.from,
      to: m.to,
      knight: m.id.includes("N"),
      progress: progress(frame, start - 14, 12),
      opacity: 1 - progress(frame, start + 14, 6),
    });
  });
  CENTER.forEach((s, i) => {
    const pulse = 0.75 + 0.25 * Math.sin((frame - T.center) / 5);
    highlights.push({
      square: s,
      kind: "origin",
      appear: progress(frame, T.center + i * 3, 8) * pulse,
    });
  });

  return (
    <AbsoluteFill>
      <HeaderSlot>
        <Kicker text="Ejemplo de partida" start={2} />
        <Headline text="Una apertura *clásica*" start={4} size={88} />
        <MoveList frame={frame} />
      </HeaderSlot>
      <BoardStage
        size={BOARD_SIZE}
        pieces={pieces}
        highlights={highlights}
        arrows={arrows}
      />
    </AbsoluteFill>
  );
};

const MoveList: React.FC<{ frame: number }> = ({ frame }) => {
  const t = enter(frame, 14, 16);
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        opacity: t,
        fontFamily: FONT_SANS,
        fontWeight: 800,
        fontSize: 38,
        marginTop: 6,
      }}
    >
      {MOVES.map((m, i) => {
        const played = progress(frame, T.moves[i] + 8, 8);
        const current =
          played * (1 - progress(frame, (T.moves[i + 1] ?? T.center) + 8, 8));
        return (
          <React.Fragment key={m.san}>
            {m.num && (
              <span
                style={{
                  color: COLORS.muted,
                  fontWeight: 600,
                  marginLeft: i ? 10 : 0,
                }}
              >
                {m.num}
              </span>
            )}
            <span
              style={{
                padding: "8px 16px",
                borderRadius: 14,
                border: `2px solid rgba(216,178,90,${0.25 + 0.75 * played})`,
                background: `rgba(216,178,90,${0.08 + 0.85 * current})`,
                color:
                  current > 0.5
                    ? COLORS.ink
                    : played > 0.5
                      ? COLORS.goldLight
                      : "rgba(247,243,234,0.35)",
                transform: `scale(${1 + 0.1 * current})`,
              }}
            >
              {m.san}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
