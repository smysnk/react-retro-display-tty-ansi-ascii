import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import type {
  RetroScreenAnsiByteChunk,
  RetroScreenAnsiControlCharacterMode,
  RetroScreenAnsiMetadata,
  RetroScreenAnsiScrollMode,
  RetroScreenAnsiWrapMode
} from "../core/ansi/player";
import type { RetroScreenAnsiSnapshotStorageMode } from "../core/ansi/snapshot-contract";
import { normalizeRetroScreenAnsiViewportWindow } from "../core/ansi/snapshot-contract";
import { RetroScreen } from "./RetroScreen";
import { ansiSnapshotToRenderModelWindow } from "./retro-screen-render-model";
import {
  useRetroScreenAnsiBytePlayer,
  type RetroScreenAnsiBytePlayerState
} from "./useRetroScreenAnsiBytePlayer";

export type RetroScreenAnsiBytePlayerProps = Omit<
  ComponentProps<typeof RetroScreen>,
  "mode" | "value" | "gridMode" | "rows" | "cols" | "cells" | "displayBlinkVisible"
> & {
  byteStream?: readonly RetroScreenAnsiByteChunk[];
  rows: number;
  cols: number;
  metadata?: RetroScreenAnsiMetadata | null;
  baud?: number;
  autoplay?: boolean;
  loop?: boolean;
  complete?: boolean;
  drain?: boolean;
  viewportRows?: number;
  viewportCols?: number;
  viewportRowOffset?: number;
  viewportColOffset?: number;
  storageMode?: RetroScreenAnsiSnapshotStorageMode;
  controlCharacterMode?: RetroScreenAnsiControlCharacterMode;
  scrollMode?: RetroScreenAnsiScrollMode;
  wrapMode?: RetroScreenAnsiWrapMode;
  blinkIntervalMs?: number;
  onPlaybackStateChange?: (state: RetroScreenAnsiBytePlayerState) => void;
};

export function RetroScreenAnsiBytePlayer({
  byteStream = [],
  rows,
  cols,
  metadata = null,
  baud = 14_400,
  autoplay = true,
  loop = false,
  complete = false,
  drain = false,
  viewportRows,
  viewportCols,
  viewportRowOffset = 0,
  viewportColOffset = 0,
  storageMode = "eager",
  controlCharacterMode = "ansi",
  scrollMode = "terminal",
  wrapMode = "xterm-delayed",
  blinkIntervalMs = 250,
  onPlaybackStateChange,
  ...screenProps
}: RetroScreenAnsiBytePlayerProps) {
  const playbackState = useRetroScreenAnsiBytePlayer({
    byteStream,
    rows,
    cols,
    metadata,
    baud,
    autoplay,
    loop,
    complete,
    drain,
    storageMode,
    controlCharacterMode,
    scrollMode,
    wrapMode,
    blinkIntervalMs
  });
  const viewport = useMemo(
    () => normalizeRetroScreenAnsiViewportWindow({
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
    () => ansiSnapshotToRenderModelWindow({
      sourceRows: playbackState.sourceRows,
      sourceCols: playbackState.sourceCols,
      frameIndex: 0,
      frameCount: playbackState.totalBytes === null ? 0 : 1,
      isComplete: playbackState.status === "complete",
      isStreaming: !playbackState.sourceClosed,
      storageMode: playbackState.storageMode,
      lines: [...playbackState.frameSnapshot.lines],
      metadata: playbackState.metadata,
      getLineSlice: playbackState.frameSnapshot.getLineSlice,
      getCellSlice: playbackState.frameSnapshot.getCellSlice
    }, viewport),
    [playbackState, viewport]
  );
  const notifiedStateRef = useRef<RetroScreenAnsiBytePlayerState | null>(null);

  useEffect(() => {
    const previous = notifiedStateRef.current;
    const changed = previous === null ||
      previous.processedBytes !== playbackState.processedBytes ||
      previous.availableBytes !== playbackState.availableBytes ||
      previous.totalBytes !== playbackState.totalBytes ||
      previous.status !== playbackState.status ||
      previous.blinkVisible !== playbackState.blinkVisible ||
      previous.loopCount !== playbackState.loopCount ||
      previous.parserSettled !== playbackState.parserSettled;

    if (changed) {
      notifiedStateRef.current = playbackState;
      onPlaybackStateChange?.(playbackState);
    }
  }, [onPlaybackStateChange, playbackState]);

  return (
    <RetroScreen
      {...screenProps}
      cells={viewportRenderModel.cells}
      mode="value"
      value={viewportRenderModel.lines.join("\n")}
      gridMode="static"
      rows={viewport.rows}
      cols={viewport.cols}
      displayBlinkVisible={playbackState.blinkVisible}
    />
  );
}
