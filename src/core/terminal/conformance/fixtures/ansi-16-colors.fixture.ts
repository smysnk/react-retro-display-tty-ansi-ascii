import type { RetroLcdTerminalFixture } from "../types";

export const ansi16ColorsFixture: RetroLcdTerminalFixture = {
  name: "ansi-16-colors",
  description:
    "ANSI 16-color SGR sequences should preserve semantic foreground and background palette indices.",
  classification: "implemented",
  rows: 2,
  cols: 8,
  chunks: ["\u001b[31;44mA\u001b[39;49mB\u001b[91;102mC"],
  chunkModes: ["fixture", "joined", "byte"]
};
