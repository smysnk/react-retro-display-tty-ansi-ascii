export const DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COLS = 80;
export const DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROWS = 25;
export const DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP = 3;
export const DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COL_STEP = 2;
export const MAX_RETROSCREEN_ANSI_ADAPTIVE_VIEWPORT_COLS = 200;
export const MIN_RETROSCREEN_ANSI_ADAPTIVE_VIEWPORT_COLS =
  DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COLS;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizePositiveInt = (value: number | null | undefined, fallback: number) => {
  const normalizedValue = Math.floor(Number(value ?? Number.NaN));

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return fallback;
  }

  return normalizedValue;
};

export const getNextRetroScreenAnsiViewportAxisOffset = ({
  currentOffset = 0,
  delta = 0,
  unitsPerStep = 1,
  maxOffset = 0
}: {
  currentOffset?: number;
  delta?: number;
  unitsPerStep?: number;
  maxOffset?: number;
}) => {
  const boundedMaxOffset = Math.max(0, Math.floor(maxOffset || 0));
  const normalizedCurrentOffset = clamp(
    Math.floor(currentOffset || 0),
    0,
    boundedMaxOffset
  );

  if (!Number.isFinite(delta) || delta === 0 || boundedMaxOffset <= 0) {
    return normalizedCurrentOffset;
  }

  const normalizedStep = Math.max(1, Math.floor(unitsPerStep || 1));
  const scaledStep = Math.max(1, Math.round(Math.abs(delta) / 48)) * normalizedStep;
  const direction = delta > 0 ? 1 : -1;

  return clamp(
    normalizedCurrentOffset + direction * scaledStep,
    0,
    boundedMaxOffset
  );
};

export const getNextRetroScreenAnsiViewportOffsets = ({
  rowOffset = 0,
  colOffset = 0,
  deltaX = 0,
  deltaY = 0,
  rowUnitsPerStep = DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
  colUnitsPerStep = DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COL_STEP,
  maxRowOffset = 0,
  maxColOffset = 0
}: {
  rowOffset?: number;
  colOffset?: number;
  deltaX?: number;
  deltaY?: number;
  rowUnitsPerStep?: number;
  colUnitsPerStep?: number;
  maxRowOffset?: number;
  maxColOffset?: number;
}) => ({
  rowOffset: getNextRetroScreenAnsiViewportAxisOffset({
    currentOffset: rowOffset,
    delta: deltaY,
    unitsPerStep: rowUnitsPerStep,
    maxOffset: maxRowOffset
  }),
  colOffset: getNextRetroScreenAnsiViewportAxisOffset({
    currentOffset: colOffset,
    delta: deltaX,
    unitsPerStep: colUnitsPerStep,
    maxOffset: maxColOffset
  })
});

export const getNextRetroScreenAnsiViewportOffsetsForKey = ({
  key,
  rowOffset = 0,
  colOffset = 0,
  rowUnitsPerStep = DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
  colUnitsPerStep = DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COL_STEP,
  maxRowOffset = 0,
  maxColOffset = 0
}: {
  key: string;
  rowOffset?: number;
  colOffset?: number;
  rowUnitsPerStep?: number;
  colUnitsPerStep?: number;
  maxRowOffset?: number;
  maxColOffset?: number;
}) => {
  const normalizedKey = String(key || "").toLowerCase();

  switch (normalizedKey) {
    case "w":
      return {
        rowOffset: clamp(
          Math.floor(rowOffset || 0) - Math.max(1, Math.floor(rowUnitsPerStep || 1)),
          0,
          maxRowOffset
        ),
        colOffset: clamp(Math.floor(colOffset || 0), 0, maxColOffset)
      };
    case "s":
      return {
        rowOffset: clamp(
          Math.floor(rowOffset || 0) + Math.max(1, Math.floor(rowUnitsPerStep || 1)),
          0,
          maxRowOffset
        ),
        colOffset: clamp(Math.floor(colOffset || 0), 0, maxColOffset)
      };
    case "a":
      return {
        rowOffset: clamp(Math.floor(rowOffset || 0), 0, maxRowOffset),
        colOffset: clamp(
          Math.floor(colOffset || 0) - Math.max(1, Math.floor(colUnitsPerStep || 1)),
          0,
          maxColOffset
        )
      };
    case "d":
      return {
        rowOffset: clamp(Math.floor(rowOffset || 0), 0, maxRowOffset),
        colOffset: clamp(
          Math.floor(colOffset || 0) + Math.max(1, Math.floor(colUnitsPerStep || 1)),
          0,
          maxColOffset
        )
      };
    default:
      return {
        rowOffset: clamp(Math.floor(rowOffset || 0), 0, maxRowOffset),
        colOffset: clamp(Math.floor(colOffset || 0), 0, maxColOffset)
      };
  }
};

