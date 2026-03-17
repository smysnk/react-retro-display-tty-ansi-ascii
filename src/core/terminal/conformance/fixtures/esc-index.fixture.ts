import type { RetroLcdTerminalFixture } from "../types";

export const escIndexFixture: RetroLcdTerminalFixture = {
  name: "esc-index",
  description: "ESC D should perform IND, moving the cursor down while preserving the column.",
  classification: "implemented",
  rows: 3,
  cols: 4,
  chunks: ["AB\u001bDZ"],
  chunkModes: ["fixture", "joined", "byte"]
};
