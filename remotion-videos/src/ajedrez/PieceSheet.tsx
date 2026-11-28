import { AbsoluteFill } from "remotion";
import { PieceSvg } from "./components/Piece";
import type { PieceType } from "./chess";

const TYPES: PieceType[] = ["K", "Q", "R", "B", "N", "P"];

export const PieceSheet: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "#0a1428",
      flexWrap: "wrap",
      flexDirection: "row",
      alignContent: "center",
      justifyContent: "center",
      gap: 30,
    }}
  >
    {(["w", "b"] as const).map((c) =>
      TYPES.map((t) => (
        <div
          key={c + t}
          style={{ background: c === "w" ? "#1f3558" : "#e4d4aa", padding: 10 }}
        >
          <PieceSvg type={t} color={c} size={300} />
        </div>
      )),
    )}
  </AbsoluteFill>
);
