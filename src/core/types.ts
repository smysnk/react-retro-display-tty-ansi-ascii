import type { CSSProperties } from "react";
import type { RetroScreenTextSelection } from "./editor/selection";
import type { RetroScreenCell, RetroScreenScreenSnapshot, RetroScreenWriteOptions } from "./terminal/types";
import type { RetroScreenTerminalHostKeyEvent } from "./terminal/host-adapter";
import type { RetroScreenTerminalMouseEvent } from "./terminal/mouse-encoder";
import type {
  RetroScreenTerminalSession,
  RetroScreenTerminalSessionEvent,
  RetroScreenTerminalSessionState
} from "./terminal/session-types";

export type CursorMode = "solid" | "hollow";
export type RetroScreenGridMode = "auto" | "static";
export type RetroScreenDisplaySurfaceMode = "dark" | "light";
export type RetroScreenResizeMode = "width" | "height" | "both";
export type RetroScreenDisplayPaddingValue = number | string;
export type RetroScreenDisplayPadding =
  | RetroScreenDisplayPaddingValue
  | {
      block?: RetroScreenDisplayPaddingValue;
      inline?: RetroScreenDisplayPaddingValue;
      top?: RetroScreenDisplayPaddingValue;
      right?: RetroScreenDisplayPaddingValue;
      bottom?: RetroScreenDisplayPaddingValue;
      left?: RetroScreenDisplayPaddingValue;
    };

export type RetroScreenDisplayColorMode =
  | "phosphor-green"
  | "phosphor-amber"
  | "phosphor-ice"
  | "ansi-classic"
  | "ansi-extended";

export type RetroScreenGeometry = {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  innerWidth: number;
  innerHeight: number;
  fontSize: number;
};

export type RetroScreenSharedProps = {
  color?: string;
  displayColorMode?: RetroScreenDisplayColorMode;
  displaySurfaceMode?: RetroScreenDisplaySurfaceMode;
  displayPadding?: RetroScreenDisplayPadding;
  displayFontScale?: number;
  displayRowScale?: number;
  focusGlow?: boolean;
  resizable?: boolean | RetroScreenResizeMode;
  resizableLeadingEdges?: boolean;
  cursorMode?: CursorMode;
  gridMode?: RetroScreenGridMode;
  rows?: number;
  cols?: number;
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onGeometryChange?: (geometry: RetroScreenGeometry) => void;
};

export type RetroScreenController = {
  write: (data: string, options?: RetroScreenWriteOptions) => void;
  writeMany: (chunks: readonly RetroScreenWriteChunk[]) => void;
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
  getSnapshot: () => RetroScreenScreenSnapshot;
  subscribe: (listener: () => void) => () => void;
};

export type RetroScreenValueModeProps = RetroScreenSharedProps & {
  mode: "value";
  value: string;
  cells?: RetroScreenCell[][];
  editable?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
};

export type RetroScreenEditorModeProps = RetroScreenSharedProps & {
  mode: "editor";
  value: string;
  editable?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSelectionChange?: (selection: RetroScreenTextSelection | null) => void;
};

export type RetroScreenTerminalModeProps = RetroScreenSharedProps & {
  mode: "terminal";
  value?: string;
  initialBuffer?: string;
  controller?: RetroScreenController;
  session?: RetroScreenTerminalSession;
  closeSessionOnUnmount?: boolean;
  bufferSize?: number;
  defaultAutoFollow?: boolean;
  captureKeyboard?: boolean;
  captureMouse?: boolean;
  capturePaste?: boolean;
  captureFocusReport?: boolean;
  terminalFocusable?: boolean;
  localScrollbackWhenMouseActive?: boolean;
  onSessionEvent?: (event: RetroScreenTerminalSessionEvent) => void;
  onSessionStateChange?: (state: RetroScreenTerminalSessionState) => void;
  onTerminalData?: (data: string | Uint8Array) => void;
  onTerminalKeyDown?: (event: RetroScreenTerminalHostKeyEvent) => void;
  onTerminalKeyUp?: (event: RetroScreenTerminalHostKeyEvent) => void;
  onTerminalMouse?: (event: RetroScreenTerminalMouseEvent & { encodedData: string }) => void;
};

export type RetroScreenPromptCommandResult =
  | {
      accepted: true;
      response?: string | string[];
    }
  | {
      accepted: false;
      response?: string | string[];
    };

export type RetroScreenPromptModeProps = RetroScreenSharedProps & {
  mode: "prompt";
  value?: string;
  promptChar?: string;
  acceptanceText?: string;
  rejectionText?: string;
  bufferSize?: number;
  defaultAutoFollow?: boolean;
  onCommand?: (
    command: string
  ) => RetroScreenPromptCommandResult | Promise<RetroScreenPromptCommandResult>;
};

export type RetroScreenProps =
  | RetroScreenValueModeProps
  | RetroScreenEditorModeProps
  | RetroScreenTerminalModeProps
  | RetroScreenPromptModeProps;

export type RetroScreenWriteChunk =
  | string
  | {
      data: string;
      options?: RetroScreenWriteOptions;
    };
