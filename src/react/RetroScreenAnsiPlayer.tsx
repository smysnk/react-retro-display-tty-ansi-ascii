import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import { RetroScreen } from "./RetroScreen";
import { ansiSnapshotToRenderModelWindow } from "./retro-screen-render-model";
import {
  type RetroScreenAnsiPlayerState
} from "./useRetroScreenAnsiPlayer";
import { useRetroScreenAnsiSnapshotPlayer } from "./useRetroScreenAnsiSnapshotPlayer";
import type { RetroScreenAnsiByteChunk } from "../core/ansi/player";
import { normalizeRetroScreenAnsiViewportWindow } from "../core/ansi/snapshot-contract";

export type RetroScreenAnsiPlayerProps = Omit<
  ComponentProps<typeof RetroScreen>,
  "mode" | "value" | "gridMode" | "rows" | "cols"
> & {
  byteStream?: readonly RetroScreenAnsiByteChunk[];
  rows: number;
  cols: number;
  frameDelayMs?: number;
  loop?: boolean;
  complete?: boolean;
  loadingValue?: string;
  viewportRows?: number;
  viewportCols?: number;
  viewportRowOffset?: number;
  viewportColOffset?: number;
  onPlaybackStateChange?: (state: RetroScreenAnsiPlayerState) => void;
};

export function RetroScreenAnsiPlayer({
  byteStream = [],
  rows,
  cols,
  frameDelayMs,
  loop,
  complete,
  loadingValue,
  viewportRows,
  viewportCols,
  viewportRowOffset = 0,
  viewportColOffset = 0,
  onPlaybackStateChange,
  ...screenProps
}: RetroScreenAnsiPlayerProps) {
  const playbackState = useRetroScreenAnsiSnapshotPlayer({
    byteStream,
    metadata: {
      title: "ANSI Stream",
      author: "Unknown",
      group: "Unknown",
      font: "IBM VGA",
      width: cols,
      height: rows
    },
    frameDelayMs,
    loop,
    complete,
    loadingValue
  });
  const viewport = useMemo(
    () =>
      normalizeRetroScreenAnsiViewportWindow({
        sourceRows: playbackState.sourceRows,
        sourceCols: playbackState.sourceCols,
        rowOffset: viewportRowOffset,
        colOffset: viewportColOffset,
        rows: viewportRows ?? rows,
        cols: viewportCols ?? cols
      }),
    [
      cols,
      playbackState.sourceCols,
      playbackState.sourceRows,
      rows,
      viewportColOffset,
      viewportCols,
      viewportRowOffset,
      viewportRows
    ]
  );
  const viewportRenderModel = useMemo(
    () =>
      ansiSnapshotToRenderModelWindow(playbackState.frameSnapshot, {
        rowOffset: viewport.rowOffset,
        colOffset: viewport.colOffset,
        rows: viewport.rows,
        cols: viewport.cols
      }),
    [
      playbackState.frameSnapshot,
      viewport.colOffset,
      viewport.cols,
      viewport.rowOffset,
      viewport.rows
    ]
  );
  const notifiedPlaybackStateRef = useRef<RetroScreenAnsiPlayerState | null>(null);

  useEffect(() => {
    const previousPlaybackState = notifiedPlaybackStateRef.current;
    const changed =
      previousPlaybackState === null ||
      previousPlaybackState.displayValue !== viewportRenderModel.lines.join("\n") ||
      previousPlaybackState.frameIndex !== playbackState.frameIndex ||
      previousPlaybackState.frameCount !== playbackState.frameCount ||
      previousPlaybackState.isComplete !== playbackState.isComplete ||
      previousPlaybackState.isStreaming !== playbackState.isStreaming ||
      previousPlaybackState.sourceRows !== playbackState.sourceRows ||
      previousPlaybackState.sourceCols !== playbackState.sourceCols ||
      previousPlaybackState.storageMode !== playbackState.storageMode ||
      previousPlaybackState.metadata !== playbackState.metadata ||
      previousPlaybackState.viewport?.rowOffset !== viewport.rowOffset ||
      previousPlaybackState.viewport?.colOffset !== viewport.colOffset ||
      previousPlaybackState.viewport?.rows !== viewport.rows ||
      previousPlaybackState.viewport?.cols !== viewport.cols ||
      previousPlaybackState.viewport?.maxRowOffset !== viewport.maxRowOffset ||
      previousPlaybackState.viewport?.maxColOffset !== viewport.maxColOffset;

    if (!changed) {
      return;
    }

    const nextPlaybackState: RetroScreenAnsiPlayerState = {
      displayValue: viewportRenderModel.lines.join("\n"),
      frameIndex: playbackState.frameIndex,
      frameCount: playbackState.frameCount,
      isComplete: playbackState.isComplete,
      isStreaming: playbackState.isStreaming,
      sourceRows: playbackState.sourceRows,
      sourceCols: playbackState.sourceCols,
      viewport,
      metadata: playbackState.metadata,
      storageMode: playbackState.storageMode
    };

    notifiedPlaybackStateRef.current = nextPlaybackState;
    onPlaybackStateChange?.(nextPlaybackState);
  }, [onPlaybackStateChange, playbackState, viewport, viewportRenderModel.lines]);

  return (
    <RetroScreen
      {...screenProps}
      cells={viewportRenderModel.cells}
      mode="value"
      value={viewportRenderModel.lines.join("\n")}
      gridMode="static"
      rows={viewport.rows}
      cols={viewport.cols}
    />
  );
}
