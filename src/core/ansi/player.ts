import type {
  RetroScreenAnsiCellSliceAccessor,
  RetroScreenAnsiLineSliceAccessor,
  RetroScreenAnsiSnapshotStorageMode
} from "./snapshot-contract";
import type {
  RetroScreenCell,
  RetroScreenCellStyle,
  RetroScreenTerminalColor
} from "../terminal/types";
import {
  applySgrParameters,
  cloneColor,
  cloneStyle,
  DEFAULT_CELL_STYLE
} from "../terminal/sgr";
import {
  decodeCp437Byte,
  type RetroScreenAnsiControlCharacterMode
} from "./cp437";

export type RetroScreenAnsiByteChunk = Uint8Array | ArrayBuffer | ArrayLike<number>;
export type RetroScreenAnsiWrapMode = "xterm-delayed" | "dos-immediate";
export type RetroScreenAnsiScrollMode = "terminal" | "canvas";
export type { RetroScreenAnsiControlCharacterMode } from "./cp437";

export type RetroScreenAnsiMetadata = {
  title: string;
  author: string;
  group: string;
  font: string;
  width: number;
  height: number;
  hasSauce?: boolean;
  geometrySource?: "sauce" | "fallback";
};

export type RetroScreenAnsiSnapshotFrame = {
  lines: readonly string[];
  text: string;
  cells?: readonly RetroScreenCell[][];
  storageMode: RetroScreenAnsiSnapshotStorageMode;
  getLineSlice: RetroScreenAnsiLineSliceAccessor;
  getCellSlice: RetroScreenAnsiCellSliceAccessor;
};

export type RetroScreenAnsiSnapshotStreamSnapshot = {
  currentFrame: RetroScreenAnsiSnapshotFrame;
  sourceRows: number;
  sourceCols: number;
  cursorRow: number;
  cursorCol: number;
  parserSettled: boolean;
  metadata: RetroScreenAnsiMetadata | null;
  storageMode: RetroScreenAnsiSnapshotStorageMode;
};

export type RetroScreenAnsiSnapshotStream = {
  appendChunk: (chunk: RetroScreenAnsiByteChunk) => RetroScreenAnsiSnapshotStreamSnapshot;
  appendText: (text: string) => RetroScreenAnsiSnapshotStreamSnapshot;
  writeChunk: (chunk: RetroScreenAnsiByteChunk) => void;
  writeText: (text: string) => void;
  finalize: () => RetroScreenAnsiSnapshotStreamSnapshot;
  getSnapshot: () => RetroScreenAnsiSnapshotStreamSnapshot;
  isParserSettled: () => boolean;
  reset: () => void;
};

const SAUCE_RECORD_SIZE = 128;
const SAUCE_SIGNATURE = "SAUCE";
const SAUCE_COMMENT_COUNT_OFFSET = 104;
const SAUCE_COMMENT_HEADER = "COMNT";
const SAUCE_COMMENT_LINE_SIZE = 64;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const stringifyGrid = (grid: readonly RetroScreenCell[][]) =>
  grid.map((row) => row.map((cell) => cell.char).join("")).join("\n");
const stringifyGridLines = (grid: readonly RetroScreenCell[][]) =>
  grid.map((row) => row.map((cell) => cell.char).join(""));
const EMPTY_CELL_CHARACTER = " ";
const PREVIEW_ROWS = 25;
const PREVIEW_COLS = 80;
const DEFAULT_TAB_WIDTH = 8;
const MAX_CANVAS_CURSOR_OVERSCAN_ROWS = 4096;

type RetroScreenAnsiDenseGrid = RetroScreenCell[][];
type RetroScreenAnsiSparseGrid = Map<number, Map<number, RetroScreenCell>>;

const padSlice = (value: string, length: number) =>
  value.length >= length ? value.slice(0, length) : value.padEnd(length, EMPTY_CELL_CHARACTER);

const createAnsiCell = (
  char: string = EMPTY_CELL_CHARACTER,
  style: RetroScreenCellStyle = DEFAULT_CELL_STYLE
): RetroScreenCell => ({
  char,
  style: cloneStyle(style)
});

const createEraseStyle = (style: RetroScreenCellStyle): RetroScreenCellStyle => ({
  ...cloneStyle(DEFAULT_CELL_STYLE),
  background: cloneColor(style.background)
});

const cloneAnsiCell = (cell: RetroScreenCell): RetroScreenCell => ({
  char: cell.char,
  style: cloneStyle(cell.style)
});

