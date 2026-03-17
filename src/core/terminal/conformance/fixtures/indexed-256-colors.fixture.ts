import type { RetroLcdTerminalFixture } from "../types";

export const indexed256ColorsFixture: RetroLcdTerminalFixture = {
  name: "indexed-256-colors",
  description:
    "Extended indexed SGR colors should preserve their 256-color palette indices in the terminal snapshot.",
  classification: "implemented",
  rows: 2,
  cols: 8,
  chunks: ["\u001b[38;5;196;48;5;25mA\u001b[0m"],
  chunkModes: ["fixture", "joined", "byte"]
};
