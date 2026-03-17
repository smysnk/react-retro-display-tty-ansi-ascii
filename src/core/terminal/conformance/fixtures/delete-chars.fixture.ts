import type { RetroLcdTerminalFixture } from "../types";

export const deleteCharsFixture: RetroLcdTerminalFixture = {
  name: "delete-chars",
  description: "CSI P should delete characters at the cursor and pull the remainder of the row left.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["ABCDE\u001b[3D\u001b[P"],
  chunkModes: ["fixture", "joined", "byte"]
};
