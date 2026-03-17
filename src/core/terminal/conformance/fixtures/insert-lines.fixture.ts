import type { RetroLcdTerminalFixture } from "../types";

export const insertLinesFixture: RetroLcdTerminalFixture = {
  name: "insert-lines",
  description: "CSI L should insert blank lines within the active scroll region only.",
  classification: "implemented",
  rows: 5,
  cols: 6,
  chunks: ["1\n2\n3\n4\u001b[2;4r\u001b[3;1H\u001b[L"],
  chunkModes: ["fixture", "joined", "byte"]
};
