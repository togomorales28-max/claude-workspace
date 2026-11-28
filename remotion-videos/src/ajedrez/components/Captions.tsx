import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CAPTION_CHUNKS } from "../captions";
import { COLORS, FONT_SANS } from "../theme";
import { CAPTION_BOX } from "../layout";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Burned-in captions. Placed between the board and TikTok's description area,
 * clear of the right-hand action buttons.
 */
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const chunk = CAPTION_CHUNKS.find(
    (c) => frame >= c.start && frame < c.end + 4,
  );
  if (!chunk) return null;

  const local = frame - chunk.start;
  const inT = interpolate(local, [0, 7], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const outT = interpolate(frame, [chunk.end, chunk.end + 4], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: CAPTION_BOX.left,
          width: CAPTION_BOX.width,
          top: CAPTION_BOX.top,
          height: CAPTION_BOX.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontFamily: FONT_SANS,
            fontWeight: 900,
            fontSize: 60,
            lineHeight: 1.12,
            color: COLORS.white,
            opacity: inT * outT,
            transform: `translateY(${(1 - inT) * 18}px) scale(${0.92 + 0.08 * inT})`,
            textShadow: "0 4px 14px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)",
            WebkitTextStroke: "2px rgba(4,6,12,0.85)",
            paintOrder: "stroke fill",
          }}
        >
          {chunk.words.map((w, i) => {
            // Keyword pops slightly after the chunk appears.
            const pop = w.em
              ? interpolate(local, [3, 9, 14], [1, 1.12, 1], clamp)
              : 1;
            return (
              <React.Fragment key={i}>
                <span
                  style={{
                    display: "inline-block",
                    color: w.em ? COLORS.goldLight : COLORS.white,
                    transform: `scale(${pop})`,
                  }}
                >
                  {w.text}
                </span>
                {i < chunk.words.length - 1 ? " " : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
