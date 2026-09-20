import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Source of truth: assets/fonts/ at the repo root; copies live in public/fonts/.
const dmSans = loadFont({
  family: "DM Sans",
  format: "woff2",
  url: staticFile("fonts/DMSans-Variable.woff2"),
  weight: "100 900",
});

const outfit = loadFont({
  family: "Outfit",
  format: "woff2",
  url: staticFile("fonts/Outfit-Variable.woff2"),
  weight: "100 900",
});

export const fontsReady: Promise<void> = Promise.all([dmSans, outfit]).then(() => undefined);
