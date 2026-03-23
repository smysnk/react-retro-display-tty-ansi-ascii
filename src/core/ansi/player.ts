import type {
  RetroScreenAnsiCellSliceAccessor,
  RetroScreenAnsiLineSliceAccessor,
  RetroScreenAnsiSnapshotStorageMode
} from "./snapshot-contract";
import type { RetroScreenCell, RetroScreenCellStyle } from "../terminal/types";
import {
  applySgrParameters,
  cloneStyle,
  DEFAULT_CELL_STYLE
} from "../terminal/sgr";

export type RetroScreenAnsiByteChunk = Uint8Array | ArrayBuffer | ArrayLike<number>;

export type RetroScreenAnsiMetadata = {
  title: string;
  author: string;
  group: string;
  font: string;
  width: number;
  height: number;
};

export type RetroScreenAnsiFrameStreamSnapshot = {
  completedFrames: readonly string[];
  currentFrame: string;
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
  completedFrames: readonly RetroScreenAnsiSnapshotFrame[];
  currentFrame: RetroScreenAnsiSnapshotFrame;
  sourceRows: number;
  sourceCols: number;
  metadata: RetroScreenAnsiMetadata | null;
  storageMode: RetroScreenAnsiSnapshotStorageMode;
};

export type RetroScreenAnsiFrameStream = {
  appendChunk: (chunk: RetroScreenAnsiByteChunk) => RetroScreenAnsiFrameStreamSnapshot;
  appendText: (text: string) => RetroScreenAnsiFrameStreamSnapshot;
  getSnapshot: () => RetroScreenAnsiFrameStreamSnapshot;
  reset: () => void;
};

export type RetroScreenAnsiSnapshotStream = {
  appendChunk: (chunk: RetroScreenAnsiByteChunk) => RetroScreenAnsiSnapshotStreamSnapshot;
  appendText: (text: string) => RetroScreenAnsiSnapshotStreamSnapshot;
  getSnapshot: () => RetroScreenAnsiSnapshotStreamSnapshot;
  reset: () => void;
};

const CP437_CODE_POINTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78,
  79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
  98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 199,
  252, 233, 226, 228, 224, 229, 231, 234, 235, 232, 239, 238, 236, 196, 197,
  201, 230, 198, 244, 246, 242, 251, 249, 255, 214, 220, 162, 163, 165, 8359,
  402, 225, 237, 243, 250, 241, 209, 170, 186, 191, 8976, 172, 189, 188, 161,
  171, 187, 9617, 9618, 9619, 9474, 9508, 9569, 9570, 9558, 9557, 9571, 9553,
  9559, 9565, 9564, 9563, 9488, 9492, 9524, 9516, 9500, 9472, 9532, 9566, 9567,
  9562, 9556, 9577, 9574, 9568, 9552, 9580, 9575, 9576, 9572, 9573, 9561, 9560,
  9554, 9555, 9579, 9578, 9496, 9484, 9608, 9604, 9612, 9616, 9600, 945, 223,
  915, 960, 931, 963, 181, 964, 934, 920, 937, 948, 8734, 966, 949, 8745, 8801,
  177, 8805, 8804, 8992, 8993, 247, 8776, 176, 8729, 183, 8730, 8319, 178, 9632,
  160
] as const;

const SAUCE_RECORD_SIZE = 128;
const SAUCE_SIGNATURE = "SAUCE00";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const stringifyGrid = (grid: readonly RetroScreenCell[][]) =>
  grid.map((row) => row.map((cell) => cell.char).join("")).join("\n");
const stringifyGridLines = (grid: readonly RetroScreenCell[][]) =>
  grid.map((row) => row.map((cell) => cell.char).join(""));
const EMPTY_CELL_CHARACTER = " ";
const PREVIEW_ROWS = 25;
const PREVIEW_COLS = 80;

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

const cloneAnsiCell = (cell: RetroScreenCell): RetroScreenCell => ({
  char: cell.char,
  style: cloneStyle(cell.style)
});

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

const cloneDenseGrid = (grid: readonly RetroScreenCell[][]): RetroScreenAnsiDenseGrid =>
  grid.map((row) => cloneAnsiCellRow(row));

