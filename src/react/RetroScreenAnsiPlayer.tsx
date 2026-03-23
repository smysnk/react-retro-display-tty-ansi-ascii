import { useEffect, useRef, type ComponentProps } from "react";
import { RetroScreen } from "./RetroScreen";
import {
  type RetroScreenAnsiPlayerState
} from "./useRetroScreenAnsiPlayer";
import { useRetroScreenAnsiSnapshotPlayer } from "./useRetroScreenAnsiSnapshotPlayer";
import type { RetroScreenAnsiByteChunk } from "../core/ansi/player";

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
  const notifiedPlaybackStateRef = useRef<RetroScreenAnsiPlayerState | null>(null);

  useEffect(() => {
    const previousPlaybackState = notifiedPlaybackStateRef.current;
    const changed =
      previousPlaybackState === null ||
      previousPlaybackState.displayValue !== playbackState.displayValue ||
      previousPlaybackState.frameIndex !== playbackState.frameIndex ||
      previousPlaybackState.frameCount !== playbackState.frameCount ||
      previousPlaybackState.isComplete !== playbackState.isComplete ||
      previousPlaybackState.isStreaming !== playbackState.isStreaming;

    if (!changed) {
      return;
    }

    const nextPlaybackState: RetroScreenAnsiPlayerState = {
      displayValue: playbackState.displayValue,
      frameIndex: playbackState.frameIndex,
      frameCount: playbackState.frameCount,
      isComplete: playbackState.isComplete,
      isStreaming: playbackState.isStreaming
    };

    notifiedPlaybackStateRef.current = nextPlaybackState;
    onPlaybackStateChange?.(nextPlaybackState);
  }, [onPlaybackStateChange, playbackState]);

  const hasFullCellFrame =
    Boolean(playbackState.frameSnapshot.cells) &&
    playbackState.frameSnapshot.cells?.length === rows &&
    playbackState.frameSnapshot.cells?.every((line) => line.length === cols);

  return (
    <RetroScreen
      {...screenProps}
      cells={hasFullCellFrame ? playbackState.frameSnapshot.cells : undefined}
      mode="value"
      value={playbackState.displayValue}
      gridMode="static"
      rows={rows}
      cols={cols}
    />
  );
}
