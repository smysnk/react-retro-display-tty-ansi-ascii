import type { RetroLcdScreenSnapshot, RetroLcdCell } from "../types";
import type {
  RetroLcdNormalizedCell,
  RetroLcdNormalizedCellStyle,
  RetroLcdNormalizedTerminalSnapshot
} from "./types";

const DEFAULT_COLOR = {
  mode: "default" as const,
  value: 0
};

const normalizeCellStyle = (cell: RetroLcdCell): RetroLcdNormalizedCellStyle => ({
  bold: cell.style.intensity === "bold",
  faint: cell.style.intensity === "faint",
  inverse: cell.style.inverse,
  conceal: cell.style.conceal,
  blink: cell.style.blink,
  foreground:
    cell.style.foreground.mode === "default" ? DEFAULT_COLOR : { ...cell.style.foreground },
  background:
    cell.style.background.mode === "default" ? DEFAULT_COLOR : { ...cell.style.background }
});

const normalizeCell = (cell: RetroLcdCell): RetroLcdNormalizedCell => ({
  char: cell.char,
  width: 1,
  style: normalizeCellStyle(cell)
});

export const normalizeRetroLcdSnapshot = (
  snapshot: RetroLcdScreenSnapshot
): RetroLcdNormalizedTerminalSnapshot => ({
  source: "retro-lcd",
  rows: snapshot.rows,
  cols: snapshot.cols,
  viewportY: 0,
  baseY: snapshot.scrollback.length,
  lines: [...snapshot.lines],
  rawLines: [...snapshot.rawLines],
  wrapped: Array.from({ length: snapshot.rows }, () => false),
  cells: snapshot.cells.map((line) => line.map((cell) => normalizeCell(cell))),
  scrollback: [...snapshot.scrollback],
  cursor: {
    row: snapshot.cursor.row,
    col: snapshot.cursor.col,
    visible: snapshot.cursor.visible
  },
  pendingWrap: snapshot.pendingWrap,
  modes: {
    insertMode: snapshot.modes.insertMode,
    originMode: snapshot.modes.originMode,
    wraparoundMode: snapshot.modes.wraparoundMode
  }
});
