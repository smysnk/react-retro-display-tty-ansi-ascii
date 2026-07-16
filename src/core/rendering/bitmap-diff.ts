export type RetroScreenBitmapDirtyCell = {
  row: number;
  col: number;
};

export type RetroScreenBitmapDiff = {
  dirtyCells: RetroScreenBitmapDirtyCell[];
  dirtyRatio: number;
  changed: boolean;
};

export const diffBitmapCellSignatures = (
  previous: readonly (readonly string[])[] | null,
  next: readonly (readonly string[])[]
): RetroScreenBitmapDiff => {
  const rows = next.length;
  const cols = next.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  const totalCells = Math.max(1, rows * cols);
  const dirtyCells: RetroScreenBitmapDirtyCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!previous || previous[row]?.[col] !== next[row]?.[col]) {
        dirtyCells.push({ row, col });
      }
    }
  }

  if (previous) {
    for (let row = rows; row < previous.length; row += 1) {
      for (let col = 0; col < (previous[row]?.length ?? 0); col += 1) {
        dirtyCells.push({ row, col });
      }
    }
  }

  return {
    dirtyCells,
    dirtyRatio: Math.min(1, dirtyCells.length / totalCells),
    changed: dirtyCells.length > 0
  };
};

export const mergeBitmapDirtyBounds = (
  dirtyCells: readonly RetroScreenBitmapDirtyCell[],
  glyphWidth: number,
  glyphHeight: number
) => {
  if (dirtyCells.length === 0) {
    return null;
  }

  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;

  for (const cell of dirtyCells) {
    minRow = Math.min(minRow, cell.row);
    maxRow = Math.max(maxRow, cell.row);
    minCol = Math.min(minCol, cell.col);
    maxCol = Math.max(maxCol, cell.col);
  }

  return {
    x: minCol * glyphWidth,
    y: minRow * glyphHeight,
    width: (maxCol - minCol + 1) * glyphWidth,
    height: (maxRow - minRow + 1) * glyphHeight
  };
};
