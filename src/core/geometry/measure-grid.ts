import type { RetroScreenGeometry } from "../types";

export type MeasureGridInput = {
  innerWidth: number;
  innerHeight: number;
  cellWidth: number;
  cellHeight: number;
  fontSize?: number;
};

export type MeasureStaticGridInput = {
  innerWidth: number;
  innerHeight: number;
  rows: number;
  cols: number;
  fontWidthRatio: number;
  fontHeightRatio: number;
  fitStrategy?: "contain" | "width";
};

export const measureGrid = ({
  innerWidth,
  innerHeight,
  cellWidth,
  cellHeight,
  fontSize
}: MeasureGridInput): RetroScreenGeometry => ({
  rows: Math.max(1, Math.floor(innerHeight / Math.max(1, cellHeight))),
  cols: Math.max(1, Math.floor(innerWidth / Math.max(1, cellWidth))),
  cellWidth,
  cellHeight,
  innerWidth,
  innerHeight,
  fontSize: Math.max(1, fontSize ?? cellHeight)
});

export const measureStaticGrid = ({
  innerWidth,
  innerHeight,
  rows,
  cols,
  fontWidthRatio,
  fontHeightRatio,
  fitStrategy = "contain"
}: MeasureStaticGridInput): RetroScreenGeometry => {
  const resolvedRows = Math.max(1, Math.floor(rows));
  const resolvedCols = Math.max(1, Math.floor(cols));
  const maxCellWidth = Math.max(1, Math.floor(innerWidth / resolvedCols));
  const maxCellHeight = Math.max(1, Math.floor(innerHeight / resolvedRows));
  const widthRatio = Math.max(0.01, fontWidthRatio);
  const heightRatio = Math.max(0.01, fontHeightRatio);
  const widthLimitedFontSize = Math.max(1, Math.floor(maxCellWidth / widthRatio));
  const containLimitedFontSize = Math.max(
    1,
    Math.floor(Math.min(maxCellWidth / widthRatio, maxCellHeight / heightRatio))
  );
  const fontSize =
    fitStrategy === "width"
      ? widthLimitedFontSize
      : containLimitedFontSize;
  const cellWidth = Math.max(1, Math.floor(fontSize * widthRatio));
  const cellHeight = Math.max(1, Math.floor(fontSize * heightRatio));

  return {
    rows: resolvedRows,
    cols: resolvedCols,
    cellWidth,
    cellHeight,
    innerWidth,
    innerHeight,
    fontSize
  };
};
