export type RetroLcdConformanceClassification =
  | "implemented"
  | "intentionally-ignored"
  | "host-only"
  | "deferred";

export type RetroLcdConformanceChunkMode = "fixture" | "joined" | "byte" | "random";

export type RetroLcdNormalizedColor =
  | {
      mode: "default";
      value: 0;
    }
  | {
      mode: "palette";
      value: number;
    }
  | {
      mode: "rgb";
      value: number;
    };

export type RetroLcdNormalizedCellStyle = {
  bold: boolean;
  faint: boolean;
  inverse: boolean;
  conceal: boolean;
  blink: boolean;
  foreground: RetroLcdNormalizedColor;
  background: RetroLcdNormalizedColor;
};

export type RetroLcdNormalizedCell = {
  char: string;
  width: number;
  style: RetroLcdNormalizedCellStyle;
};

export type RetroLcdNormalizedCursorState = {
  row: number;
  col: number;
  visible: boolean | null;
};

export type RetroLcdNormalizedModes = {
  insertMode: boolean | null;
  originMode: boolean | null;
  wraparoundMode: boolean | null;
};

export type RetroLcdNormalizedTerminalSnapshot = {
  source: "retro-lcd" | "xterm-headless";
  rows: number;
  cols: number;
  viewportY: number;
  baseY: number;
  lines: string[];
  rawLines: string[];
  wrapped: boolean[];
  cells: RetroLcdNormalizedCell[][];
  scrollback: string[];
  cursor: RetroLcdNormalizedCursorState;
  pendingWrap: boolean | null;
  modes: RetroLcdNormalizedModes;
};

export type RetroLcdTerminalFixture = {
  name: string;
  description: string;
  classification: RetroLcdConformanceClassification;
  rows: number;
  cols: number;
  scrollback?: number;
  chunks: string[];
  chunkModes?: RetroLcdConformanceChunkMode[];
  randomChunkSeeds?: number[];
};

export type RetroLcdFixtureRunResult = {
  chunkMode: RetroLcdConformanceChunkMode;
  chunkLabel: string;
  randomSeed?: number;
  resolvedChunks: string[];
  reproduction: string;
  fixture: RetroLcdTerminalFixture;
  retroLcd: RetroLcdNormalizedTerminalSnapshot;
  xterm: RetroLcdNormalizedTerminalSnapshot;
  diffs: string[];
};