const cloneSparseGrid = (grid: RetroScreenAnsiSparseGrid): RetroScreenAnsiSparseGrid =>
  new Map(
    Array.from(grid, ([rowIndex, row]) => [
      rowIndex,
      new Map(Array.from(row, ([colIndex, cell]) => [colIndex, cloneAnsiCell(cell)]))
    ])
  );

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

const decodeCp437Byte = (value: number) =>
  String.fromCodePoint(CP437_CODE_POINTS[value] ?? 32);

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

export const decodeRetroScreenAnsiBytes = (bytes: Uint8Array) => {
  const decoded = new Array<string>(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    decoded[index] = decodeCp437Byte(bytes[index] ?? 32);
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

  const payloadEnd =
    sauceIndex > 0 && bytes[sauceIndex - 1] === 0x1a ? sauceIndex - 1 : sauceIndex;

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
      height: 25
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + sauceIndex, SAUCE_RECORD_SIZE);

  return {
    title: readSauceText(bytes, sauceIndex + 7, 35) || "ANSI Stream",
    author: readSauceText(bytes, sauceIndex + 42, 20) || "Unknown",
    group: readSauceText(bytes, sauceIndex + 62, 20) || "Unknown",
    width: view.getUint16(96, true) || 80,
    height: view.getUint16(98, true) || 25,
    font: readSauceText(bytes, sauceIndex + 106, 22) || "IBM VGA"
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
  storageMode = "eager"
}: {
  rows: number;
  cols: number;
  metadata?: RetroScreenAnsiMetadata | null;
  storageMode?: RetroScreenAnsiSnapshotStorageMode;
}): RetroScreenAnsiSnapshotStream => {
  const normalizedRows = Math.max(1, Math.floor(rows));
  const normalizedCols = Math.max(1, Math.floor(cols));
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
  let completedFrames: RetroScreenAnsiSnapshotFrame[] = [];
  let currentFrameLinesCache =
    normalizedStorageMode === "eager" && grid ? stringifyGridLines(grid) : [];
  let currentFrameTextCache = currentFrameLinesCache.join("\n");
  let frameDirty = false;
  let cursorRow = 0;
  let cursorCol = 0;
  let previousAbsoluteRow: number | null = null;
  let previousAbsoluteCol: number | null = null;
  let pendingEscape: string | null = null;
  let currentStyle = cloneStyle(DEFAULT_CELL_STYLE);

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
    completedFrames,
    currentFrame: getCurrentFrame(),
    sourceRows: normalizedRows,
    sourceCols: normalizedCols,
    metadata,
    storageMode: normalizedStorageMode
  });

  const pushCompletedFrame = () => {
    if (normalizedStorageMode === "sparse") {
      completedFrames.push(
        createSparseFrame({
          grid: cloneSparseGrid(sparseGrid),
          rows: normalizedRows,
          cols: normalizedCols
        })
      );
      return;
    }

    const currentFrame = getCurrentFrame();

    completedFrames.push(
      createDenseFrame({
        grid: cloneDenseGrid(currentFrame.cells ?? []),
        lines: currentFrame.lines,
        text: currentFrame.text,
        cols: normalizedCols
      })
    );
  };

  const newLine = () => {
    cursorCol = 0;
    cursorRow = clamp(cursorRow + 1, 0, normalizedRows - 1);
  };

  const handleCsiSequence = (sequence: string) => {
    const finalByte = sequence.at(-1) ?? "";
    const rawParams = sequence.slice(2, -1);
    const params =
      rawParams.length === 0
        ? []
        : rawParams
            .split(";")
            .map((value) => (value.length === 0 ? 0 : Number.parseInt(value, 10)))
            .filter((value) => Number.isFinite(value));
    const getCursorParam = (index: number, fallback: number) => {
      const value = params[index];
      return Number.isFinite(value) && value! > 0 ? value! : fallback;
    };

    if (finalByte === "H" || finalByte === "f") {
      const nextAbsoluteRow = clamp(getCursorParam(0, 1) - 1, 0, normalizedRows - 1);
      const nextAbsoluteCol = clamp(getCursorParam(1, 1) - 1, 0, normalizedCols - 1);

      if (
        previousAbsoluteRow !== null &&
        (nextAbsoluteRow < previousAbsoluteRow ||
          (nextAbsoluteRow === previousAbsoluteRow && nextAbsoluteCol < previousAbsoluteCol!))
      ) {
        pushCompletedFrame();
      }

      cursorRow = nextAbsoluteRow;
      cursorCol = nextAbsoluteCol;
      previousAbsoluteRow = nextAbsoluteRow;
      previousAbsoluteCol = nextAbsoluteCol;
      return;
    }

    if (finalByte === "m") {
      currentStyle = applySgrParameters(currentStyle, params);
      return;
    }

    if (finalByte === "C") {
      if (cursorCol === normalizedCols - 1) {
        newLine();
      }

      cursorCol = clamp(cursorCol + getCursorParam(0, 1), 0, normalizedCols - 1);
    }
  };

  const appendText = (text: string) => {
    for (const character of text) {
      if (pendingEscape !== null) {
        pendingEscape += character;

        if (pendingEscape.length === 1) {
          continue;
        }

        if (pendingEscape.length === 2 && character !== "[") {
          pendingEscape = null;
          continue;
        }

        if (pendingEscape.length >= 3 && character >= "@" && character <= "~") {
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
        cursorCol = 0;
        continue;
      }

      if (character === "\n") {
        newLine();
        continue;
      }

      const nextCell = createAnsiCell(character, currentStyle);

      if (normalizedStorageMode === "sparse") {
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
      } else if (grid) {
        grid[cursorRow]![cursorCol] = nextCell;
      }

      markFrameDirty();

      if (cursorCol === normalizedCols - 1) {
        newLine();
      } else {
        cursorCol += 1;
      }
    }

    return getSnapshot();
  };

  return {
    appendChunk(chunk) {
      return appendText(decodeRetroScreenAnsiBytes(normalizeRetroScreenAnsiByteChunk(chunk)));
    },
    appendText,
    getSnapshot,
    reset() {
      grid =
        normalizedStorageMode === "eager"
          ? createEmptyDenseGrid()
          : null;
      sparseGrid = new Map();
      completedFrames = [];
      currentFrameLinesCache =
        normalizedStorageMode === "eager" && grid ? stringifyGridLines(grid) : [];
      currentFrameTextCache = currentFrameLinesCache.join("\n");
      frameDirty = false;
      cursorRow = 0;
      cursorCol = 0;
      previousAbsoluteRow = null;
      previousAbsoluteCol = null;
      pendingEscape = null;
      currentStyle = cloneStyle(DEFAULT_CELL_STYLE);
    }
  };
};

