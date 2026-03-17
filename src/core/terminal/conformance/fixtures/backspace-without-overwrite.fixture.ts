import type { RetroLcdTerminalFixture } from "../types";

export const backspaceWithoutOverwriteFixture: RetroLcdTerminalFixture = {
  name: "backspace-without-overwrite",
  description: "Backspace should move the cursor left without erasing the cell under it.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["AB\b"],
  chunkModes: ["fixture", "joined", "byte"]
};
