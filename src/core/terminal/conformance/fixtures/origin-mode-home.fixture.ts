import type { RetroLcdTerminalFixture } from "../types";

export const originModeHomeFixture: RetroLcdTerminalFixture = {
  name: "origin-mode-home",
  description: "DEC origin mode should home the cursor to the top of the active scroll region.",
  classification: "implemented",
  rows: 5,
  cols: 6,
  chunks: ["\u001b[2;4r\u001b[?6hX"],
  chunkModes: ["fixture", "joined", "byte"]
};
