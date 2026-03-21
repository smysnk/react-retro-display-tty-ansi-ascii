import type { CSSProperties } from "react";
import type { RetroLcdTextSelection } from "./editor/selection";
import type { RetroLcdScreenSnapshot, RetroLcdWriteOptions } from "./terminal/types";
import type { RetroLcdTerminalHostKeyEvent } from "./terminal/host-adapter";
import type { RetroLcdTerminalMouseEvent } from "./terminal/mouse-encoder";
import type {
  RetroLcdTerminalSession,
  RetroLcdTerminalSessionEvent,
  RetroLcdTerminalSessionState
} from "./terminal/session-types";

export type CursorMode = "solid" | "hollow";
export type RetroLcdGridMode = "auto" | "static";
export type RetroLcdDisplaySurfaceMode = "dark" | "light";
export type RetroLcdResizeMode = "width" | "height" | "both";
export type RetroLcdDisplayPaddingValue = number | string;
export type RetroLcdDisplayPadding =
  | RetroLcdDisplayPaddingValue
  | {
      block?: RetroLcdDisplayPaddingValue;
      inline?: RetroLcdDisplayPaddingValue;
      top?: RetroLcdDisplayPaddingValue;
      right?: RetroLcdDisplayPaddingValue;
      bottom?: RetroLcdDisplayPaddingValue;
      left?: RetroLcdDisplayPaddingValue;
    };

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
  fontSize: number;
};

export type RetroLcdSharedProps = {
  color?: string;
  displayColorMode?: RetroLcdDisplayColorMode;
  displaySurfaceMode?: RetroLcdDisplaySurfaceMode;
  displayPadding?: RetroLcdDisplayPadding;
  displayFontScale?: number;
  displayRowScale?: number;
  resizable?: boolean | RetroLcdResizeMode;
  resizableLeadingEdges?: boolean;
  cursorMode?: CursorMode;
  gridMode?: RetroLcdGridMode;
  rows?: number;
  cols?: number;
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onGeometryChange?: (geometry: RetroLcdGeometry) => void;
};

export type RetroLcdController = {
  write: (data: string, options?: RetroLcdWriteOptions) => void;
  writeMany: (chunks: readonly RetroLcdWriteChunk[]) => void;
  writeln: (line: string) => void;
  clear: () => void;
  reset: () => void;
  batch: <T>(fn: () => T) => T;
  suspendNotifications: () => void;
  resumeNotifications: () => void;
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

export type RetroLcdEditorModeProps = RetroLcdSharedProps & {
  mode: "editor";
  value: string;
  editable?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSelectionChange?: (selection: RetroLcdTextSelection | null) => void;
};

export type RetroLcdTerminalModeProps = RetroLcdSharedProps & {
  mode: "terminal";
  value?: string;
  initialBuffer?: string;
  controller?: RetroLcdController;
  session?: RetroLcdTerminalSession;
  closeSessionOnUnmount?: boolean;
  bufferSize?: number;
  defaultAutoFollow?: boolean;
  captureKeyboard?: boolean;
  captureMouse?: boolean;
  capturePaste?: boolean;
  captureFocusReport?: boolean;
  terminalFocusable?: boolean;
  localScrollbackWhenMouseActive?: boolean;
  onSessionEvent?: (event: RetroLcdTerminalSessionEvent) => void;
  onSessionStateChange?: (state: RetroLcdTerminalSessionState) => void;
  onTerminalData?: (data: string | Uint8Array) => void;
  onTerminalKeyDown?: (event: RetroLcdTerminalHostKeyEvent) => void;
  onTerminalKeyUp?: (event: RetroLcdTerminalHostKeyEvent) => void;
  onTerminalMouse?: (event: RetroLcdTerminalMouseEvent & { encodedData: string }) => void;
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
  bufferSize?: number;
  defaultAutoFollow?: boolean;
  onCommand?: (
    command: string
  ) => RetroLcdPromptCommandResult | Promise<RetroLcdPromptCommandResult>;
};

export type RetroLcdProps =
  | RetroLcdValueModeProps
  | RetroLcdEditorModeProps
  | RetroLcdTerminalModeProps
  | RetroLcdPromptModeProps;

export type RetroLcdWriteChunk =
  | string
  | {
      data: string;
      options?: RetroLcdWriteOptions;
    };
