import { RetroLcdAnsiParser } from "./ansi-parser";
import type { RetroLcdTerminalCommand } from "./commands";
import {
  applySgrParameters,
  cloneStyle,
  DEFAULT_CELL_STYLE
} from "./sgr";
import type { CursorMode } from "../types";
import type {
  RetroLcdCell,
  RetroLcdCellStyle,
  RetroLcdCursorState,
  RetroLcdTerminalModes,
  RetroLcdScreenBufferOptions,
  RetroLcdScreenSnapshot,
  RetroLcdWriteOptions
} from "./types";

const clampDimension = (value: number) => Math.max(1, Math.floor(value) || 1);

const createCell = (character: string, style: RetroLcdCellStyle): RetroLcdCell => ({
  char: character,
  style: cloneStyle(style)
});

const cloneCell = (cell: RetroLcdCell): RetroLcdCell => createCell(cell.char, cell.style);

const createBlankLine = (cols: number, style: RetroLcdCellStyle = DEFAULT_CELL_STYLE) =>
  Array.from({ length: cols }, () => createCell(" ", style));

const trimLine = (line: RetroLcdCell[]) =>
  line
    .map((cell) => cell.char)
    .join("")
    .replace(/\s+$/u, "");

const cloneGrid = (grid: RetroLcdCell[][]) =>
  grid.map((line) => line.map((cell) => createCell(cell.char, cell.style)));

const defaultSavedCursor = () => ({
  row: 0,
  col: 0
});

const DEFAULT_TERMINAL_MODES: RetroLcdTerminalModes = {
  insertMode: false,
  originMode: false,
  wraparoundMode: true
};

export class RetroLcdScreenBuffer {
  readonly rows: number;
  readonly cols: number;
  readonly scrollbackLimit: number;
  readonly tabWidth: number;
  private readonly grid: RetroLcdCell[][];
  private readonly scrollbackLines: string[] = [];
  private readonly parser: RetroLcdAnsiParser;
  private cursorState: RetroLcdCursorState;
  private savedCursorState = defaultSavedCursor();
  private currentStyle: RetroLcdCellStyle = cloneStyle(DEFAULT_CELL_STYLE);
  private terminalModes: RetroLcdTerminalModes = { ...DEFAULT_TERMINAL_MODES };
  private pendingWrap = false;
  private scrollRegionTop = 0;
  private scrollRegionBottom: number;

  constructor(options: RetroLcdScreenBufferOptions) {
    this.rows = clampDimension(options.rows);
    this.cols = clampDimension(options.cols);
    this.scrollbackLimit = Math.max(0, Math.floor(options.scrollback ?? 200));
    this.tabWidth = Math.max(1, Math.floor(options.tabWidth ?? 4));
    this.grid = Array.from({ length: this.rows }, () => createBlankLine(this.cols));
    this.scrollRegionBottom = this.rows - 1;
    this.cursorState = {
      row: 0,
      col: 0,
      visible: true,
      mode: options.cursorMode ?? "solid"
    };
    this.parser = new RetroLcdAnsiParser({
      command: (command) => this.applyCommand(command)
    });
  }

  clear() {
    for (let row = 0; row < this.rows; row += 1) {
      this.grid[row] = createBlankLine(this.cols, this.currentStyle);
    }

    this.cursorState = {
      ...this.cursorState,
      row: 0,
      col: 0
    };
    this.pendingWrap = false;
  }

  reset() {
    this.clear();
    this.scrollbackLines.length = 0;
    this.currentStyle = cloneStyle(DEFAULT_CELL_STYLE);
    this.savedCursorState = defaultSavedCursor();
    this.terminalModes = { ...DEFAULT_TERMINAL_MODES };
    this.scrollRegionTop = 0;
    this.scrollRegionBottom = this.rows - 1;
    this.pendingWrap = false;
    this.cursorState = {
      row: 0,
      col: 0,
      visible: true,
      mode: "solid"
    };
    this.parser.reset();
  }

