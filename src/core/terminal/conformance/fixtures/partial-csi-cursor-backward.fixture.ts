import type { RetroLcdTerminalFixture } from "../types";

export const partialCsiCursorBackwardFixture: RetroLcdTerminalFixture = {
  name: "partial-csi-cursor-backward",
  description: "A split CSI cursor-backward sequence should resolve to the same final screen state as xterm.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["AB", "\u001b[", "2D", "Z"],
  chunkModes: ["fixture", "joined", "byte"]
};
