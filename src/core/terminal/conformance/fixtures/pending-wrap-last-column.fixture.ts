import type { RetroLcdTerminalFixture } from "../types";

export const pendingWrapLastColumnFixture: RetroLcdTerminalFixture = {
  name: "pending-wrap-last-column",
  description: "Writing into the final column should leave the cursor in the pending-wrap state until the next printable arrives.",
  classification: "implemented",
  rows: 2,
  cols: 4,
  chunks: ["ABCD"],
  chunkModes: ["fixture", "joined", "byte"]
};
