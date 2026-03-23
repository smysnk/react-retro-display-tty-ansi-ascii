import type { RetroScreenCell } from "../terminal/types";
import type { RetroScreenAnsiMetadata } from "./player";

export type RetroScreenAnsiGeometrySource = "sauce" | "fallback";
export type RetroScreenAnsiSnapshotStorageMode = "eager" | "sparse";

export type RetroScreenAnsiGeometryPolicy = {
  fallbackRows: number;
  fallbackCols: number;
  viewportRows: number;
  viewportCols: number;
  eagerMaxCells: number;
  eagerMaxRows: number;
  eagerMaxCols: number;
  maxDimension: number;
};

export type RetroScreenAnsiSourceGeometry = {
  rows: number;
  cols: number;
  totalCells: number;
  geometrySource: RetroScreenAnsiGeometrySource;
  storageMode: RetroScreenAnsiSnapshotStorageMode;
  metadata: RetroScreenAnsiMetadata | null;
};

export type RetroScreenAnsiViewportWindow = {
  rowOffset: number;
  colOffset: number;
  rows: number;
  cols: number;
  maxRowOffset: number;
  maxColOffset: number;
};

export type RetroScreenAnsiLineSliceAccessor = (
  rowIndex: number,
  startCol: number,
  endCol: number
) => string;

export type RetroScreenAnsiCellSliceAccessor = (
  rowIndex: number,
  startCol: number,
  endCol: number
) => RetroScreenCell[];

export type RetroScreenAnsiFrameSnapshot = {
  sourceRows: number;
  sourceCols: number;
  frameIndex: number;
  frameCount: number;
  isComplete: boolean;
  isStreaming: boolean;
  storageMode?: RetroScreenAnsiSnapshotStorageMode;
  lines: string[];
  cells?: RetroScreenCell[][];
  metadata?: RetroScreenAnsiMetadata | null;
  getLineSlice?: RetroScreenAnsiLineSliceAccessor;
  getCellSlice?: RetroScreenAnsiCellSliceAccessor;
};

export const DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY: Readonly<RetroScreenAnsiGeometryPolicy> =
  Object.freeze({
    fallbackRows: 25,
    fallbackCols: 80,
    viewportRows: 25,
    viewportCols: 80,
    eagerMaxCells: 2_000_000,
    eagerMaxRows: 4_096,
    eagerMaxCols: 4_096,
    maxDimension: 65_535,
  });

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizePositiveInteger = (
  value: number | null | undefined,
  fallback: number,
  max: number,
) => {
  const parsed = Math.floor(Number(value ?? Number.NaN));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return clamp(parsed, 1, max);
};

const hasFinitePositiveGeometry = (value: number | null | undefined) => {
  const parsed = Number(value ?? Number.NaN);
  return Number.isFinite(parsed) && parsed > 0;
};

export const resolveRetroScreenAnsiSourceGeometry = ({
  metadata,
  policy = DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY,
}: {
  metadata?: RetroScreenAnsiMetadata | null;
  policy?: RetroScreenAnsiGeometryPolicy;
} = {}): RetroScreenAnsiSourceGeometry => {
  const rows = normalizePositiveInteger(metadata?.height, policy.fallbackRows, policy.maxDimension);
  const cols = normalizePositiveInteger(metadata?.width, policy.fallbackCols, policy.maxDimension);
  const totalCells = rows * cols;
  const geometrySource =
    hasFinitePositiveGeometry(metadata?.height) || hasFinitePositiveGeometry(metadata?.width)
      ? "sauce"
      : "fallback";

  return {
    rows,
    cols,
    totalCells,
    geometrySource,
    storageMode:
      totalCells > policy.eagerMaxCells ||
      rows > policy.eagerMaxRows ||
      cols > policy.eagerMaxCols
        ? "sparse"
        : "eager",
    metadata: metadata ?? null,
  };
};

export const normalizeRetroScreenAnsiViewportWindow = ({
  sourceRows,
  sourceCols,
  rowOffset = 0,
  colOffset = 0,
  rows = DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY.viewportRows,
  cols = DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY.viewportCols,
}: {
  sourceRows: number;
  sourceCols: number;
  rowOffset?: number;
  colOffset?: number;
  rows?: number;
  cols?: number;
}): RetroScreenAnsiViewportWindow => {
  const normalizedRows = Math.max(1, Math.floor(rows || DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY.viewportRows));
  const normalizedCols = Math.max(1, Math.floor(cols || DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY.viewportCols));
  const normalizedSourceRows = Math.max(1, Math.floor(sourceRows || normalizedRows));
  const normalizedSourceCols = Math.max(1, Math.floor(sourceCols || normalizedCols));
  const maxRowOffset = Math.max(0, normalizedSourceRows - normalizedRows);
  const maxColOffset = Math.max(0, normalizedSourceCols - normalizedCols);

  return {
    rowOffset: clamp(Math.floor(rowOffset || 0), 0, maxRowOffset),
    colOffset: clamp(Math.floor(colOffset || 0), 0, maxColOffset),
    rows: normalizedRows,
    cols: normalizedCols,
    maxRowOffset,
    maxColOffset,
  };
};
