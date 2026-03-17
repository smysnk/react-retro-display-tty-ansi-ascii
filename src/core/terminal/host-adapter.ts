export type RetroLcdTerminalHostKeyEvent = {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
};

export type RetroLcdTerminalOutputAdapter = {
  beginFrame: () => void;
  writeAnsi: (data: string) => void;
  setCursor: (row: number, col: number) => void;
  setCursorVisible: (visible: boolean) => void;
  resetScreen: () => void;
  endFrame: () => void;
};

export type RetroLcdTerminalInputAdapter = {
  onKeyDown?: (event: RetroLcdTerminalHostKeyEvent) => void;
  onKeyUp?: (event: RetroLcdTerminalHostKeyEvent) => void;
  focusTerminal?: () => void;
  blurTerminal?: () => void;
  drainInputQueue?: () => readonly string[];
};

export type RetroLcdTerminalHostAdapter = RetroLcdTerminalOutputAdapter & RetroLcdTerminalInputAdapter;
