import { useEffect, useMemo, useRef, useState } from "react";
import {
  createRetroScreenAnsiSnapshotStream,
  type RetroScreenAnsiByteChunk,
  type RetroScreenAnsiMetadata,
  type RetroScreenAnsiSnapshotFrame,
  type RetroScreenAnsiSnapshotStreamSnapshot
} from "../core/ansi/player";
import {
  resolveRetroScreenAnsiSourceGeometry,
  type RetroScreenAnsiFrameSnapshot,
  type RetroScreenAnsiGeometryPolicy,
  type RetroScreenAnsiSnapshotStorageMode
} from "../core/ansi/snapshot-contract";

export type RetroScreenAnsiSnapshotPlayerState = {
  displayValue: string;
  frameIndex: number;
  frameCount: number;
  isComplete: boolean;
  isStreaming: boolean;
  sourceRows: number;
  sourceCols: number;
  storageMode: RetroScreenAnsiSnapshotStorageMode;
  lines: readonly string[];
  metadata: RetroScreenAnsiMetadata | null;
  frameSnapshot: RetroScreenAnsiFrameSnapshot;
};

type UseRetroScreenAnsiSnapshotPlayerArgs = {
  byteStream?: readonly RetroScreenAnsiByteChunk[];
  metadata?: RetroScreenAnsiMetadata | null;
  policy?: RetroScreenAnsiGeometryPolicy;
  frameDelayMs?: number;
  loop?: boolean;
  complete?: boolean;
  loadingValue?: string;
};

const PREVIEW_ROWS = 25;
const PREVIEW_COLS = 80;
const EMPTY_FRAME: RetroScreenAnsiSnapshotFrame = {
  lines: [],
  text: "",
  storageMode: "eager",
  getLineSlice() {
    return "";
  },
  getCellSlice() {
    return [];
  }
};

const createLoadingFrameSnapshot = ({
  loadingValue,
  sourceRows,
  sourceCols,
  frameCount,
  isComplete,
  isStreaming,
  storageMode,
  metadata
}: {
  loadingValue: string;
  sourceRows: number;
  sourceCols: number;
  frameCount: number;
  isComplete: boolean;
  isStreaming: boolean;
  storageMode: RetroScreenAnsiSnapshotStorageMode;
  metadata: RetroScreenAnsiMetadata | null;
}): RetroScreenAnsiFrameSnapshot => {
  const loadingLines = loadingValue.split("\n");

  return {
    sourceRows,
    sourceCols,
    frameIndex: 0,
    frameCount,
    isComplete,
    isStreaming,
    storageMode,
    lines: loadingLines,
    metadata,
    getLineSlice(rowIndex, startCol, endCol) {
      const sourceLine = loadingLines[rowIndex] ?? "";
      const normalizedStart = Math.max(0, Math.floor(startCol || 0));
      const normalizedEnd = Math.max(
        normalizedStart,
        Math.floor(endCol || normalizedStart)
      );
      const sliceLength = Math.max(0, normalizedEnd - normalizedStart);

      return sourceLine.slice(normalizedStart, normalizedEnd).padEnd(sliceLength, " ");
    },
    getCellSlice(rowIndex, startCol, endCol) {
      const normalizedStart = Math.max(0, Math.floor(startCol || 0));
      const normalizedEnd = Math.max(
        normalizedStart,
        Math.floor(endCol || normalizedStart)
      );

      return Array.from(
        { length: Math.max(0, normalizedEnd - normalizedStart) },
        (_, cellIndex) => ({
          char: loadingLines[rowIndex]?.[normalizedStart + cellIndex] ?? " ",
          style: {
            intensity: "normal",
            bold: false,
            faint: false,
            inverse: false,
            conceal: false,
            blink: false,
            foreground: {
              mode: "default",
              value: 0
            },
            background: {
              mode: "default",
              value: 0
            }
          }
        })
      );
    }
  };
};

const createEmptySnapshot = ({
  sourceRows,
  sourceCols,
  metadata,
  storageMode
}: {
  sourceRows: number;
  sourceCols: number;
  metadata: RetroScreenAnsiMetadata | null;
  storageMode: RetroScreenAnsiSnapshotStorageMode;
}): RetroScreenAnsiSnapshotStreamSnapshot => ({
  completedFrames: [],
  currentFrame: EMPTY_FRAME,
  sourceRows,
  sourceCols,
  metadata,
  storageMode
});

const buildPlayerFrameSnapshot = ({
  frame,
  sourceRows,
  sourceCols,
  frameIndex,
  frameCount,
  isComplete,
  isStreaming,
  metadata
}: {
  frame: RetroScreenAnsiSnapshotFrame;
  sourceRows: number;
  sourceCols: number;
  frameIndex: number;
  frameCount: number;
  isComplete: boolean;
  isStreaming: boolean;
  metadata: RetroScreenAnsiMetadata | null;
}): RetroScreenAnsiFrameSnapshot => ({
  sourceRows,
  sourceCols,
  frameIndex,
  frameCount,
  isComplete,
  isStreaming,
  storageMode: frame.storageMode,
  lines: [...frame.lines],
  cells: frame.cells ? frame.cells.map((row) => row.map((cell) => ({ char: cell.char, style: cell.style }))) : undefined,
  metadata,
  getLineSlice: frame.getLineSlice,
  getCellSlice: frame.getCellSlice
});

