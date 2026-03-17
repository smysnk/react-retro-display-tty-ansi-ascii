import type { CSSProperties } from "react";
import type { RetroLcdScreenSnapshot, RetroLcdWriteOptions } from "./terminal/types";

export type CursorMode = "solid" | "hollow";

export type RetroLcdDisplayColorMode =
  | "phosphor-green"
  | "phosphor-amber"
  | "phosphor-ice"
  | "ansi-classic"
  | "ansi-extended";

export type RetroLcdGeometry = {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  innerWidth: number;
  innerHeight: number;
};

export type RetroLcdSharedProps = {
  color?: string;
  displayColorMode?: RetroLcdDisplayColorMode;
  cursorMode?: CursorMode;
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onGeometryChange?: (geometry: RetroLcdGeometry) => void;
};

export type RetroLcdController = {
  write: (data: string, options?: RetroLcdWriteOptions) => void;
  writeln: (line: string) => void;
  clear: () => void;
  reset: () => void;
  moveCursorTo: (row: number, col: number) => void;
  resize: (rows: number, cols: number) => void;
  setCursorVisible: (visible: boolean) => void;
  setCursorMode: (mode: CursorMode) => void;
  getSnapshot: () => RetroLcdScreenSnapshot;
  subscribe: (listener: () => void) => () => void;
};

export type RetroLcdValueModeProps = RetroLcdSharedProps & {
  mode: "value";
  value: string;
  editable?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
};

export type RetroLcdTerminalModeProps = RetroLcdSharedProps & {
  mode: "terminal";
  value?: string;
  initialBuffer?: string;
  controller?: RetroLcdController;
};

export type RetroLcdPromptCommandResult =
  | {
      accepted: true;
      response?: string | string[];
    }
  | {
      accepted: false;
      response?: string | string[];
    };

export type RetroLcdPromptModeProps = RetroLcdSharedProps & {
  mode: "prompt";
  value?: string;
  promptChar?: string;
  acceptanceText?: string;
  rejectionText?: string;
  onCommand?: (
    command: string
  ) => RetroLcdPromptCommandResult | Promise<RetroLcdPromptCommandResult>;
};

export type RetroLcdProps =
  | RetroLcdValueModeProps
  | RetroLcdTerminalModeProps
  | RetroLcdPromptModeProps;