const isIgnoredControlCharacter = (character: string) => {
  const codePoint = character.codePointAt(0);

  if (typeof codePoint !== "number") {
    return false;
  }

  return (
    (codePoint >= 0x00 && codePoint < 0x20) ||
    codePoint === 0x7f ||
    (codePoint >= 0x80 && codePoint <= 0x9f)
  );
};

const cloneAnsiCellRow = (row: readonly RetroScreenCell[]) => row.map((cell) => cloneAnsiCell(cell));

const normalizeLineSliceRange = (
  startCol: number,
  endCol: number,
  totalCols: number
) => {
  const normalizedStart = clamp(Math.floor(startCol || 0), 0, totalCols);
  const normalizedEnd = clamp(
    Math.max(normalizedStart, Math.floor(endCol || normalizedStart)),
    normalizedStart,
    totalCols
  );

  return {
    startCol: normalizedStart,
    endCol: normalizedEnd,
    length: Math.max(0, normalizedEnd - normalizedStart)
  };
};

const sliceDenseLine = (
  line: string,
  startCol: number,
  endCol: number,
  totalCols: number
) => {
  const range = normalizeLineSliceRange(startCol, endCol, totalCols);

  return padSlice(line.slice(range.startCol, range.endCol), range.length);
};

const padCellSlice = (cells: RetroScreenCell[], length: number) =>
  cells.length >= length
    ? cells.slice(0, length).map((cell) => cloneAnsiCell(cell))
    : [
        ...cells.map((cell) => cloneAnsiCell(cell)),
        ...Array.from({ length: length - cells.length }, () => createAnsiCell())
      ];

const sliceDenseCellLine = (
  line: readonly RetroScreenCell[],
  startCol: number,
  endCol: number,
  totalCols: number
) => {
  const range = normalizeLineSliceRange(startCol, endCol, totalCols);

  return padCellSlice(line.slice(range.startCol, range.endCol).map((cell) => cloneAnsiCell(cell)), range.length);
};

const getSparseRow = (grid: RetroScreenAnsiSparseGrid, rowIndex: number) => grid.get(rowIndex);

const buildSparseLineSlice = ({
  grid,
  rowIndex,
  startCol,
  endCol,
  totalCols
}: {
  grid: RetroScreenAnsiSparseGrid;
  rowIndex: number;
  startCol: number;
  endCol: number;
  totalCols: number;
}) => {
  const range = normalizeLineSliceRange(startCol, endCol, totalCols);

  if (range.length <= 0) {
    return "";
  }

  const row = getSparseRow(grid, rowIndex);

  if (!row || row.size === 0) {
    return EMPTY_CELL_CHARACTER.repeat(range.length);
  }

  const slice = Array.from({ length: range.length }, () => EMPTY_CELL_CHARACTER);

  for (const [colIndex, cell] of row) {
    if (colIndex < range.startCol || colIndex >= range.endCol) {
      continue;
    }

    slice[colIndex - range.startCol] = cell.char;
  }

  return slice.join("");
};

const buildSparseCellSlice = ({
  grid,
  rowIndex,
  startCol,
  endCol,
  totalCols
}: {
  grid: RetroScreenAnsiSparseGrid;
  rowIndex: number;
  startCol: number;
  endCol: number;
  totalCols: number;
}) => {
  const range = normalizeLineSliceRange(startCol, endCol, totalCols);

  if (range.length <= 0) {
    return [];
  }

  const row = getSparseRow(grid, rowIndex);
  const slice = Array.from({ length: range.length }, () => createAnsiCell());

  if (!row || row.size === 0) {
    return slice;
  }

  for (const [colIndex, cell] of row) {
    if (colIndex < range.startCol || colIndex >= range.endCol) {
      continue;
    }

    slice[colIndex - range.startCol] = cloneAnsiCell(cell);
  }

  return slice;
};

const buildPreviewLinesFromSliceAccessor = ({
  rows,
  cols,
  getLineSlice
}: {
  rows: number;
  cols: number;
  getLineSlice: RetroScreenAnsiLineSliceAccessor;
}) => {
  const previewRows = Math.min(rows, PREVIEW_ROWS);
  const previewCols = Math.min(cols, PREVIEW_COLS);

  return Array.from({ length: previewRows }, (_, rowIndex) =>
    getLineSlice(rowIndex, 0, previewCols)
  );
};

const buildPreviewCellsFromSliceAccessor = ({
  rows,
  cols,
  getCellSlice
}: {
  rows: number;
  cols: number;
  getCellSlice: RetroScreenAnsiCellSliceAccessor;
}) => {
  const previewRows = Math.min(rows, PREVIEW_ROWS);
  const previewCols = Math.min(cols, PREVIEW_COLS);

  return Array.from({ length: previewRows }, (_, rowIndex) =>
    getCellSlice(rowIndex, 0, previewCols)
  );
};