const buildFramePreviewLines = ({
  frame,
  sourceRows,
  sourceCols,
  previewRows = PREVIEW_ROWS,
  previewCols = PREVIEW_COLS
}: {
  frame: RetroScreenAnsiSnapshotFrame;
  sourceRows: number;
  sourceCols: number;
  previewRows?: number;
  previewCols?: number;
}) => {
  if (frame.lines.length > 0) {
    return [...frame.lines];
  }

  const resolvedRows = Math.min(sourceRows, Math.max(1, Math.floor(previewRows || PREVIEW_ROWS)));
  const resolvedCols = Math.min(sourceCols, Math.max(1, Math.floor(previewCols || PREVIEW_COLS)));

  return Array.from({ length: resolvedRows }, (_, rowIndex) =>
    frame.getLineSlice(rowIndex, 0, resolvedCols)
  );
};

export const useRetroScreenAnsiSnapshotPlayer = ({
  byteStream = [],
  metadata = null,
  policy,
  frameDelayMs = 72,
  loop = false,
  complete = false,
  loadingValue = "Loading ANSI stream..."
}: UseRetroScreenAnsiSnapshotPlayerArgs): RetroScreenAnsiSnapshotPlayerState => {
  const normalizedMetadata = useMemo(
    () =>
      metadata
        ? {
            title: metadata.title,
            author: metadata.author,
            group: metadata.group,
            font: metadata.font,
            width: metadata.width,
            height: metadata.height
          }
        : null,
    [
      metadata?.author,
      metadata?.font,
      metadata?.group,
      metadata?.height,
      metadata?.title,
      metadata?.width
    ]
  );
  const sourceGeometry = useMemo(
    () => resolveRetroScreenAnsiSourceGeometry({ metadata: normalizedMetadata, policy }),
    [normalizedMetadata, policy]
  );
  const decoderRef = useRef(
    createRetroScreenAnsiSnapshotStream({
      rows: sourceGeometry.rows,
      cols: sourceGeometry.cols,
      metadata: normalizedMetadata,
      storageMode: sourceGeometry.storageMode
    })
  );
  const processedChunkCountRef = useRef(0);
  const playbackStartedAtRef = useRef(0);
  const playbackSnapshotRef = useRef<RetroScreenAnsiSnapshotStreamSnapshot>(
    createEmptySnapshot({
      sourceRows: sourceGeometry.rows,
      sourceCols: sourceGeometry.cols,
      metadata: normalizedMetadata,
      storageMode: sourceGeometry.storageMode
    })
  );
  const [playbackTick, setPlaybackTick] = useState(0);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => {
    decoderRef.current = createRetroScreenAnsiSnapshotStream({
      rows: sourceGeometry.rows,
      cols: sourceGeometry.cols,
      metadata: normalizedMetadata,
      storageMode: sourceGeometry.storageMode
    });
    processedChunkCountRef.current = 0;
    playbackStartedAtRef.current = performance.now();
    playbackSnapshotRef.current = createEmptySnapshot({
      sourceRows: sourceGeometry.rows,
      sourceCols: sourceGeometry.cols,
      metadata: normalizedMetadata,
      storageMode: sourceGeometry.storageMode
    });
    setPlaybackTick(0);
    setSnapshotVersion((current) => current + 1);
    setResetVersion((current) => current + 1);
  }, [
    normalizedMetadata,
    sourceGeometry.cols,
    sourceGeometry.rows,
    sourceGeometry.storageMode
  ]);

  useEffect(() => {
    const previousProcessedChunkCount = processedChunkCountRef.current;
    let didReset = false;

    if (byteStream.length < processedChunkCountRef.current) {
      decoderRef.current.reset();
      processedChunkCountRef.current = 0;
      playbackStartedAtRef.current = performance.now();
      playbackSnapshotRef.current = createEmptySnapshot({
        sourceRows: sourceGeometry.rows,
        sourceCols: sourceGeometry.cols,
        metadata: normalizedMetadata,
        storageMode: sourceGeometry.storageMode
      });
      setPlaybackTick(0);
      setSnapshotVersion((current) => current + 1);
      setResetVersion((current) => current + 1);
      didReset = true;
    }

    const decoder = decoderRef.current;

    for (let index = processedChunkCountRef.current; index < byteStream.length; index += 1) {
      decoder.appendChunk(byteStream[index]!);
    }

    const didProcessChunks = byteStream.length !== previousProcessedChunkCount;
    processedChunkCountRef.current = byteStream.length;
    if (didReset || didProcessChunks) {
      playbackSnapshotRef.current = decoder.getSnapshot();
      setSnapshotVersion((current) => current + 1);
    }
  }, [
    byteStream,
    normalizedMetadata,
    sourceGeometry.cols,
    sourceGeometry.rows,
    sourceGeometry.storageMode
  ]);

  useEffect(() => {
    const playbackSnapshot = playbackSnapshotRef.current;
    const hasPlayableFrames = playbackSnapshot.completedFrames.length > 0;
    const hasCurrentFrame = playbackSnapshot.currentFrame.text.trim().length > 0;

    if (!hasPlayableFrames && !hasCurrentFrame) {
      return;
    }

    let active = true;
    let rafId = 0;

    const tick = () => {
      if (!active) {
        return;
      }

      const elapsed = performance.now() - playbackStartedAtRef.current;
      const nextTick = Math.max(0, Math.floor(elapsed / Math.max(1, frameDelayMs)));

      setPlaybackTick((current) => (current === nextTick ? current : nextTick));
      rafId = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      active = false;
      window.cancelAnimationFrame(rafId);
    };
  }, [frameDelayMs, resetVersion, snapshotVersion]);

  return useMemo(() => {
    const playbackSnapshot = playbackSnapshotRef.current;
    const finalFrameIncluded = complete && playbackSnapshot.currentFrame.text.length > 0;
    const frameCount =
      playbackSnapshot.completedFrames.length + (finalFrameIncluded ? 1 : 0);

    if (frameCount === 0) {
      const hasCurrentFrame = playbackSnapshot.currentFrame.text.trim().length > 0;
      const frameSnapshot = hasCurrentFrame
        ? buildPlayerFrameSnapshot({
            frame: playbackSnapshot.currentFrame,
            sourceRows: playbackSnapshot.sourceRows,
            sourceCols: playbackSnapshot.sourceCols,
            frameIndex: 0,
            frameCount,
            isComplete: complete,
            isStreaming: !complete,
            metadata: playbackSnapshot.metadata
          })
        : createLoadingFrameSnapshot({
            loadingValue,
            sourceRows: sourceGeometry.rows,
            sourceCols: sourceGeometry.cols,
            frameCount,
            isComplete: complete,
            isStreaming: !complete,
            storageMode: sourceGeometry.storageMode,
            metadata: normalizedMetadata
          });

      return {
        displayValue: hasCurrentFrame ? playbackSnapshot.currentFrame.text : loadingValue,
        frameIndex: 0,
        frameCount,
        isComplete: complete,
        isStreaming: !complete,
        sourceRows: hasCurrentFrame ? playbackSnapshot.sourceRows : sourceGeometry.rows,
        sourceCols: hasCurrentFrame ? playbackSnapshot.sourceCols : sourceGeometry.cols,
        storageMode: hasCurrentFrame ? playbackSnapshot.storageMode : sourceGeometry.storageMode,
        lines: frameSnapshot.lines,
        metadata: hasCurrentFrame ? playbackSnapshot.metadata : normalizedMetadata,
        frameSnapshot
      } satisfies RetroScreenAnsiSnapshotPlayerState;
    }

    const boundedFrameIndex =
      complete && loop
        ? playbackTick % frameCount
        : Math.min(playbackTick, frameCount - 1);

    const displayFrame =
      !complete && playbackTick >= frameCount
        ? playbackSnapshot.currentFrame
        : finalFrameIncluded && boundedFrameIndex === playbackSnapshot.completedFrames.length
          ? playbackSnapshot.currentFrame
          : playbackSnapshot.completedFrames[boundedFrameIndex] ?? playbackSnapshot.currentFrame;
    const previewLines = buildFramePreviewLines({
      frame: displayFrame,
      sourceRows: playbackSnapshot.sourceRows,
      sourceCols: playbackSnapshot.sourceCols
    });

    return {
      displayValue: displayFrame.text || previewLines.join("\n") || loadingValue,
      frameIndex: boundedFrameIndex,
      frameCount,
      isComplete: complete,
      isStreaming: !complete,
      sourceRows: playbackSnapshot.sourceRows,
      sourceCols: playbackSnapshot.sourceCols,
      storageMode: playbackSnapshot.storageMode,
      lines: previewLines,
      metadata: playbackSnapshot.metadata,
      frameSnapshot: buildPlayerFrameSnapshot({
        frame: displayFrame,
        sourceRows: playbackSnapshot.sourceRows,
        sourceCols: playbackSnapshot.sourceCols,
        frameIndex: boundedFrameIndex,
        frameCount,
        isComplete: complete,
        isStreaming: !complete,
        metadata: playbackSnapshot.metadata
      })
    } satisfies RetroScreenAnsiSnapshotPlayerState;
  }, [
    complete,
    loadingValue,
    loop,
    normalizedMetadata,
    playbackTick,
    snapshotVersion,
    sourceGeometry.cols,
    sourceGeometry.rows,
    sourceGeometry.storageMode
  ]);
};
