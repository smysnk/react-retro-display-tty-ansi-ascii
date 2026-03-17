import type { RetroLcdTerminalFixture } from "../types";

export const insertModePrintFixture: RetroLcdTerminalFixture = {
  name: "insert-mode-print",
  description: "ANSI insert mode should cause printable characters to push the row content right.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["ABCD\u001b[3D\u001b[4hZ"],
  chunkModes: ["fixture", "joined", "byte"]
};
