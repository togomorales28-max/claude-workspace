import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { XFADE } from "../timeline";
import { BOARD_LEFT, BOARD_TOP, COL_CENTER, HEADER } from "../layout";
import { Board } from "./Board";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Dip-dissolve wrapper: the outgoing scene fades out over the first part of
 * the overlap and the incoming one fades in over the last part, so titles of
 * consecutive scenes never sit on top of each other.
 */
export const SceneFade: React.FC<{
  children: React.ReactNode;
  fadeIn?: boolean;
  fadeOut?: boolean;
}> = ({ children, fadeIn = true, fadeOut = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const i = fadeIn
    ? interpolate(frame, [4, XFADE], [0, 1], {
        ...clamp,
        easing: Easing.out(Easing.cubic),
      })
    : 1;
  const o = fadeOut
    ? interpolate(
        frame,
        [durationInFrames - XFADE, durationInFrames - 4],
        [1, 0],
        {
          ...clamp,
          easing: Easing.in(Easing.cubic),
        },
      )
    : 1;
  return (
    <AbsoluteFill
      style={{ opacity: i * o, transform: `scale(${1.03 - 0.03 * i})` }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Header slot (kicker + headline + rule line) in the top safe area. */
export const HeaderSlot: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: COL_CENTER - 430,
      width: 860,
      top: HEADER.top,
      height: HEADER.height,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
    }}
  >
    {children}
  </div>
);

/** Flat board in the standard layout position. */
export const BoardStage: React.FC<React.ComponentProps<typeof Board>> = (
  props,
) => (
  <div style={{ position: "absolute", left: BOARD_LEFT, top: BOARD_TOP }}>
    <Board {...props} />
  </div>
);

/** Absolutely place an overlay centred on a square of the standard board. */
export const OnSquare: React.FC<{
  x: number;
  y: number;
  size: number;
  children: React.ReactNode;
}> = ({ x, y, size, children }) => {
  const s = size / 8;
  const frame = Math.max(10, size * 0.028);
  return (
    <div
      style={{
        position: "absolute",
        left: BOARD_LEFT + frame + x * s + s / 2,
        top: BOARD_TOP + frame + (7 - y) * s + s / 2,
        transform: "translate(-50%, -50%)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
};
