import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const enter = (frame: number, start: number, dur = 18) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: ease });

export const exit = (frame: number, end: number, dur = 10) =>
  interpolate(frame, [end - dur, end], [1, 0], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });

/** Small gold, letter-spaced label with a thin rule on both sides. */
export const Kicker: React.FC<{
  text: string;
  start?: number;
  end?: number;
}> = ({ text, start = 0, end = Infinity }) => {
  const frame = useCurrentFrame();
  const t = enter(frame, start, 20);
  const o = Number.isFinite(end) ? exit(frame, end) : 1;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        opacity: t * o,
        fontFamily: FONT_SANS,
        fontWeight: 800,
        fontSize: 30,
        letterSpacing: "0.32em",
        color: COLORS.gold,
        textTransform: "uppercase",
      }}
    >
      <div
        style={{
          height: 2,
          width: 70 * t,
          background: `linear-gradient(90deg, transparent, ${COLORS.gold})`,
        }}
      />
      <span style={{ paddingLeft: "0.32em" }}>{text}</span>
      <div
        style={{
          height: 2,
          width: 70 * t,
          background: `linear-gradient(270deg, transparent, ${COLORS.gold})`,
        }}
      />
    </div>
  );
};

/**
 * Headline where words wrapped in *asterisks* are set in gold serif italic.
 * Words rise in with a short stagger.
 */
export const Headline: React.FC<{
  text: string;
  start?: number;
  end?: number;
  size?: number;
  stagger?: number;
  lineHeight?: number;
}> = ({
  text,
  start = 0,
  end = Infinity,
  size = 92,
  stagger = 3,
  lineHeight = 1.05,
}) => {
  const frame = useCurrentFrame();
  const o = Number.isFinite(end) ? exit(frame, end, 12) : 1;
  const tokens = parseEmphasis(text);
  let wordIndex = 0;
  return (
    <div
      style={{
        textAlign: "center",
        fontFamily: FONT_SANS,
        fontWeight: 900,
        fontSize: size,
        lineHeight,
        color: COLORS.white,
        letterSpacing: "-0.01em",
        textTransform: "uppercase",
        opacity: o,
        textShadow: "0 6px 30px rgba(0,0,0,0.6)",
      }}
    >
      {tokens.map((tok, ti) =>
        tok.text.split(/(\s+|\n)/).map((w, wi) => {
          if (w === "\n") return <br key={`${ti}-${wi}`} />;
          if (/^\s+$/.test(w) || w === "") return w ? " " : null;
          const t = enter(frame, start + wordIndex++ * stagger, 20);
          return (
            <span
              key={`${ti}-${wi}`}
              style={{
                display: "inline-block",
                opacity: t,
                transform: `translateY(${(1 - t) * 40}px)`,
                ...(tok.em
                  ? {
                      fontFamily: FONT_SERIF,
                      fontStyle: "italic",
                      fontWeight: 700,
                      textTransform: "none",
                      fontSize: size * 1.08,
                      letterSpacing: 0,
                      background: `linear-gradient(180deg, ${COLORS.goldLight} 10%, ${COLORS.gold} 60%, ${COLORS.goldDeep} 100%)`,
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                      padding: "0 0.06em",
                      textShadow: "none",
                      filter: "drop-shadow(0 4px 18px rgba(216,178,90,0.35))",
                    }
                  : {}),
              }}
            >
              {w}
            </span>
          );
        }),
      )}
    </div>
  );
};

/** Short supporting rule text under the headline. */
export const Subline: React.FC<{
  text: string;
  start?: number;
  end?: number;
  size?: number;
}> = ({ text, start = 0, end = Infinity, size = 44 }) => {
  const frame = useCurrentFrame();
  const t = enter(frame, start, 18);
  const o = Number.isFinite(end) ? exit(frame, end) : 1;
  return (
    <div
      style={{
        textAlign: "center",
        fontFamily: FONT_SANS,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.25,
        whiteSpace: "pre-line",
        color: COLORS.muted,
        opacity: t * o,
        transform: `translateY(${(1 - t) * 16}px)`,
      }}
    >
      {parseEmphasis(text).map((tok, i) =>
        tok.em ? (
          <span key={i} style={{ color: COLORS.goldLight, fontWeight: 800 }}>
            {tok.text}
          </span>
        ) : (
          <span key={i}>{tok.text}</span>
        ),
      )}
    </div>
  );
};

/** Pill badge, e.g. "JAQUE" or "0-0". */
export const Badge: React.FC<{
  text: string;
  start: number;
  end?: number;
  tone?: "gold" | "danger";
  size?: number;
}> = ({ text, start, end = Infinity, tone = "gold", size = 54 }) => {
  const frame = useCurrentFrame();
  const t = enter(frame, start, 14);
  const o = Number.isFinite(end) ? exit(frame, end) : 1;
  const pop = interpolate(
    frame,
    [start, start + 6, start + 14],
    [0.6, 1.12, 1],
    clamp,
  );
  const bg = tone === "danger" ? COLORS.danger : COLORS.gold;
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${size * 0.22}px ${size * 0.55}px`,
        borderRadius: size,
        background: `linear-gradient(180deg, ${tone === "danger" ? "#f0625a" : COLORS.goldLight}, ${bg})`,
        color: tone === "danger" ? "#fff" : COLORS.ink,
        fontFamily: FONT_SANS,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "0.06em",
        boxShadow: `0 10px 40px ${tone === "danger" ? "rgba(224,71,63,0.55)" : "rgba(216,178,90,0.45)"}`,
        opacity: t * o,
        transform: `scale(${pop})`,
      }}
    >
      {text}
    </div>
  );
};

export const parseEmphasis = (text: string) => {
  const parts = text.split("*");
  return parts
    .map((p, i) => ({ text: p, em: i % 2 === 1 }))
    .filter((p) => p.text.length > 0);
};
