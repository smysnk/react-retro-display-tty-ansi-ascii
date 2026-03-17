import { wrapTextToColumns } from "../core/geometry/wrap";
import { RetroLcdScreenBuffer } from "../core/terminal/screen-buffer";
import type { RetroLcdCell, RetroLcdScreenSnapshot } from "../core/terminal/types";
import type { CursorMode, RetroLcdGeometry, RetroLcdValueModeProps } from "../core/types";

export type RetroLcdCursorRenderState = {
  row: number;
  col: number;
  mode: CursorMode;
};

export type RetroLcdRenderModel = {
  lines: string[];
  cells?: RetroLcdCell[][];
  cursor: RetroLcdCursorRenderState | null;
  isDimmed: boolean;
};

export const normalizeLines = (lines: string[], rows: number) => {
  const nextLines = [...lines];

  while (nextLines.length < rows) {
    nextLines.push("");
  }

  return nextLines.slice(0, rows);
};

export const buildTextRenderModel = ({
  text,
  geometry,
  cursorMode,
  cursorOffset,
  cursorVisible,
  dimmed
}: {
  text: string;
  geometry: RetroLcdGeometry;
  cursorMode: CursorMode;
  cursorOffset?: number;
  cursorVisible?: boolean;
  dimmed?: boolean;
}): RetroLcdRenderModel => {
  const wrappedLines = wrapTextToColumns(text, { cols: geometry.cols });
  const totalLines = [...wrappedLines];

  let cursor: RetroLcdCursorRenderState | null = null;
  let windowStart = 0;

  if (cursorVisible) {
    const cursorLines = wrapTextToColumns(text.slice(0, cursorOffset ?? text.length), {
      cols: geometry.cols
    });
    let cursorRow = cursorLines.length - 1;
    let cursorCol = cursorLines[cursorRow]?.length ?? 0;

    if (cursorCol >= geometry.cols) {
      cursorRow += 1;
      cursorCol = 0;
    }

    while (totalLines.length <= cursorRow) {
      totalLines.push("");
    }

    windowStart = Math.min(
      Math.max(0, cursorRow - geometry.rows + 1),
      Math.max(0, totalLines.length - geometry.rows)
    );

    if (cursorRow >= windowStart && cursorRow < windowStart + geometry.rows) {
      cursor = {
        row: cursorRow - windowStart,
        col: cursorCol,
        mode: cursorMode
      };
    }
  } else if (totalLines.length > geometry.rows) {
    windowStart = Math.max(0, totalLines.length - geometry.rows);
  }

  return {
    lines: normalizeLines(totalLines.slice(windowStart, windowStart + geometry.rows), geometry.rows),
    cursor,
    isDimmed: Boolean(dimmed)
  };
};

export const buildTerminalSnapshot = ({
  text,
  rows,
  cols,
  cursorMode,
  scrollback
}: {
  text: string;
  rows: number;
  cols: number;
  cursorMode: CursorMode;
  scrollback?: number;
}): RetroLcdScreenSnapshot => {
  const buffer = new RetroLcdScreenBuffer({
    rows,
    cols,
    cursorMode,
    scrollback
  });

  if (text) {
    buffer.write(text);
  }

  return buffer.getSnapshot();
};

const trimRenderedLine = (line: RetroLcdCell[]) =>
  line
    .map((cell) => cell.char)
    .join("")
    .replace(/\s+$/u, "");

export const getSnapshotMaxScrollOffset = (snapshot: RetroLcdScreenSnapshot) =>
  Math.max(0, snapshot.scrollbackCells.length);

export const clampSnapshotScrollOffset = (
  snapshot: RetroLcdScreenSnapshot,
  scrollOffset: number
) => Math.max(0, Math.min(getSnapshotMaxScrollOffset(snapshot), Math.floor(scrollOffset) || 0));

export const snapshotToRenderModel = (
  snapshot: RetroLcdScreenSnapshot,
  options: {
    scrollOffset?: number;
  } = {}
): RetroLcdRenderModel => {
  const scrollOffset = clampSnapshotScrollOffset(snapshot, options.scrollOffset ?? 0);
  const bufferCells = [...snapshot.scrollbackCells, ...snapshot.cells];
  const windowStart = Math.max(0, bufferCells.length - snapshot.rows - scrollOffset);
  const viewportCells = bufferCells.slice(windowStart, windowStart + snapshot.rows);
  const cursorAbsoluteRow = snapshot.scrollbackCells.length + snapshot.cursor.row;
  const cursorVisible =
    snapshot.cursor.visible &&
    cursorAbsoluteRow >= windowStart &&
    cursorAbsoluteRow < windowStart + snapshot.rows;

  return {
    lines: normalizeLines(viewportCells.map((line) => trimRenderedLine(line)), snapshot.rows),
    cells: viewportCells,
    cursor: cursorVisible
      ? {
          row: cursorAbsoluteRow - windowStart,
          col: snapshot.cursor.col,
          mode: snapshot.cursor.mode
        }
      : null,
    isDimmed: false
  };
};

export const getValueDisplayText = (props: RetroLcdValueModeProps, focused: boolean) => {
  if (props.value.length > 0) {
    return {
      text: props.value,
      dimmed: false
    };
  }

  return {
    text: props.placeholder && !focused ? props.placeholder : "",
    dimmed: Boolean(props.placeholder && !focused)
  };
};

export const getLineDisplayText = (line: string) => (line.length > 0 ? line : "\u00a0");

export const getCellCharacter = (cell: RetroLcdCell) => {
  if (cell.style.conceal) {
    return "\u00a0";
  }

  return cell.char === " " ? "\u00a0" : cell.char;
};
