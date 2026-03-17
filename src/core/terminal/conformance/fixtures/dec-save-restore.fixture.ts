import type { RetroLcdTerminalFixture } from "../types";

export const decSaveRestoreFixture: RetroLcdTerminalFixture = {
  name: "dec-save-restore",
  description: "ESC 7 and ESC 8 should save and restore the cursor position like a VT-style terminal.",
  classification: "implemented",
  rows: 3,
  cols: 6,
  chunks: ["AB\u001b7\u001b[3;3HZ\u001b8C"],
  chunkModes: ["fixture", "joined", "byte"]
};
