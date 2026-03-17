export type RetroLcdCsiIdentifier = {
  prefix?: string;
  intermediates?: string;
  final: string;
};

export type RetroLcdEscapeIdentifier = {
  intermediates?: string;
  final: string;
};

export type RetroLcdModeChangeCommand = {
  type: "setMode" | "resetMode";
  identifier: RetroLcdCsiIdentifier;
  params: number[];
};

export type RetroLcdTerminalCommand =
  | { type: "print"; char: string }
  | { type: "lineFeed" }
  | { type: "carriageReturn" }
  | { type: "backspace" }
  | { type: "tab" }
  | { type: "formFeed" }
  | { type: "bell" }
  | { type: "cursorUp"; count: number }
  | { type: "cursorDown"; count: number }
  | { type: "cursorForward"; count: number }
  | { type: "cursorBackward"; count: number }
  | { type: "cursorPosition"; row: number; col: number }
  | { type: "insertChars"; count: number }
  | { type: "deleteChars"; count: number }
  | { type: "insertLines"; count: number }
  | { type: "deleteLines"; count: number }
  | { type: "scrollUp"; count: number }
  | { type: "scrollDown"; count: number }
  | { type: "setScrollRegion"; top?: number; bottom?: number }
  | { type: "eraseInDisplay"; mode: number }
  | { type: "eraseInLine"; mode: number }
  | { type: "saveCursor"; source: "ansi" | "dec" }
  | { type: "restoreCursor"; source: "ansi" | "dec" }
  | { type: "setGraphicRendition"; params: number[] }
  | { type: "index" }
  | { type: "nextLine" }
  | { type: "reverseIndex" }
  | { type: "resetToInitialState" }
  | RetroLcdModeChangeCommand
  | { type: "unknownEscape"; identifier: RetroLcdEscapeIdentifier }
  | { type: "unknownCsi"; identifier: RetroLcdCsiIdentifier; params: number[] };
