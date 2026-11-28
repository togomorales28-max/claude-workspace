import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile } from "remotion";
import { LINES } from "../captions";
import manifest from "../data/voice-manifest.json";
import { SFX_EVENTS, TOTAL_FRAMES } from "../timeline";

const VOICE_FILES = manifest.files as Record<
  string,
  { file: string; durationInFrames: number }
>;
const HAS_VOICE = Object.keys(VOICE_FILES).length > 0;
const VOICE_LINES = LINES.filter((l) => VOICE_FILES[l.id]);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Music is ducked under the voice-over when voice files are present. */
const musicVolume = (f: number) => {
  const fade = interpolate(
    f,
    [0, 20, TOTAL_FRAMES - 45, TOTAL_FRAMES],
    [0, 1, 1, 0],
    clamp,
  );
  const base = HAS_VOICE ? 0.5 : 0.75;
  if (!HAS_VOICE) return base * fade;
  // Distance (in frames) to the nearest voice take; 0 while speaking.
  const dist = Math.min(
    ...VOICE_LINES.map((l) => {
      const a = l.start;
      const b = l.start + VOICE_FILES[l.id].durationInFrames;
      return f < a ? a - f : f > b ? f - b : 0;
    }),
  );
  // Smooth duck: ~-11 dB under the voice, recovering over 10 frames.
  const duck = interpolate(dist, [0, 10], [0.28, 1], clamp);
  return fade * base * duck;
};

export const Soundtrack: React.FC = () => (
  <>
    <Audio
      name="Música"
      src={staticFile("ajedrez/audio/musica/cinematica.wav")}
      volume={musicVolume}
    />
    {SFX_EVENTS.map((e, i) => (
      <Sequence
        key={i}
        name={`SFX ${e.name}`}
        from={Math.max(0, e.frame)}
        durationInFrames={90}
        layout="none"
      >
        <Audio
          src={staticFile(`ajedrez/audio/sfx/${e.name}.wav`)}
          volume={e.volume ?? 0.7}
        />
      </Sequence>
    ))}
    {VOICE_LINES.map((l) => (
      <Sequence
        key={l.id}
        name={`Voz ${l.id}`}
        from={l.start}
        durationInFrames={VOICE_FILES[l.id].durationInFrames}
        layout="none"
      >
        <Audio
          src={staticFile(`ajedrez/audio/voz/${VOICE_FILES[l.id].file}`)}
          volume={1}
        />
      </Sequence>
    ))}
  </>
);
