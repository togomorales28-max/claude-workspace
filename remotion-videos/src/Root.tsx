import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { HelloWorld } from "./HelloWorld";

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
    </>
  );
};
