import type { RetroLcdTerminalFixture } from "../types";

export const scrollRegionShiftFixture: RetroLcdTerminalFixture = {
  name: "scroll-region-shift",
  description: "CSI S and CSI T should shift only the active scroll region upward and downward.",
  classification: "implemented",
  rows: 5,
  cols: 6,
  chunks: ["1\n2\n3\n4\u001b[2;4r\u001b[2;1H\u001b[S\u001b[T"],
  chunkModes: ["fixture", "joined", "byte"]
};
