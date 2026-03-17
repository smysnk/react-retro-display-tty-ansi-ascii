import type { RetroLcdTerminalFixture } from "../types";

export const insertCharsFixture: RetroLcdTerminalFixture = {
  name: "insert-chars",
  description: "CSI @ should insert blank cells at the cursor and shift the row content right.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["ABCDE\u001b[3D\u001b[@Z"],
  chunkModes: ["fixture", "joined", "byte"]
};
