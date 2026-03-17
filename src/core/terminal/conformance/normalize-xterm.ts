import { Terminal } from "@xterm/headless";
import type { IBuffer, IBufferCell } from "@xterm/headless";
import type {
  RetroLcdNormalizedCell,
  RetroLcdNormalizedCellStyle,
  RetroLcdNormalizedColor,
  RetroLcdNormalizedTerminalSnapshot
} from "./types";

const DEFAULT_COLOR: RetroLcdNormalizedColor = {
  mode: "default",
  value: 0
};

const normalizeColor = (cell: IBufferCell, type: "foreground" | "background"): RetroLcdNormalizedColor => {
  const isDefault = type === "foreground" ? cell.isFgDefault() : cell.isBgDefault();
  if (isDefault) {
    return DEFAULT_COLOR;
  }

  const isPalette = type === "foreground" ? cell.isFgPalette() : cell.isBgPalette();
  if (isPalette) {
    return {
      mode: "palette",
      value: type === "foreground" ? cell.getFgColor() : cell.getBgColor()
    };
  }

  const isRgb = type === "foreground" ? cell.isFgRGB() : cell.isBgRGB();
  if (isRgb) {
    return {
      mode: "rgb",
      value: type === "foreground" ? cell.getFgColor() : cell.getBgColor()
    };
  }

  return DEFAULT_COLOR;
};

const normalizeCellStyle = (cell: IBufferCell): RetroLcdNormalizedCellStyle => ({
  bold: Boolean(cell.isBold()),
  faint: Boolean(cell.isDim()),
  inverse: Boolean(cell.isInverse()),
  conceal: Boolean(cell.isInvisible()),
  blink: Boolean(cell.isBlink()),
  foreground: normalizeColor(cell, "foreground"),
  background: normalizeColor(cell, "background")
});

const normalizeCell = (cell: IBufferCell): RetroLcdNormalizedCell => ({
  char: cell.getChars() || " ",
  width: cell.getWidth() || 1,
  style: normalizeCellStyle(cell)
});

const getLineString = (buffer: IBuffer, y: number, trimRight: boolean) =>
  buffer.getLine(y)?.translateToString(trimRight, 0, buffer.getLine(y)?.length ?? 0) ?? "";

const getRawLineString = (buffer: IBuffer, y: number, cols: number) =>
  buffer.getLine(y)?.translateToString(false, 0, cols) ?? "".padEnd(cols, " ");

const getWrappedFlag = (buffer: IBuffer, y: number) => buffer.getLine(y)?.isWrapped ?? false;

const getNormalizedCells = (buffer: IBuffer, y: number, cols: number) => {
  const line = buffer.getLine(y);
  const scratch = buffer.getNullCell();

  return Array.from({ length: cols }, (_, colIndex) => {
    const nextCell = line?.getCell(colIndex, scratch);
    return normalizeCell(nextCell ?? scratch);
  });
};

export const normalizeXtermSnapshot = (
  terminal: Terminal
): RetroLcdNormalizedTerminalSnapshot => {
  const buffer = terminal.buffer.active;
  const visibleLineIndices = Array.from({ length: terminal.rows }, (_, rowIndex) => buffer.viewportY + rowIndex);
  const scrollbackIndices = Array.from({ length: buffer.baseY }, (_, index) => index);

  return {
    source: "xterm-headless",
    rows: terminal.rows,
    cols: terminal.cols,
    viewportY: buffer.viewportY,
    baseY: buffer.baseY,
    lines: visibleLineIndices.map((index) => getLineString(buffer, index, true)),
    rawLines: visibleLineIndices.map((index) => getRawLineString(buffer, index, terminal.cols)),
    wrapped: visibleLineIndices.map((index) => getWrappedFlag(buffer, index)),
    cells: visibleLineIndices.map((index) => getNormalizedCells(buffer, index, terminal.cols)),
    scrollback: scrollbackIndices.map((index) => getLineString(buffer, index, true)),
    cursor: {
      row: buffer.cursorY,
      col: buffer.cursorX,
      visible: null
    },
    pendingWrap: terminal.modes.wraparoundMode && buffer.cursorX === terminal.cols,
    modes: {
      insertMode: terminal.modes.insertMode,
      originMode: terminal.modes.originMode,
      wraparoundMode: terminal.modes.wraparoundMode
    }
  };
};