  write(data: string, options?: RetroLcdWriteOptions) {
    this.parser.feed(data);

    if (options?.appendNewline) {
      this.carriageReturn();
      this.lineFeed();
    }
  }

  writeln(line: string) {
    this.write(line);
    this.carriageReturn();
    this.lineFeed();
  }

  moveCursorTo(row: number, col: number) {
    this.cursorState.row = Math.min(this.rows - 1, Math.max(0, Math.floor(row)));
    this.cursorState.col = Math.min(this.cols - 1, Math.max(0, Math.floor(col)));
  }

  setCursorVisible(visible: boolean) {
    this.cursorState.visible = visible;
  }

  setCursorMode(mode: CursorMode) {
    this.cursorState.mode = mode;
  }

  getCursor() {
    return { ...this.cursorState };
  }

  getSnapshot(): RetroLcdScreenSnapshot {
    const cells = cloneGrid(this.grid);
    const rawLines = cells.map((line) => line.map((cell) => cell.char).join(""));

    return {
      rows: this.rows,
      cols: this.cols,
      rawLines,
      cells,
      lines: rawLines.map((line) => line.replace(/\s+$/u, "")),
      scrollback: [...this.scrollbackLines],
      cursor: this.getCursor(),
      pendingWrap: this.pendingWrap,
      modes: { ...this.terminalModes }
    };
  }

  private applyCommand(command: RetroLcdTerminalCommand) {
    switch (command.type) {
      case "print":
        this.writePrintable(command.char);
        return;
      case "lineFeed":
        this.lineFeed();
        return;
      case "carriageReturn":
        this.carriageReturn();
        return;
      case "backspace":
        this.backspace();
        return;
      case "tab":
        this.insertTab();
        return;
      case "formFeed":
        this.clear();
        return;
      case "bell":
        return;
      case "cursorUp":
        this.cursorUp(command.count);
        return;
      case "cursorDown":
        this.cursorDown(command.count);
        return;
      case "cursorForward":
        this.cursorForward(command.count);
        return;
      case "cursorBackward":
        this.cursorBackward(command.count);
        return;
      case "cursorPosition":
        this.cursorPosition(command.row, command.col);
        return;
      case "insertChars":
        this.insertChars(command.count);
        return;
      case "deleteChars":
        this.deleteChars(command.count);
        return;
      case "insertLines":
        this.insertLines(command.count);
        return;
      case "deleteLines":
        this.deleteLines(command.count);
        return;
      case "scrollUp":
        this.scrollUp(command.count);
        return;
      case "scrollDown":
        this.scrollDown(command.count);
        return;
      case "setScrollRegion":
        this.setScrollRegion(command.top, command.bottom);
        return;
      case "eraseInDisplay":
        this.eraseInDisplay(command.mode);
        return;
      case "eraseInLine":
        this.eraseInLine(command.mode);
        return;
      case "saveCursor":
        this.saveCursor();
        return;
      case "restoreCursor":
        this.restoreCursor();
        return;
      case "setGraphicRendition":
        this.setGraphicRendition(command.params);
        return;
      case "index":
        this.index();
        return;
      case "nextLine":
        this.nextLine();
        return;
      case "reverseIndex":
        this.reverseIndex();
        return;
      case "resetToInitialState":
        this.reset();
        return;
      case "setMode":
        this.setMode(command.identifier.prefix, command.params, true);
        return;
      case "resetMode":
        this.setMode(command.identifier.prefix, command.params, false);
        return;
      case "unknownEscape":
      case "unknownCsi":
        return;
    }
  }

  private writePrintable(character: string) {
    this.prepareCursorForPrint();

    const targetCol =
      this.cursorState.col >= this.cols ? this.cols - 1 : Math.max(0, this.cursorState.col);

    if (this.terminalModes.insertMode) {
      this.insertBlankCells(this.cursorState.row, targetCol, 1);
    }

    this.grid[this.cursorState.row][targetCol] = createCell(character, this.currentStyle);

    if (targetCol === this.cols - 1) {
      this.cursorState.col = this.cols;
      this.pendingWrap = this.terminalModes.wraparoundMode;
      return;
    }

    this.cursorState.col = targetCol + 1;
    this.pendingWrap = false;
  }