const isDefaultColor = (color: RetroScreenCellStyle["foreground"]) =>
  color.mode === "default" && color.value === 0;

const isDefaultStyle = (style: RetroScreenCellStyle) =>
  style.intensity === "normal" &&
  !style.bold &&
  !style.faint &&
  !style.inverse &&
  !style.conceal &&
  !style.blink &&
  isDefaultColor(style.foreground) &&
  isDefaultColor(style.background);

const shouldPersistSparseCell = (cell: RetroScreenCell) =>
  cell.char !== EMPTY_CELL_CHARACTER || !isDefaultStyle(cell.style);

const createDenseFrame = ({
  grid,
  lines,
  text,
  cols
}: {
  grid: RetroScreenAnsiDenseGrid;
  lines?: readonly string[];
  text?: string;
  cols: number;
}): RetroScreenAnsiSnapshotFrame => ({
  lines: lines ? [...lines] : stringifyGridLines(grid),
  text: text ?? stringifyGrid(grid),
  cells: grid,
  storageMode: "eager",
  getLineSlice(rowIndex, startCol, endCol) {
    return sliceDenseLine((grid[rowIndex] ?? []).map((cell) => cell.char).join(""), startCol, endCol, cols);
  },
  getCellSlice(rowIndex, startCol, endCol) {
    return sliceDenseCellLine(grid[rowIndex] ?? [], startCol, endCol, cols);
  }
});

const createSparseFrame = ({
  grid,
  rows,
  cols
}: {
  grid: RetroScreenAnsiSparseGrid;
  rows: number;
  cols: number;
}): RetroScreenAnsiSnapshotFrame => {
  const getLineSlice: RetroScreenAnsiLineSliceAccessor = (rowIndex, startCol, endCol) =>
    buildSparseLineSlice({
      grid,
      rowIndex,
      startCol,
      endCol,
      totalCols: cols
    });
  const getCellSlice: RetroScreenAnsiCellSliceAccessor = (rowIndex, startCol, endCol) =>
    buildSparseCellSlice({
      grid,
      rowIndex,
      startCol,
      endCol,
      totalCols: cols
    });
  const lines = buildPreviewLinesFromSliceAccessor({
    rows,
    cols,
    getLineSlice
  });
  const cells = buildPreviewCellsFromSliceAccessor({
    rows,
    cols,
    getCellSlice
  });

  return {
    lines,
    cells,
    text: lines.join("\n"),
    storageMode: "sparse",
    getLineSlice,
    getCellSlice
  };
};

const readSauceText = (bytes: Uint8Array, start: number, length: number) =>
  decodeRetroScreenAnsiBytes(bytes.slice(start, start + length)).replace(/\0+$/u, "").trimEnd();

export const normalizeRetroScreenAnsiByteChunk = (
  chunk: RetroScreenAnsiByteChunk
): Uint8Array => {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }

  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }

  return Uint8Array.from(chunk);
};

export const decodeRetroScreenAnsiBytes = (
  bytes: Uint8Array,
  controlCharacterMode: RetroScreenAnsiControlCharacterMode = "ansi"
) => {
  const decoded = new Array<string>(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    decoded[index] = decodeCp437Byte(bytes[index] ?? 32, controlCharacterMode);
  }

  return decoded.join("");
};

