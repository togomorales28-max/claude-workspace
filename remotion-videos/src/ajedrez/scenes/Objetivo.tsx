import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BoardStage, HeaderSlot, OnSquare } from "../components/Stage";
import { Badge, Headline, Kicker } from "../components/Typography";
import { moveAt, piece, progress, sq } from "../chess";
import { OBJETIVO as T } from "../timeline";
import { BOARD_SIZE } from "../layout";

/** Scene 2: the goal is checkmate. Qg7# supported by the king on f6. */
export const Objetivo: React.FC = () => {
  const frame = useCurrentFrame();
  const q = moveAt(frame, "g1", "g7", T.move, 18);
  const afterMate = frame >= T.mate;
  const shake = afterMate
    ? Math.sin(frame * 2.2) * 0.04 * Math.max(0, 1 - (frame - T.mate) / 20)
    : 0;

  const pieces = [
    piece("bK", "K", "b", "h8", {
      x: sq("h8").x + shake,
      glow: interpolate(
        frame,
        [T.king, T.king + 10, T.king + 40, T.king + 50],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ),
    }),
    piece("bR", "R", "b", "a8"),
    piece("bPa", "P", "b", "a7"),
    piece("bPb", "P", "b", "b7"),
    piece("wK", "K", "w", "f6"),
    piece("wQ", "Q", "w", "g1", { ...q }),
    piece("wPa", "P", "w", "a2"),
    piece("wPb", "P", "w", "b2"),
  ];

  const arrowP = progress(frame, T.arrow, 22);
  const arrowFade = 1 - progress(frame, T.move + 10, 8);

  return (
    <AbsoluteFill>
      <HeaderSlot>
        <Kicker text="El objetivo" start={T.title - 4} />
        <Headline
          text={"Dar *jaque mate*\nal rey rival"}
          start={T.title}
          size={92}
        />
      </HeaderSlot>
      <BoardStage
        size={BOARD_SIZE}
        pieces={pieces}
        highlights={[
          {
            square: "h8",
            kind: "origin",
            appear:
              progress(frame, T.king, 10) *
              (1 - progress(frame, T.mate - 4, 6)),
          },
          { square: "h8", kind: "check", appear: progress(frame, T.mate, 8) },
          {
            square: "g8",
            kind: "blocked",
            appear: progress(frame, T.mate + 8, 8),
          },
          {
            square: "h7",
            kind: "blocked",
            appear: progress(frame, T.mate + 14, 8),
          },
          {
            square: "g1",
            kind: "origin",
            appear: progress(frame, T.arrow, 8) * arrowFade,
          },
        ]}
        arrows={[
          { from: "g1", to: "g7", progress: arrowP, opacity: arrowFade },
        ]}
      />
      <OnSquare x={5.4} y={7} size={BOARD_SIZE}>
        <Badge text="REY →" start={T.king + 6} end={T.arrow} size={40} />
      </OnSquare>
      <OnSquare x={3.5} y={3.5} size={BOARD_SIZE}>
        <Badge text="JAQUE MATE" start={T.mate + 4} tone="danger" size={74} />
      </OnSquare>
    </AbsoluteFill>
  );
};