  private insertTab() {
    const spaces = this.tabWidth - (this.cursorState.col % this.tabWidth || 0);

    for (let index = 0; index < spaces; index += 1) {
      this.writePrintable(" ");
    }
  }

  private carriageReturn() {
    this.pendingWrap = false;
    this.cursorState.col = 0;
  }

  private cursorUp(count: number) {
    this.normalizeCursorForMovement();
    this.cursorState.row = Math.max(0, this.cursorState.row - Math.max(1, count));
  }

  private cursorDown(count: number) {
    this.normalizeCursorForMovement();
    this.cursorState.row = Math.min(this.rows - 1, this.cursorState.row + Math.max(1, count));
  }

  private cursorForward(count: number) {
    this.normalizeCursorForMovement();
    this.cursorState.col = Math.min(this.cols - 1, this.cursorState.col + Math.max(1, count));
  }

  private cursorBackward(count: number) {
    this.normalizeCursorForMovement();
    this.cursorState.col = Math.max(0, this.cursorState.col - Math.max(1, count));
  }

  private cursorPosition(row: number, col: number) {
    this.pendingWrap = false;
    const targetRow = Math.max(1, row);
    const targetCol = Math.max(1, col);
    const resolvedRow = this.terminalModes.originMode
      ? Math.min(
          this.scrollRegionBottom,
          Math.max(this.scrollRegionTop, this.scrollRegionTop + targetRow - 1)
        )
      : Math.min(this.rows - 1, Math.max(0, targetRow - 1));

    this.moveCursorTo(resolvedRow, Math.min(this.cols - 1, Math.max(0, targetCol - 1)));
  }

  private insertChars(count: number) {
    this.normalizeCursorForMovement();
    this.insertBlankCells(this.cursorState.row, this.cursorState.col, count);
  }

  private deleteChars(count: number) {
    this.normalizeCursorForMovement();
    this.deleteCells(this.cursorState.row, this.cursorState.col, count);
  }

  private insertLines(count: number) {
    this.normalizeCursorForMovement();
    if (!this.isCursorWithinScrollRegion()) {
      return;
    }

    this.shiftLinesDown(this.cursorState.row, this.scrollRegionBottom, count);
  }

  private deleteLines(count: number) {
    this.normalizeCursorForMovement();
    if (!this.isCursorWithinScrollRegion()) {
      return;
    }

    this.shiftLinesUp(this.cursorState.row, this.scrollRegionBottom, count);
  }

  private scrollUp(count: number) {
    this.normalizeCursorForMovement();
    this.shiftLinesUp(this.scrollRegionTop, this.scrollRegionBottom, count);
  }

  private scrollDown(count: number) {
    this.normalizeCursorForMovement();
    this.shiftLinesDown(this.scrollRegionTop, this.scrollRegionBottom, count);
  }

  private setScrollRegion(top?: number, bottom?: number) {
    const nextTop = Math.max(1, Math.floor(top ?? 1));
    const nextBottom = Math.max(1, Math.floor(bottom ?? this.rows));
    const isValid = nextTop < nextBottom && nextBottom <= this.rows;

    this.scrollRegionTop = isValid ? nextTop - 1 : 0;
    this.scrollRegionBottom = isValid ? nextBottom - 1 : this.rows - 1;
    this.pendingWrap = false;
    this.moveCursorHome();
  }

