import { Composition, Folder } from "remotion";
import { MyComposition } from "./Composition";
import { HelloWorld } from "./HelloWorld";
import { AjedrezTikTok } from "./ajedrez/AjedrezTikTok";
import { PieceSheet } from "./ajedrez/PieceSheet";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Ajedrez">
        <Composition
          id="AjedrezTikTok"
          component={AjedrezTikTok}
          durationInFrames={1950}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ subtitles: true }}
        />
        <Composition
          id="PieceSheet"
          component={PieceSheet}
          durationInFrames={1}
          fps={30}
          width={2200}
          height={800}
        />
      </Folder>
      <Folder name="Ejemplos">
        <MyComposition />
        <Composition
          id="HelloWorld"
          component={HelloWorld}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Hola Remotion" }}
        />
      </Folder>
    </>
  );
};
