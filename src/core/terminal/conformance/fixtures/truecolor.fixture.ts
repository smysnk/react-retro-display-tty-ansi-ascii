import type { RetroLcdTerminalFixture } from "../types";

export const truecolorFixture: RetroLcdTerminalFixture = {
  name: "truecolor",
  description:
    "Truecolor SGR sequences should preserve 24-bit RGB foreground and background values.",
  classification: "implemented",
  rows: 2,
  cols: 8,
  chunks: ["\u001b[38;2;17;34;51;48;2;68;85;102mT\u001b[0m"],
  chunkModes: ["fixture", "joined", "byte"]
};