  private lineFeed() {
    if (this.pendingWrap || this.cursorState.col >= this.cols) {
      this.cursorState.col = Math.max(0, this.cols - 1);
      this.pendingWrap = false;
    }

    if (this.isCursorWithinScrollRegion()) {
      if (this.cursorState.row === this.scrollRegionBottom) {
        this.shiftLinesUp(this.scrollRegionTop, this.scrollRegionBottom, 1, {
          captureScrollback:
            this.scrollRegionTop === 0 && this.scrollRegionBottom === this.rows - 1
        });
        return;
      }

      this.cursorState.row += 1;
      return;
    }

    if (this.cursorState.row < this.rows - 1) {
      this.cursorState.row += 1;
      return;
    }
  }

  private backspace() {
    if (this.pendingWrap || this.cursorState.col >= this.cols) {
      this.pendingWrap = false;
      this.cursorState.col = Math.max(0, this.cols - 2);
      return;
    }

    if (this.cursorState.col > 0) {
      this.cursorState.col -= 1;
    }
  }

  private eraseInLine(mode: number) {
    const row = this.cursorState.row;

    switch (mode) {
      case 1:
        for (let col = 0; col <= this.cursorState.col; col += 1) {
          this.grid[row][col] = createCell(" ", this.currentStyle);
        }
        return;
      case 2:
        this.grid[row] = createBlankLine(this.cols, this.currentStyle);
        return;
      default:
        for (let col = this.cursorState.col; col < this.cols; col += 1) {
          this.grid[row][col] = createCell(" ", this.currentStyle);
        }
    }
  }

  private eraseInDisplay(mode: number) {
    switch (mode) {
      case 1:
        for (let row = 0; row < this.cursorState.row; row += 1) {
          this.grid[row] = createBlankLine(this.cols, this.currentStyle);
        }
        for (let col = 0; col <= this.cursorState.col; col += 1) {
          this.grid[this.cursorState.row][col] = createCell(" ", this.currentStyle);
        }
        return;
      case 2:
        for (let row = 0; row < this.rows; row += 1) {
          this.grid[row] = createBlankLine(this.cols, this.currentStyle);
        }
        return;
      case 3:
        this.eraseInDisplay(2);
        this.scrollbackLines.length = 0;
        return;
      default:
        for (let col = this.cursorState.col; col < this.cols; col += 1) {
          this.grid[this.cursorState.row][col] = createCell(" ", this.currentStyle);
        }
        for (let row = this.cursorState.row + 1; row < this.rows; row += 1) {
          this.grid[row] = createBlankLine(this.cols, this.currentStyle);
        }
    }
  }

  private saveCursor() {
    this.savedCursorState = {
      row: this.cursorState.row,
      col: this.cursorState.col
    };
  }

  private restoreCursor() {
    this.pendingWrap = false;
    this.cursorState.row = Math.min(this.rows - 1, Math.max(0, Math.floor(this.savedCursorState.row)));
    this.cursorState.col = Math.min(this.cols, Math.max(0, Math.floor(this.savedCursorState.col)));
  }

  private setGraphicRendition(params: number[]) {
    this.currentStyle = applySgrParameters(this.currentStyle, params);
  }

  private index() {
    if (this.pendingWrap || this.cursorState.col >= this.cols) {
      this.cursorState.col = Math.max(0, this.cols - 1);
      this.pendingWrap = false;
    }

    if (!this.isCursorWithinScrollRegion()) {
      return;
    }

    if (this.cursorState.row === this.scrollRegionBottom) {
      this.shiftLinesUp(this.scrollRegionTop, this.scrollRegionBottom, 1);
      return;
    }

    this.cursorState.row += 1;
  }

  private nextLine() {
    this.carriageReturn();
    this.lineFeed();
  }

  private reverseIndex() {
    if (this.pendingWrap || this.cursorState.col >= this.cols) {
      this.cursorState.col = Math.max(0, this.cols - 1);
      this.pendingWrap = false;
    }

    if (!this.isCursorWithinScrollRegion()) {
      return;
    }

    if (this.cursorState.row === this.scrollRegionTop) {
      this.shiftLinesDown(this.scrollRegionTop, this.scrollRegionBottom, 1);
      return;
    }

    this.cursorState.row -= 1;
  }

