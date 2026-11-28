import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import type { PlacedPiece } from "../chess";
import { progress } from "../chess";
import type { Arrow, Highlight } from "./Board";
import { BoardStage, HeaderSlot } from "./Stage";
import { Headline, Kicker, Subline } from "./Typography";
import { BOARD_SIZE } from "../layout";

export type DemoState = {
  pieces: PlacedPiece[];
  highlights?: Highlight[];
  arrows?: Arrow[];
};

export type Demo = {
  key: string;
  from: number;
  dur: number;
  kicker: string;
  title: string;
  rule: string;
  state: (f: number) => DemoState;
  overlay?: (f: number) => React.ReactNode;
};

const FADE = 9;

/**
 * Runs consecutive demos on ONE persistent board: each demo's pieces,
 * highlights and arrows cross-fade into the next, while the header text
 * for each demo animates in its own Sequence.
 */
export const DemoMix: React.FC<{ demos: Demo[] }> = ({ demos }) => {
  const frame = useCurrentFrame();
  const pieces: PlacedPiece[] = [];
  const highlights: Highlight[] = [];
  const arrows: Arrow[] = [];

  demos.forEach((d, i) => {
    const f = frame - d.from;
    if (f < 0 || f >= d.dur + FADE) return;
    const isLast = i === demos.length - 1;
    const wIn = i === 0 ? 1 : progress(frame, d.from, FADE);
    const wOut = isLast ? 1 : 1 - progress(frame, d.from + d.dur, FADE);
    const w = wIn * wOut;
    const st = d.state(f);
    st.pieces.forEach((p) =>
      pieces.push({
        ...p,
        id: `${d.key}-${p.id}`,
        opacity: (p.opacity ?? 1) * w,
      }),
    );
    st.highlights?.forEach((h) =>
      highlights.push({ ...h, appear: h.appear * w }),
    );
    st.arrows?.forEach((a) =>
      arrows.push({ ...a, opacity: (a.opacity ?? 1) * w }),
    );
  });

  return (
    <>
      <BoardStage
        size={BOARD_SIZE}
        pieces={pieces}
        highlights={highlights}
        arrows={arrows}
      />
      {demos.map((d, i) => (
        <Sequence
          key={d.key}
          name={d.title.replace(/\*/g, "")}
          from={d.from}
          durationInFrames={d.dur + (i === demos.length - 1 ? 0 : FADE)}
          layout="none"
        >
          <DemoHeader demo={d} last={i === demos.length - 1} />
        </Sequence>
      ))}
    </>
  );
};

const DemoHeader: React.FC<{ demo: Demo; last: boolean }> = ({
  demo,
  last,
}) => {
  const f = useCurrentFrame();
  return (
    <>
      <HeaderSlot>
        <Kicker text={demo.kicker} start={2} end={last ? Infinity : demo.dur} />
        <Headline
          text={demo.title}
          start={4}
          end={last ? Infinity : demo.dur}
          size={100}
        />
        <Subline
          text={demo.rule}
          start={12}
          end={last ? Infinity : demo.dur}
          size={42}
        />
      </HeaderSlot>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: last ? 1 : 1 - progress(f, demo.dur - 8, 8),
        }}
      >
        {demo.overlay?.(f)}
      </div>
    </>
  );
};
