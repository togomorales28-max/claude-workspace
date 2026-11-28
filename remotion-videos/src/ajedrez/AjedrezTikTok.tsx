import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Atmosphere } from "./components/Atmosphere";
import { Captions } from "./components/Captions";
import { Soundtrack } from "./components/Soundtrack";
import { SceneFade } from "./components/Stage";
import { Intro } from "./scenes/Intro";
import { Objetivo } from "./scenes/Objetivo";
import { Piezas } from "./scenes/Piezas";
import { Reglas } from "./scenes/Reglas";
import { Partida } from "./scenes/Partida";
import { Final } from "./scenes/Final";
import { SCENES, XFADE } from "./timeline";
import { fontsReady } from "./theme";

// Make sure the local fonts are registered before the first frame renders.
void fontsReady;

/** "Cómo jugar ajedrez desde cero" — 1080x1920, 30 fps, 65 s. */
export const AjedrezTikTok: React.FC<{ subtitles: boolean }> = ({
  subtitles,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#04060c" }}>
      <Atmosphere globalFrame={frame} spotY={980} />

      <Sequence
        name="1 · Introducción"
        from={SCENES.intro.from}
        durationInFrames={SCENES.intro.dur + XFADE}
      >
        <SceneFade fadeIn={false}>
          <Intro />
        </SceneFade>
      </Sequence>
      <Sequence
        name="2 · Objetivo"
        from={SCENES.objetivo.from}
        durationInFrames={SCENES.objetivo.dur + XFADE}
      >
        <SceneFade>
          <Objetivo />
        </SceneFade>
      </Sequence>
      <Sequence
        name="3 · Las piezas"
        from={SCENES.piezas.from}
        durationInFrames={SCENES.piezas.dur + XFADE}
      >
        <SceneFade>
          <Piezas />
        </SceneFade>
      </Sequence>
      <Sequence
        name="4 · Reglas"
        from={SCENES.reglas.from}
        durationInFrames={SCENES.reglas.dur + XFADE}
      >
        <SceneFade>
          <Reglas />
        </SceneFade>
      </Sequence>
      <Sequence
        name="5 · Partida"
        from={SCENES.partida.from}
        durationInFrames={SCENES.partida.dur + XFADE}
      >
        <SceneFade>
          <Partida />
        </SceneFade>
      </Sequence>
      <Sequence
        name="6 · Final"
        from={SCENES.final.from}
        durationInFrames={SCENES.final.dur}
      >
        <SceneFade fadeOut={false}>
          <Final />
        </SceneFade>
      </Sequence>

      {subtitles && <Captions />}
      <Soundtrack />
    </AbsoluteFill>
  );
};
