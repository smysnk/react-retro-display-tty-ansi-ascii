import type { RetroLcdTerminalFixture } from "../types";

export const escNextLineFixture: RetroLcdTerminalFixture = {
  name: "esc-next-line",
  description: "ESC E should perform NEL, moving to the next line and column zero.",
  classification: "implemented",
  rows: 3,
  cols: 4,
  chunks: ["AB\u001bEZ"],
  chunkModes: ["fixture", "joined", "byte"]
};
