import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
} from "remotion";
import { Board } from "../components/Board";
import { Headline, Kicker } from "../components/Typography";
import { HeaderSlot } from "../components/Stage";
import { STARTING_POSITION } from "../chess";
import { INTRO } from "../timeline";
import { COL_CENTER } from "../layout";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SIZE = 820;

/** Scene 1: dramatic 3D board, camera push-in, title. */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.33, 0, 0.2, 1);
  const tilt = interpolate(frame, [0, 162], [62, 46], {
    ...clamp,
    easing: ease,
  });
  const zoom = interpolate(frame, [0, 162], [0.74, 1.04], {
    ...clamp,
    easing: ease,
  });
  const rise = interpolate(frame, [0, 162], [160, 40], {
    ...clamp,
    easing: ease,
  });
  const sweep = interpolate(frame, [18, 120], [0, 1], clamp);
  const boardIn = interpolate(frame, [0, 24], [0, 1], clamp);

  const pieces = STARTING_POSITION.map((p) => {
    // Pieces settle onto the board rank by rank, from the camera outwards.
    const order =
      p.color === "w" ? (p.type === "P" ? 1 : 0) : p.type === "P" ? 2 : 3;
    const delay = 6 + order * 7 + random(p.id) * 8;
    const t = interpolate(frame, [delay, delay + 16], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.back(1.4)),
    });
    return { ...p, opacity: Math.min(1, t * 1.6), lift: (1 - t) * 0.7 };
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: COL_CENTER - (SIZE + 46) / 2,
          top: 820 + rise,
          perspective: 1700,
          perspectiveOrigin: "50% -20%",
          opacity: boardIn,
        }}
      >
        <div
          style={{ transform: `scale(${zoom})`, transformStyle: "preserve-3d" }}
        >
          <Board
            size={SIZE}
            pieces={pieces}
            tilt={tilt}
            sweep={sweep}
            showCoords={false}
          />
        </div>
      </div>
      <HeaderSlot>
        <Kicker text="Ajedrez desde cero" start={INTRO.title - 6} />
        <Headline
          text={"¿Quieres aprender\na jugar *ajedrez?*"}
          start={INTRO.title}
          size={96}
        />
      </HeaderSlot>
    </AbsoluteFill>
  );
};