export const normalizeRetroScreenAnsiWheelPanDeltas = ({
  deltaX = 0,
  deltaY = 0,
  shiftKey = false
}: {
  deltaX?: number;
  deltaY?: number;
  shiftKey?: boolean;
}) => {
  if (shiftKey && deltaX === 0 && deltaY !== 0) {
    return {
      deltaX: deltaY,
      deltaY: 0
    };
  }

  return {
    deltaX,
    deltaY
  };
};

export const resolveRetroScreenAnsiViewportCols = ({
  sourceCols,
  defaultCols = DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COLS,
  minAdaptiveCols = MIN_RETROSCREEN_ANSI_ADAPTIVE_VIEWPORT_COLS,
  maxAdaptiveCols = MAX_RETROSCREEN_ANSI_ADAPTIVE_VIEWPORT_COLS
}: {
  sourceCols?: number | null;
  defaultCols?: number;
  minAdaptiveCols?: number;
  maxAdaptiveCols?: number;
} = {}) => {
  const normalizedDefaultCols = normalizePositiveInt(
    defaultCols,
    DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COLS
  );
  const normalizedSourceCols = normalizePositiveInt(sourceCols, normalizedDefaultCols);
  const normalizedMinAdaptiveCols = Math.max(
    1,
    normalizePositiveInt(minAdaptiveCols, normalizedDefaultCols)
  );
  const normalizedMaxAdaptiveCols = Math.max(
    normalizedMinAdaptiveCols,
    normalizePositiveInt(
      maxAdaptiveCols,
      MAX_RETROSCREEN_ANSI_ADAPTIVE_VIEWPORT_COLS
    )
  );

  if (
    normalizedSourceCols >= normalizedMinAdaptiveCols &&
    normalizedSourceCols <= normalizedMaxAdaptiveCols
  ) {
    return normalizedSourceCols;
  }

  return normalizedDefaultCols;
};

export const resolveRetroScreenAnsiViewportRows = ({
  sourceRows,
  defaultRows = DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROWS
}: {
  sourceRows?: number | null;
  defaultRows?: number;
} = {}) => {
  const normalizedDefaultRows = normalizePositiveInt(
    defaultRows,
    DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROWS
  );
  const normalizedSourceRows = normalizePositiveInt(sourceRows, normalizedDefaultRows);

  return Math.min(normalizedDefaultRows, normalizedSourceRows);
};

export const getRetroScreenAnsiViewportAspectRatio = ({
  cols = DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COLS,
  rows = DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROWS,
  cellWidthRatio = 0.5,
  cellHeightRatio = 1
}: {
  cols?: number;
  rows?: number;
  cellWidthRatio?: number;
  cellHeightRatio?: number;
} = {}) => {
  const normalizedCols = Math.max(
    1,
    normalizePositiveInt(cols, DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COLS)
  );
  const normalizedRows = Math.max(
    1,
    normalizePositiveInt(rows, DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROWS)
  );
  const normalizedCellWidthRatio =
    Number.isFinite(cellWidthRatio) && cellWidthRatio > 0 ? cellWidthRatio : 0.5;
  const normalizedCellHeightRatio =
    Number.isFinite(cellHeightRatio) && cellHeightRatio > 0 ? cellHeightRatio : 1;

  return Math.max(
    0.25,
    (normalizedCols * normalizedCellWidthRatio) /
      (normalizedRows * normalizedCellHeightRatio)
  );
};