  private setMode(prefix: string | undefined, params: number[], enabled: boolean) {
    const values = params.length > 0 ? params : [0];

    for (const value of values) {
      if (prefix === "?") {
        switch (value) {
          case 6:
            this.terminalModes.originMode = enabled;
            this.pendingWrap = false;
            this.moveCursorHome();
            break;
          case 7:
            this.terminalModes.wraparoundMode = enabled;
            if (!enabled) {
              this.pendingWrap = false;
            }
            break;
          case 25:
            this.setCursorVisible(enabled);
            break;
          default:
            break;
        }

        continue;
      }

      switch (value) {
        case 4:
          this.terminalModes.insertMode = enabled;
          break;
        default:
          break;
      }
    }
  }

  private prepareCursorForPrint() {
    if (this.pendingWrap) {
      this.carriageReturn();
      this.lineFeed();
      this.pendingWrap = false;
      return;
    }

    if (this.cursorState.col >= this.cols) {
      this.cursorState.col = Math.max(0, this.cols - 1);
    }
  }

  private normalizeCursorForMovement() {
    if (this.pendingWrap || this.cursorState.col >= this.cols) {
      this.cursorState.col = Math.max(0, this.cols - 1);
      this.pendingWrap = false;
    }
  }

  private moveCursorHome() {
    this.cursorState.row = this.terminalModes.originMode ? this.scrollRegionTop : 0;
    this.cursorState.col = 0;
  }

  private isCursorWithinScrollRegion() {
    return (
      this.cursorState.row >= this.scrollRegionTop && this.cursorState.row <= this.scrollRegionBottom
    );
  }

  private insertBlankCells(row: number, col: number, count: number) {
    const shiftCount = Math.min(this.cols - col, Math.max(1, Math.floor(count)));

    if (shiftCount <= 0) {
      return;
    }

    for (let target = this.cols - 1; target >= col + shiftCount; target -= 1) {
      this.grid[row][target] = cloneCell(this.grid[row][target - shiftCount]);
    }

    for (let target = col; target < Math.min(this.cols, col + shiftCount); target += 1) {
      this.grid[row][target] = createCell(" ", this.currentStyle);
    }
  }

  private deleteCells(row: number, col: number, count: number) {
    const shiftCount = Math.min(this.cols - col, Math.max(1, Math.floor(count)));

    if (shiftCount <= 0) {
      return;
    }

    for (let target = col; target < this.cols - shiftCount; target += 1) {
      this.grid[row][target] = cloneCell(this.grid[row][target + shiftCount]);
    }

    for (let target = this.cols - shiftCount; target < this.cols; target += 1) {
      this.grid[row][target] = createCell(" ", this.currentStyle);
    }
  }

  private shiftLinesUp(
    top: number,
    bottom: number,
    count: number,
    options?: { captureScrollback?: boolean }
  ) {
    const shiftCount = Math.min(bottom - top + 1, Math.max(1, Math.floor(count)));

    for (let index = 0; index < shiftCount; index += 1) {
      const shifted = this.grid[top];

      if (options?.captureScrollback) {
        this.scrollbackLines.push(trimLine(shifted));

        if (this.scrollbackLines.length > this.scrollbackLimit) {
          this.scrollbackLines.splice(0, this.scrollbackLines.length - this.scrollbackLimit);
        }
      }

      for (let row = top; row < bottom; row += 1) {
        this.grid[row] = this.grid[row + 1];
      }

      this.grid[bottom] = createBlankLine(this.cols, this.currentStyle);
    }
  }

  private shiftLinesDown(top: number, bottom: number, count: number) {
    const shiftCount = Math.min(bottom - top + 1, Math.max(1, Math.floor(count)));

    for (let index = 0; index < shiftCount; index += 1) {
      for (let row = bottom; row > top; row -= 1) {
        this.grid[row] = this.grid[row - 1];
      }

      this.grid[top] = createBlankLine(this.cols, this.currentStyle);
    }
  }
}
