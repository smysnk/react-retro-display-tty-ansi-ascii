import type { RetroLcdTerminalFixture } from "../types";

export const lineFeedFixture: RetroLcdTerminalFixture = {
  name: "line-feed",
  description:
    "LF should advance the cursor to the next row without forcing a carriage return.",
  classification: "implemented",
  rows: 3,
  cols: 6,
  chunks: ["AB\nZ"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const carriageReturnFixture: RetroLcdTerminalFixture = {
  name: "carriage-return",
  description: "CR should return to column zero and overwrite from the start of the row.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["AB\rZ"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const tabExpansionFixture: RetroLcdTerminalFixture = {
  name: "tab-expansion",
  description: "HT should advance to the next tab stop using terminal tab spacing.",
  classification: "implemented",
  rows: 1,
  cols: 9,
  chunks: ["A\tB"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const cursorUpFixture: RetroLcdTerminalFixture = {
  name: "cursor-up",
  description: "CSI A should move the cursor upward while preserving the current column.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["ABCD\r\nEF\u001b[1AZ"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const cursorDownFixture: RetroLcdTerminalFixture = {
  name: "cursor-down",
  description: "CSI B should move the cursor downward while preserving the current column.",
  classification: "implemented",
  rows: 3,
  cols: 6,
  chunks: ["AB\u001b[2BZ"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const cursorForwardFixture: RetroLcdTerminalFixture = {
  name: "cursor-forward",
  description: "CSI C should move the cursor forward within the active row.",
  classification: "implemented",
  rows: 1,
  cols: 6,
  chunks: ["AB\u001b[2CZ"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const cursorPositionFixture: RetroLcdTerminalFixture = {
  name: "cursor-position",
  description: "CSI H and CSI f should position the cursor using 1-based row and column values.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["ABCD\u001b[2;2HZ\u001b[1;4fQ"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const eraseInLineFixture: RetroLcdTerminalFixture = {
  name: "erase-in-line",
  description: "CSI K should erase the active row from the cursor through the end of the line.",
  classification: "implemented",
  rows: 1,
  cols: 6,
  chunks: ["HELLO\u001b[1D\u001b[K"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const eraseInDisplayFixture: RetroLcdTerminalFixture = {
  name: "erase-in-display",
  description: "CSI 2J should clear the visible display without changing terminal geometry.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["ABCD\r\nEFGH\u001b[2J"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const ansiSaveRestoreFixture: RetroLcdTerminalFixture = {
  name: "ansi-save-restore",
  description: "CSI s and CSI u should save and restore the current cursor position.",
  classification: "implemented",
  rows: 3,
  cols: 6,
  chunks: ["AB\u001b[s\u001b[3;3HZ\u001b[uC"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const resetToInitialStateFixture: RetroLcdTerminalFixture = {
  name: "reset-to-initial-state",
  description: "ESC c should reset the terminal state and clear the current display.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["AB\u001b[31mC\u001bc"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const sgrAttributesFixture: RetroLcdTerminalFixture = {
  name: "sgr-attributes",
  description:
    "SGR emphasis flags like bold, faint, blink, inverse, and conceal should survive as semantic cell state.",
  classification: "implemented",
  rows: 1,
  cols: 8,
  chunks: ["\u001b[1mA\u001b[2mB\u001b[5mC\u001b[7mD\u001b[8mE\u001b[0mF"],
  chunkModes: ["fixture", "joined", "byte"]
};

export const ansiCommandMatrixFixtures = [
  lineFeedFixture,
  carriageReturnFixture,
  tabExpansionFixture,
  cursorUpFixture,
  cursorDownFixture,
  cursorForwardFixture,
  cursorPositionFixture,
  eraseInLineFixture,
  eraseInDisplayFixture,
  ansiSaveRestoreFixture,
  resetToInitialStateFixture,
  sgrAttributesFixture
] satisfies RetroLcdTerminalFixture[];