const toRetroScreenAnsiFrameStreamSnapshot = (
  snapshot: RetroScreenAnsiSnapshotStreamSnapshot
): RetroScreenAnsiFrameStreamSnapshot => ({
  completedFrames: snapshot.completedFrames.map((frame) => frame.text),
  currentFrame: snapshot.currentFrame.text
});

export const createRetroScreenAnsiFrameStream = ({
  rows,
  cols
}: {
  rows: number;
  cols: number;
}): RetroScreenAnsiFrameStream => {
  const snapshotStream = createRetroScreenAnsiSnapshotStream({ rows, cols });

  return {
    appendChunk(chunk) {
      return toRetroScreenAnsiFrameStreamSnapshot(snapshotStream.appendChunk(chunk));
    },
    appendText(text) {
      return toRetroScreenAnsiFrameStreamSnapshot(snapshotStream.appendText(text));
    },
    getSnapshot() {
      return toRetroScreenAnsiFrameStreamSnapshot(snapshotStream.getSnapshot());
    },
    reset() {
      snapshotStream.reset();
    }
  };
};

export const materializeRetroScreenAnsiFrames = (
  bytesOrText: Uint8Array | string,
  rows: number,
  cols: number
) => {
  const stream = createRetroScreenAnsiFrameStream({ rows, cols });
  const snapshot =
    typeof bytesOrText === "string" ? stream.appendText(bytesOrText) : stream.appendChunk(bytesOrText);

  return [...snapshot.completedFrames, snapshot.currentFrame];
};

export const materializeRetroScreenAnsiSnapshots = (
  bytesOrText: Uint8Array | string,
  rows: number,
  cols: number,
  metadata: RetroScreenAnsiMetadata | null = null
) => {
  const stream = createRetroScreenAnsiSnapshotStream({ rows, cols, metadata });
  const snapshot =
    typeof bytesOrText === "string" ? stream.appendText(bytesOrText) : stream.appendChunk(bytesOrText);

  return [...snapshot.completedFrames, snapshot.currentFrame];
};
