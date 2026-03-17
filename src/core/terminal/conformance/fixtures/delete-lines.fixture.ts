import type { RetroLcdTerminalFixture } from "../types";

export const deleteLinesFixture: RetroLcdTerminalFixture = {
  name: "delete-lines",
  description: "CSI M should delete lines within the active scroll region and pull lines upward.",
  classification: "implemented",
  rows: 5,
  cols: 6,
  chunks: ["1\n2\n3\n4\u001b[2;4r\u001b[3;1H\u001b[M"],
  chunkModes: ["fixture", "joined", "byte"]
};
