import { useEffect, useMemo, useRef, useState } from "react";
import {
  createRetroScreenAnsiFrameStream,
  type RetroScreenAnsiByteChunk,
  type RetroScreenAnsiMetadata
} from "../core/ansi/player";
import type {
  RetroScreenAnsiSnapshotStorageMode,
  RetroScreenAnsiViewportWindow
} from "../core/ansi/snapshot-contract";

export type RetroScreenAnsiPlayerState = {
  displayValue: string;
  frameIndex: number;
  frameCount: number;
  isComplete: boolean;
  isStreaming: boolean;
  sourceRows?: number;
  sourceCols?: number;
  viewport?: RetroScreenAnsiViewportWindow;
  metadata?: RetroScreenAnsiMetadata | null;
  storageMode?: RetroScreenAnsiSnapshotStorageMode;
};

type UseRetroScreenAnsiPlayerArgs = {
  byteStream?: readonly RetroScreenAnsiByteChunk[];
  rows: number;
  cols: number;
  frameDelayMs?: number;
  loop?: boolean;
  complete?: boolean;
  loadingValue?: string;
};

type PlaybackSnapshot = {
  completedFrames: readonly string[];
  currentFrame: string;
};

const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  completedFrames: [],
  currentFrame: ""
};

export const useRetroScreenAnsiPlayer = ({
  byteStream = [],
  rows,
  cols,
  frameDelayMs = 72,
  loop = false,
  complete = false,
  loadingValue = "Loading ANSI stream..."
}: UseRetroScreenAnsiPlayerArgs): RetroScreenAnsiPlayerState => {
  const normalizedRows = Math.max(1, Math.floor(rows));
  const normalizedCols = Math.max(1, Math.floor(cols));
  const decoderRef = useRef(
    createRetroScreenAnsiFrameStream({
      rows: normalizedRows,
      cols: normalizedCols
    })
  );
  const processedChunkCountRef = useRef(0);
  const playbackStartedAtRef = useRef(0);
  const playbackSnapshotRef = useRef<PlaybackSnapshot>(EMPTY_SNAPSHOT);
  const [playbackTick, setPlaybackTick] = useState(0);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => {
    decoderRef.current = createRetroScreenAnsiFrameStream({
      rows: normalizedRows,
      cols: normalizedCols
    });
    processedChunkCountRef.current = 0;
    playbackStartedAtRef.current = performance.now();
    playbackSnapshotRef.current = EMPTY_SNAPSHOT;
    setPlaybackTick(0);
    setSnapshotVersion((current) => current + 1);
    setResetVersion((current) => current + 1);
  }, [normalizedCols, normalizedRows]);

  useEffect(() => {
    if (byteStream.length < processedChunkCountRef.current) {
      decoderRef.current.reset();
      processedChunkCountRef.current = 0;
      playbackStartedAtRef.current = performance.now();
      playbackSnapshotRef.current = EMPTY_SNAPSHOT;
      setPlaybackTick(0);
      setSnapshotVersion((current) => current + 1);
      setResetVersion((current) => current + 1);
    }

    const decoder = decoderRef.current;

    for (let index = processedChunkCountRef.current; index < byteStream.length; index += 1) {
      decoder.appendChunk(byteStream[index]!);
    }

    processedChunkCountRef.current = byteStream.length;
    playbackSnapshotRef.current = decoder.getSnapshot();
    setSnapshotVersion((current) => current + 1);
  }, [byteStream]);

  useEffect(() => {
    const playbackSnapshot = playbackSnapshotRef.current;
    const hasPlayableFrames = playbackSnapshot.completedFrames.length > 0;
    const hasCurrentFrame = playbackSnapshot.currentFrame.trim().length > 0;

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
    const finalFrameIncluded = complete && playbackSnapshot.currentFrame.length > 0;
    const frameCount =
      playbackSnapshot.completedFrames.length + (finalFrameIncluded ? 1 : 0);

    if (frameCount === 0) {
      return {
        displayValue:
          playbackSnapshot.currentFrame.trim().length > 0
            ? playbackSnapshot.currentFrame
            : loadingValue,
        frameIndex: 0,
        frameCount,
        isComplete: complete,
        isStreaming: !complete
      } satisfies RetroScreenAnsiPlayerState;
    }

    const boundedFrameIndex =
      complete && loop
        ? playbackTick % frameCount
        : Math.min(playbackTick, frameCount - 1);

    const displayValue =
      !complete && playbackTick >= frameCount
        ? playbackSnapshot.currentFrame || playbackSnapshot.completedFrames[frameCount - 1]!
        : finalFrameIncluded && boundedFrameIndex === playbackSnapshot.completedFrames.length
          ? playbackSnapshot.currentFrame
          : playbackSnapshot.completedFrames[boundedFrameIndex] ??
            playbackSnapshot.currentFrame ??
            loadingValue;

    return {
      displayValue,
      frameIndex: boundedFrameIndex,
      frameCount,
      isComplete: complete,
      isStreaming: !complete
    } satisfies RetroScreenAnsiPlayerState;
  }, [complete, loadingValue, loop, playbackTick, snapshotVersion]);
};
