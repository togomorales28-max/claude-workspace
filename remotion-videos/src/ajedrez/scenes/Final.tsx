import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PieceSvg } from "../components/Piece";
import { Headline, Subline, enter } from "../components/Typography";
import { FINAL as T } from "../timeline";
import { COL_CENTER } from "../layout";
import { COLORS } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Scene 6: call to action. */
export const Final: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const kingIn = interpolate(frame, [0, 40], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const float = Math.sin(frame / 18) * 8;
  const saveT = enter(frame, T.subtitle + 6, 16);
  const tap = interpolate(
    frame,
    [T.subtitle + 30, T.subtitle + 36, T.subtitle + 44],
    [1, 0.82, 1],
    clamp,
  );
  const toBlack = interpolate(
    frame,
    [durationInFrames - 16, durationInFrames],
    [0, 1],
    clamp,
  );

  return (
    <AbsoluteFill>
      {/* halo behind the king */}
      <div
        style={{
          position: "absolute",
          left: COL_CENTER - 420,
          top: 640,
          width: 840,
          height: 840,
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(243,220,155,0.32), rgba(216,178,90,0.08) 55%, rgba(0,0,0,0) 100%)",
          opacity: kingIn,
          transform: `scale(${0.85 + 0.15 * kingIn})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: COL_CENTER - 230,
          top: 760 + (1 - kingIn) * 80 + float,
          opacity: kingIn,
        }}
      >
        <PieceSvg type="K" color="w" size={460} glow={0.6} />
      </div>

      <div
        style={{
          position: "absolute",
          left: COL_CENTER - 450,
          width: 900,
          top: 270,
        }}
      >
        <Headline
          text={"Ahora te toca\n*jugar*"}
          start={T.title}
          size={124}
          stagger={4}
          lineHeight={1.02}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: COL_CENTER - 430,
          width: 860,
          top: 1300,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 46,
            background: `linear-gradient(180deg, ${COLORS.goldLight}, ${COLORS.gold})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: saveT,
            transform: `scale(${saveT * tap})`,
            boxShadow: "0 10px 40px rgba(216,178,90,0.5)",
          }}
        >
          <svg width={44} height={44} viewBox="0 0 24 24">
            <path
              d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"
              fill={COLORS.ink}
            />
          </svg>
        </div>
        <Subline
          text={"Guarda este video\ny empieza a *practicar*."}
          start={T.subtitle}
          size={50}
        />
      </div>
      <AbsoluteFill style={{ background: "#000", opacity: toBlack }} />
    </AbsoluteFill>
  );
};
