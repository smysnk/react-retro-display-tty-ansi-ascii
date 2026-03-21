import type { CursorMode } from "../types";

export type RetroLcdCellIntensity = "normal" | "bold" | "faint";

export type RetroLcdTerminalColor =
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

export type RetroLcdCellStyle = {
  intensity: RetroLcdCellIntensity;
  bold: boolean;
  faint: boolean;
  inverse: boolean;
  conceal: boolean;
  blink: boolean;
  foreground: RetroLcdTerminalColor;
  background: RetroLcdTerminalColor;
};

export type RetroLcdCell = {
  char: string;
  style: RetroLcdCellStyle;
};

export type RetroLcdCursorState = {
  row: number;
  col: number;
  visible: boolean;
  mode: CursorMode;
};

export type RetroLcdTerminalMouseTrackingMode = "none" | "vt200" | "drag" | "any";
export type RetroLcdTerminalMouseProtocol = "none" | "sgr";

export type RetroLcdTerminalModes = {
  insertMode: boolean;
  originMode: boolean;
  wraparoundMode: boolean;
  applicationCursorKeysMode: boolean;
  bracketedPasteMode: boolean;
  focusReportingMode: boolean;
  alternateScreenBufferMode: boolean;
  mouseTrackingMode: RetroLcdTerminalMouseTrackingMode;
  mouseProtocol: RetroLcdTerminalMouseProtocol;
};

export type RetroLcdScreenBufferOptions = {
  rows: number;
  cols: number;
  scrollback?: number;
  tabWidth?: number;
  cursorMode?: CursorMode;
};

export type RetroLcdScreenSnapshot = {
  rows: number;
  cols: number;
  lines: string[];
  rawLines: string[];
  cells: RetroLcdCell[][];
  scrollback: string[];
  scrollbackCells: RetroLcdCell[][];
  cursor: RetroLcdCursorState;
  pendingWrap: boolean;
  modes: RetroLcdTerminalModes;
};

export type RetroLcdWriteOptions = {
  appendNewline?: boolean;
};
