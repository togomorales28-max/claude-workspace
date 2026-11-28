import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

/**
 * Cinematic backdrop shared by every scene: black-to-navy gradient,
 * a soft top spotlight, slow drifting dust and a vignette.
 * Uses the absolute frame passed in so it never "restarts" between scenes.
 */
export const Atmosphere: React.FC<{
  globalFrame?: number;
  spotY?: number;
  intensity?: number;
}> = ({ globalFrame, spotY = 960, intensity = 1 }) => {
  const local = useCurrentFrame();
  const f = globalFrame ?? local;
  const breathe = 0.9 + 0.1 * Math.sin(f / 45);
  return (
    <AbsoluteFill style={{ background: COLORS.ink, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 70% at 50% 40%, ${COLORS.navyLight} 0%, ${COLORS.navy} 38%, ${COLORS.ink} 78%)`,
        }}
      />
      {/* key light from above */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 55% 38% at 50% ${spotY}px, rgba(243,220,155,${0.16 * breathe * intensity}) 0%, rgba(243,220,155,0) 70%)`,
        }}
      />
      {/* volumetric beam */}
      <div
        style={{
          position: "absolute",
          left: 540 - 420,
          top: -200,
          width: 840,
          height: spotY + 300,
          background: `linear-gradient(180deg, rgba(255,246,220,${0.07 * intensity}) 0%, rgba(255,246,220,0) 100%)`,
          clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)",
          filter: "blur(30px)",
          opacity: breathe,
        }}
      />
      <Dust frame={f} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Dust: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill>
      {Array.from({ length: 34 }, (_, i) => {
        const x0 = random(`dx${i}`) * 1080;
        const y0 = random(`dy${i}`) * 1920;
        const speed = 0.15 + random(`ds${i}`) * 0.45;
        const r = 1.5 + random(`dr${i}`) * 3.5;
        const y = (((y0 - frame * speed) % 1920) + 1920) % 1920;
        const x = x0 + Math.sin(frame / 60 + i) * 14;
        const tw = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(frame / 20 + i * 1.7));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              background: COLORS.goldLight,
              opacity: tw * 0.35,
              filter: `blur(${r > 3.5 ? 2 : 0.5}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