export const findRetroScreenAnsiSauceIndex = (bytes: Uint8Array) => {
  const signatureBytes = Array.from(SAUCE_SIGNATURE, (char) => char.codePointAt(0) ?? 0);

  for (let index = bytes.length - SAUCE_RECORD_SIZE; index >= 0; index -= 1) {
    let matched = true;

    for (let offset = 0; offset < signatureBytes.length; offset += 1) {
      if (bytes[index + offset] !== signatureBytes[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return index;
    }
  }

  return -1;
};

export const stripRetroScreenAnsiSauce = (bytes: Uint8Array) => {
  const sauceIndex = findRetroScreenAnsiSauceIndex(bytes);

  if (sauceIndex < 0) {
    return bytes;
  }

  const commentCount = bytes[sauceIndex + SAUCE_COMMENT_COUNT_OFFSET] ?? 0;
  const commentBlockSize = SAUCE_COMMENT_HEADER.length + commentCount * SAUCE_COMMENT_LINE_SIZE;
  const possibleCommentIndex = sauceIndex - commentBlockSize;
  const hasCommentBlock =
    commentCount > 0 &&
    possibleCommentIndex >= 0 &&
    Array.from(SAUCE_COMMENT_HEADER).every(
      (char, offset) => bytes[possibleCommentIndex + offset] === (char.codePointAt(0) ?? 0)
    );
  const metadataIndex = hasCommentBlock ? possibleCommentIndex : sauceIndex;
  const payloadEnd =
    metadataIndex > 0 && bytes[metadataIndex - 1] === 0x1a
      ? metadataIndex - 1
      : metadataIndex;

  return bytes.slice(0, payloadEnd);
};

export const parseRetroScreenAnsiSauce = (bytes: Uint8Array): RetroScreenAnsiMetadata => {
  const sauceIndex = findRetroScreenAnsiSauceIndex(bytes);

  if (sauceIndex < 0) {
    return {
      title: "ANSI Stream",
      author: "Unknown",
      group: "Unknown",
      font: "IBM VGA",
      width: 80,
      height: 25,
      hasSauce: false,
      geometrySource: "fallback"
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + sauceIndex, SAUCE_RECORD_SIZE);

  return {
    title: readSauceText(bytes, sauceIndex + 7, 35) || "ANSI Stream",
    author: readSauceText(bytes, sauceIndex + 42, 20) || "Unknown",
    group: readSauceText(bytes, sauceIndex + 62, 20) || "Unknown",
    width: view.getUint16(96, true) || 80,
    height: view.getUint16(98, true) || 25,
    font: readSauceText(bytes, sauceIndex + 106, 22) || "IBM VGA",
    hasSauce: true,
    geometrySource: "sauce"
  };
};

export const splitRetroScreenAnsiBytes = (bytes: Uint8Array, chunkSize = 16384) => {
  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: Uint8Array[] = [];

  for (let index = 0; index < bytes.length; index += size) {
    chunks.push(bytes.slice(index, index + size));
  }

  return chunks;
};

export const createRetroScreenAnsiSnapshotStream = ({
  rows,
  cols,
  metadata = null,
  storageMode = "eager",
  controlCharacterMode = "ansi",
  scrollMode = "terminal",
  wrapMode = "xterm-delayed"
}: {
  rows: number;
  cols: number;
  metadata?: RetroScreenAnsiMetadata | null;
  storageMode?: RetroScreenAnsiSnapshotStorageMode;
  controlCharacterMode?: RetroScreenAnsiControlCharacterMode;
  scrollMode?: RetroScreenAnsiScrollMode;
  wrapMode?: RetroScreenAnsiWrapMode;
}): RetroScreenAnsiSnapshotStream => {
  const normalizedRows = Math.max(1, Math.floor(rows));
  const normalizedCols = Math.max(1, Math.floor(cols));
  const maximumCursorRow =
    scrollMode === "canvas"
      ? normalizedRows + MAX_CANVAS_CURSOR_OVERSCAN_ROWS
      : normalizedRows - 1;
  const normalizedStorageMode = storageMode;
  const createEmptyDenseGrid = () =>
    Array.from({ length: normalizedRows }, () =>
      Array.from({ length: normalizedCols }, () => createAnsiCell())
    );
  let grid =
    normalizedStorageMode === "eager"
      ? createEmptyDenseGrid()
      : null;
  let sparseGrid: RetroScreenAnsiSparseGrid =
    normalizedStorageMode === "sparse" ? new Map() : new Map();
  let currentFrameLinesCache =
    normalizedStorageMode === "eager" && grid ? stringifyGridLines(grid) : [];
  let currentFrameTextCache = currentFrameLinesCache.join("\n");
  let frameDirty = false;
  let cursorRow = 0;
  let cursorCol = 0;
  let savedCursorRow = 0;
  let savedCursorCol = 0;
  let pendingWrap = false;
  let pendingEscape: string | null = null;
  let pendingCarriageReturn = false;
  let currentStyle = cloneStyle(DEFAULT_CELL_STYLE);
  let foreground24BitFallback: RetroScreenTerminalColor | null = null;
  let background24BitFallback: RetroScreenTerminalColor | null = null;

  const markFrameDirty = () => {
    frameDirty = true;
  };

  const getCurrentFrame = (): RetroScreenAnsiSnapshotFrame => {
    if (normalizedStorageMode === "sparse") {
      return createSparseFrame({
        grid: sparseGrid,
        rows: normalizedRows,
        cols: normalizedCols
      });
    }

    if (frameDirty && grid) {
      currentFrameLinesCache = stringifyGridLines(grid);
      currentFrameTextCache = currentFrameLinesCache.join("\n");
      frameDirty = false;
    }

    return createDenseFrame({
      grid: grid ?? createEmptyDenseGrid(),
      lines: currentFrameLinesCache,
      text: currentFrameTextCache,
      cols: normalizedCols
    });
  };

  const getSnapshot = (): RetroScreenAnsiSnapshotStreamSnapshot => ({
    currentFrame: getCurrentFrame(),
    sourceRows: normalizedRows,
    sourceCols: normalizedCols,
    cursorRow,
    cursorCol: Math.min(cursorCol, normalizedCols - 1),
    parserSettled: pendingEscape === null && !pendingCarriageReturn,
    metadata,
    storageMode: normalizedStorageMode
  });

  const createBlankDenseRow = () =>
    Array.from({ length: normalizedCols }, () => createAnsiCell());

  const createStyledBlankDenseRow = (style: RetroScreenCellStyle) =>
    Array.from({ length: normalizedCols }, () => createAnsiCell(EMPTY_CELL_CHARACTER, style));

  const scrollViewportUp = () => {
    // Ansilove animation playback clears the row exposed by a scroll to the
    // default VGA background, independently of the active SGR background.
    const fillStyle = cloneStyle(DEFAULT_CELL_STYLE);

    if (grid) {
      grid.shift();
      grid.push(createStyledBlankDenseRow(fillStyle));
    }

    if (normalizedStorageMode === "sparse") {
      const nextSparseGrid: RetroScreenAnsiSparseGrid = new Map();

      for (const [rowIndex, row] of sparseGrid) {
        if (rowIndex <= 0) {
          continue;
        }

        const nextRowIndex = rowIndex - 1;

        if (nextRowIndex < normalizedRows) {
          nextSparseGrid.set(nextRowIndex, row);
        }
      }

      const fillRow = new Map<number, RetroScreenCell>();

      for (let col = 0; col < normalizedCols; col += 1) {
        const nextCell = createAnsiCell(EMPTY_CELL_CHARACTER, fillStyle);

        if (shouldPersistSparseCell(nextCell)) {
          fillRow.set(col, nextCell);
        }
      }

      if (fillRow.size > 0) {
        nextSparseGrid.set(normalizedRows - 1, fillRow);
      }

      sparseGrid = nextSparseGrid;
    }

    if (controlCharacterMode !== "dos-cp437" && savedCursorRow > 0) {
      savedCursorRow -= 1;
    }

    markFrameDirty();
  };

  const newLine = () => {
    cursorCol = 0;

    if (cursorRow === normalizedRows - 1) {
      if (scrollMode === "terminal") {
        scrollViewportUp();
        return;
      }
    }

    cursorRow = clamp(cursorRow + 1, 0, maximumCursorRow);
  };

  const prepareCursorForPrint = () => {
    if (pendingWrap) {
      newLine();
      pendingWrap = false;
      return;
    }

    if (cursorCol >= normalizedCols) {
      cursorCol = Math.max(0, normalizedCols - 1);
    }
  };

  const normalizeCursorForMovement = () => {
    if (pendingWrap || cursorCol >= normalizedCols) {
      cursorCol = Math.max(0, normalizedCols - 1);
      pendingWrap = false;
    }
  };

  const saveCursor = () => {
    normalizeCursorForMovement();
    savedCursorRow = cursorRow;
    savedCursorCol = cursorCol;
  };

  const restoreCursor = () => {
    pendingWrap = false;
    cursorRow = clamp(savedCursorRow, 0, maximumCursorRow);
    cursorCol = clamp(savedCursorCol, 0, normalizedCols - 1);
  };

  const backspace = () => {
    if (pendingWrap || cursorCol >= normalizedCols) {
      pendingWrap = false;
      cursorCol = Math.max(0, normalizedCols - 2);
      return;
    }

    if (cursorCol > 0) {
      cursorCol -= 1;
    }
  };

  const lineFeed = () => {
    normalizeCursorForMovement();

    if (cursorRow === normalizedRows - 1) {
      if (scrollMode === "terminal") {
        scrollViewportUp();
        return;
      }
    }

    cursorRow = clamp(cursorRow + 1, 0, maximumCursorRow);
  };

  const writePrintable = (character: string) => {
    prepareCursorForPrint();
    const nextCell = createAnsiCell(character, currentStyle);
    const cursorIsVisible = cursorRow >= 0 && cursorRow < normalizedRows;

    if (cursorIsVisible && normalizedStorageMode === "sparse") {
      const currentRow = sparseGrid.get(cursorRow) ?? new Map<number, RetroScreenCell>();

      if (!shouldPersistSparseCell(nextCell)) {
        currentRow.delete(cursorCol);
      } else {
        currentRow.set(cursorCol, nextCell);
      }

      if (currentRow.size === 0) {
        sparseGrid.delete(cursorRow);
      } else {
        sparseGrid.set(cursorRow, currentRow);
      }
    } else if (cursorIsVisible && grid) {
      grid[cursorRow]![cursorCol] = nextCell;
    }

    if (cursorIsVisible) {
      markFrameDirty();
    }

    if (cursorCol === normalizedCols - 1) {
      if (wrapMode === "dos-immediate") {
        newLine();
        pendingWrap = false;
      } else {
        cursorCol = normalizedCols;
        pendingWrap = true;
      }
    } else {
      cursorCol += 1;
      pendingWrap = false;
    }
  };

  const insertTab = () => {
    normalizeCursorForMovement();
    const spaces = DEFAULT_TAB_WIDTH - (cursorCol % DEFAULT_TAB_WIDTH || 0);
    cursorCol = clamp(cursorCol + spaces, 0, normalizedCols - 1);
    pendingWrap = false;
  };

  const eraseChars = (count: number) => {
    normalizeCursorForMovement();

    if (cursorRow < 0 || cursorRow >= normalizedRows) {
      return;
    }

    const eraseCount = Math.min(normalizedCols - cursorCol, Math.max(1, Math.floor(count)));
    const eraseStyle = createEraseStyle(currentStyle);

    for (let col = cursorCol; col < Math.min(normalizedCols, cursorCol + eraseCount); col += 1) {
      const nextCell = createAnsiCell(EMPTY_CELL_CHARACTER, eraseStyle);

      if (normalizedStorageMode === "sparse") {
        const currentRow = sparseGrid.get(cursorRow) ?? new Map<number, RetroScreenCell>();

        if (!shouldPersistSparseCell(nextCell)) {
          currentRow.delete(col);
        } else {
          currentRow.set(col, nextCell);
        }

        if (currentRow.size === 0) {
          sparseGrid.delete(cursorRow);
        } else {
          sparseGrid.set(cursorRow, currentRow);
        }
      } else if (grid) {
        grid[cursorRow]![col] = nextCell;
      }
    }

    markFrameDirty();
  };

  const eraseInLine = (mode: number) => {
    if (cursorRow < 0 || cursorRow >= normalizedRows) {
      return;
    }

    const eraseStyle = createEraseStyle(currentStyle);
    const applyEraseAtColumn = (col: number) => {
      const nextCell = createAnsiCell(EMPTY_CELL_CHARACTER, eraseStyle);

      if (normalizedStorageMode === "sparse") {
        const currentRow = sparseGrid.get(cursorRow) ?? new Map<number, RetroScreenCell>();

        if (!shouldPersistSparseCell(nextCell)) {
          currentRow.delete(col);
        } else {
          currentRow.set(col, nextCell);
        }

        if (currentRow.size === 0) {
          sparseGrid.delete(cursorRow);
        } else {
          sparseGrid.set(cursorRow, currentRow);
        }
      } else if (grid) {
        grid[cursorRow]![col] = nextCell;
      }
    };

    switch (mode) {
      case 1:
        for (let col = 0; col <= cursorCol; col += 1) {
          applyEraseAtColumn(col);
        }
        break;
      case 2:
        if (normalizedStorageMode === "sparse") {
          const currentRow = new Map<number, RetroScreenCell>();
          for (let col = 0; col < normalizedCols; col += 1) {
            const nextCell = createAnsiCell(EMPTY_CELL_CHARACTER, eraseStyle);
            if (shouldPersistSparseCell(nextCell)) {
              currentRow.set(col, nextCell);
            }
          }
          if (currentRow.size === 0) {
            sparseGrid.delete(cursorRow);
          } else {
            sparseGrid.set(cursorRow, currentRow);
          }
        } else if (grid) {
          grid[cursorRow] = createStyledBlankDenseRow(eraseStyle);
        }
        break;
      default:
        for (let col = cursorCol; col < normalizedCols; col += 1) {
          applyEraseAtColumn(col);
        }
        break;
    }

    markFrameDirty();
  };

  const eraseInDisplay = (mode: number) => {
    const eraseStyle = createEraseStyle(currentStyle);
    const replaceRow = (rowIndex: number) => {
      if (normalizedStorageMode === "sparse") {
        const currentRow = new Map<number, RetroScreenCell>();
        for (let col = 0; col < normalizedCols; col += 1) {
          const nextCell = createAnsiCell(EMPTY_CELL_CHARACTER, eraseStyle);
          if (shouldPersistSparseCell(nextCell)) {
            currentRow.set(col, nextCell);
          }
        }
        if (currentRow.size === 0) {
          sparseGrid.delete(rowIndex);
        } else {
          sparseGrid.set(rowIndex, currentRow);
        }
      } else if (grid) {
        grid[rowIndex] = createStyledBlankDenseRow(eraseStyle);
      }
    };

    switch (mode) {
      case 1:
        for (let rowIndex = 0; rowIndex < Math.min(cursorRow, normalizedRows); rowIndex += 1) {
          replaceRow(rowIndex);
        }
        if (cursorRow < normalizedRows) {
          for (let col = 0; col <= cursorCol; col += 1) {
            const previousCursorCol = cursorCol;
            cursorCol = col;
            eraseChars(1);
            cursorCol = previousCursorCol;
          }
        }
        break;
      case 2:
        for (let rowIndex = 0; rowIndex < normalizedRows; rowIndex += 1) {
          replaceRow(rowIndex);
        }
        if (controlCharacterMode === "dos-cp437") {
          cursorRow = 0;
          cursorCol = 0;
          pendingWrap = false;
        }
        break;
      default:
        if (cursorRow < normalizedRows) {
          for (let col = cursorCol; col < normalizedCols; col += 1) {
            const previousCursorCol = cursorCol;
            cursorCol = col;
            eraseChars(1);
            cursorCol = previousCursorCol;
          }
        }
        for (let rowIndex = cursorRow + 1; rowIndex < normalizedRows; rowIndex += 1) {
          replaceRow(rowIndex);
        }
        break;
    }

    markFrameDirty();
  };

  const handleCsiSequence = (sequence: string) => {
    const finalByte = sequence.at(-1) ?? "";
    const rawParams = sequence.slice(2, -1);
    const rawParamValues = rawParams.length === 0 ? [] : rawParams.split(";");
    // Ansilove treats a trailing separator as sequence punctuation rather than
    // another omitted parameter (`CSI 0;1;m` is reset + bold, not reset + bold
    // + reset). Interior omissions retain the ANSI default value of zero.
    while (rawParamValues.at(-1) === "") rawParamValues.pop();
    const params = rawParamValues
      .map((value) => (value.length === 0 ? 0 : Number.parseInt(value, 10)))
      .filter((value) => Number.isFinite(value));
    const getCursorParam = (index: number, fallback: number) => {
      const value = params[index];
      return Number.isFinite(value) && value! > 0 ? value! : fallback;
    };

    if (finalByte === "H" || (finalByte === "f" && controlCharacterMode !== "dos-cp437")) {
      const nextAbsoluteRow = clamp(getCursorParam(0, 1) - 1, 0, maximumCursorRow);
      const nextAbsoluteCol = clamp(getCursorParam(1, 1) - 1, 0, normalizedCols - 1);

      pendingWrap = false;
      cursorRow = nextAbsoluteRow;
      cursorCol = nextAbsoluteCol;
      return;
    }

    if (finalByte === "m") {
      if (controlCharacterMode !== "dos-cp437") {
        currentStyle = applySgrParameters(currentStyle, params);
        return;
      }

      for (const code of params.length > 0 ? params : [0]) {
        if (code === 0) {
          foreground24BitFallback = null;
          background24BitFallback = null;
        } else if (code === 1 && foreground24BitFallback) {
          currentStyle.foreground = foreground24BitFallback;
          foreground24BitFallback = null;
        } else if (code >= 30 && code <= 37) {
          foreground24BitFallback = null;
        } else if (code >= 40 && code <= 47) {
          background24BitFallback = null;
        }

        if (
          code === 0 || code === 1 || code === 5 || code === 7 || code === 22 ||
          code === 25 || code === 27 || (code >= 30 && code <= 37) ||
          (code >= 40 && code <= 47)
        ) {
          currentStyle = applySgrParameters(currentStyle, [code], { extendedColors: false });
        }
      }
      return;
    }

    if (finalByte === "t" && params.length === 4 && (params[0] === 0 || params[0] === 1)) {
      if (params[0] === 0) {
        background24BitFallback ??= cloneColor(currentStyle.background);
      } else {
        foreground24BitFallback ??= cloneColor(currentStyle.foreground);
      }
      currentStyle = applySgrParameters(currentStyle, [
        params[0] === 0 ? 48 : 38,
        2,
        params[1] ?? 0,
        params[2] ?? 0,
        params[3] ?? 0
      ]);
      return;
    }

    if (finalByte === "J") {
      eraseInDisplay(params[0] ?? 0);
      return;
    }

    if (finalByte === "K") {
      eraseInLine(params[0] ?? 0);
      return;
    }

    if (finalByte === "X") {
      eraseChars(getCursorParam(0, 1));
      return;
    }

    if (finalByte === "s") {
      saveCursor();
      return;
    }

    if (finalByte === "u") {
      restoreCursor();
      return;
    }

    if (finalByte === "A") {
      normalizeCursorForMovement();
      cursorRow = clamp(cursorRow - getCursorParam(0, 1), 0, maximumCursorRow);
      return;
    }

    if (finalByte === "B") {
      normalizeCursorForMovement();
      cursorRow = clamp(cursorRow + getCursorParam(0, 1), 0, maximumCursorRow);
      return;
    }

    if (finalByte === "C") {
      normalizeCursorForMovement();
      cursorCol = clamp(cursorCol + getCursorParam(0, 1), 0, normalizedCols - 1);
      return;
    }

    if (finalByte === "D") {
      normalizeCursorForMovement();
      cursorCol = clamp(cursorCol - getCursorParam(0, 1), 0, normalizedCols - 1);
    }
  };

  const writeText = (text: string) => {
    for (const character of text) {
      if (pendingCarriageReturn) {
        pendingCarriageReturn = false;
        if (character === "\n") {
          newLine();
          continue;
        }
      }

      if (wrapMode === "dos-immediate" && pendingWrap) {
        newLine();
        pendingWrap = false;
      }

      if (pendingEscape !== null) {
        if (character === "\u001b" && controlCharacterMode !== "dos-cp437") {
          pendingEscape = character;
          continue;
        }

        if (
          controlCharacterMode !== "dos-cp437" &&
          (character === "\u0018" || character === "\u001a")
        ) {
          pendingEscape = null;
          continue;
        }

        pendingEscape += character;

        if (pendingEscape.length === 1) {
          continue;
        }

        if (pendingEscape.length === 2 && character !== "[") {
          pendingEscape = null;
          continue;
        }

        const terminatesCsi = controlCharacterMode === "dos-cp437"
          ? (character >= "A" && character <= "Z") || (character >= "a" && character <= "z")
          : character >= "@" && character <= "~";
        if (pendingEscape.length >= 3 && terminatesCsi) {
          handleCsiSequence(pendingEscape);
          pendingEscape = null;
        }

        continue;
      }

      if (character === "\u001b") {
        pendingEscape = character;
        continue;
      }

      if (character === "\r") {
        if (controlCharacterMode === "dos-cp437") {
          pendingCarriageReturn = true;
        } else {
          pendingWrap = false;
          cursorCol = 0;
        }
        continue;
      }

      if (character === "\n") {
        if (controlCharacterMode === "dos-cp437") {
          newLine();
        } else {
          lineFeed();
        }
        continue;
      }

      if (character === "\v") {
        lineFeed();
        continue;
      }

      if (character === "\b") {
        backspace();
        continue;
      }

      if (character === "\t") {
        insertTab();
        continue;
      }

      if (character === "\f") {
        lineFeed();
        continue;
      }

      if (character === "\u0007" || isIgnoredControlCharacter(character)) {
        continue;
      }

      writePrintable(character);
    }

  };

  const writeChunk = (chunk: RetroScreenAnsiByteChunk) => {
    writeText(
      decodeRetroScreenAnsiBytes(
        normalizeRetroScreenAnsiByteChunk(chunk),
        controlCharacterMode
      )
    );
  };

  return {
    appendChunk(chunk) {
      writeChunk(chunk);
      return getSnapshot();
    },
    appendText(text) {
      writeText(text);
      return getSnapshot();
    },
    writeChunk,
    writeText,
    finalize() {
      pendingEscape = null;
      pendingCarriageReturn = false;
      return getSnapshot();
    },
    getSnapshot,
    isParserSettled() {
      return pendingEscape === null && !pendingCarriageReturn;
    },
    reset() {
      grid =
        normalizedStorageMode === "eager"
          ? createEmptyDenseGrid()
          : null;
      sparseGrid = new Map();
      currentFrameLinesCache =
        normalizedStorageMode === "eager" && grid ? stringifyGridLines(grid) : [];
      currentFrameTextCache = currentFrameLinesCache.join("\n");
      frameDirty = false;
      cursorRow = 0;
      cursorCol = 0;
      savedCursorRow = 0;
      savedCursorCol = 0;
      pendingWrap = false;
      pendingEscape = null;
      pendingCarriageReturn = false;
      currentStyle = cloneStyle(DEFAULT_CELL_STYLE);
      foreground24BitFallback = null;
      background24BitFallback = null;
    }
  };
};
