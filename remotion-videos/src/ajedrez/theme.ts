import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const FONT_SANS = "Montserrat";
export const FONT_SERIF = "Playfair Display";

const fonts = [
  {
    family: FONT_SANS,
    file: "montserrat-latin-600-normal.woff2",
    weight: "600",
  },
  {
    family: FONT_SANS,
    file: "montserrat-latin-800-normal.woff2",
    weight: "800",
  },
  {
    family: FONT_SANS,
    file: "montserrat-latin-900-normal.woff2",
    weight: "900",
  },
  {
    family: FONT_SERIF,
    file: "playfair-display-latin-700-italic.woff2",
    weight: "700",
    style: "italic",
  },
] as const;

export const fontsReady = Promise.all(
  fonts.map((f) =>
    loadFont({
      family: f.family,
      url: staticFile(`ajedrez/fonts/${f.file}`),
      weight: f.weight,
      style: "style" in f ? f.style : "normal",
    }),
  ),
);

export const COLORS = {
  ink: "#04060c",
  navy: "#0a1428",
  navyLight: "#16284a",
  gold: "#d8b25a",
  goldLight: "#f3dc9b",
  goldDeep: "#9c7a2e",
  white: "#f7f3ea",
  muted: "rgba(247, 243, 234, 0.62)",
  lightSquare: "#e4d4aa",
  lightSquareShade: "#cbb784",
  darkSquare: "#1f3558",
  darkSquareShade: "#152742",
  move: "rgba(216, 178, 90, 0.55)",
  danger: "#e0473f",
  dangerSoft: "rgba(224, 71, 63, 0.55)",
};

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
};

// Safe area for TikTok: top bar, right action column and bottom description.
export const SAFE = {
  top: 210,
  bottom: 1560,
  left: 80,
  right: 920,
};
