import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRetroScreenAnsiBytePlaybackEngine } from "../core/ansi/byte-playback-engine";
import type { RetroScreenAnsiBytePlaybackState } from "../core/ansi/byte-playback-types";
import type {
  RetroScreenAnsiByteChunk,
  RetroScreenAnsiControlCharacterMode,
  RetroScreenAnsiMetadata,
  RetroScreenAnsiScrollMode,
  RetroScreenAnsiSnapshotFrame,
  RetroScreenAnsiWrapMode
} from "../core/ansi/player";
import type { RetroScreenAnsiSnapshotStorageMode } from "../core/ansi/snapshot-contract";

export type RetroScreenAnsiBytePlayerState = RetroScreenAnsiBytePlaybackState & {
  frameSnapshot: RetroScreenAnsiSnapshotFrame;
  sourceRows: number;
  sourceCols: number;
  metadata: RetroScreenAnsiMetadata | null;
  storageMode: RetroScreenAnsiSnapshotStorageMode;
};

export type RetroScreenAnsiBytePlayerControls = {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  drain: () => void;
  setBaud: (baud: number) => void;
};

type UseRetroScreenAnsiBytePlayerArgs = {
  byteStream?: readonly RetroScreenAnsiByteChunk[];
  rows: number;
  cols: number;
  metadata?: RetroScreenAnsiMetadata | null;
  baud?: number;
  autoplay?: boolean;
  loop?: boolean;
  complete?: boolean;
  drain?: boolean;
  storageMode?: RetroScreenAnsiSnapshotStorageMode;
  controlCharacterMode?: RetroScreenAnsiControlCharacterMode;
  scrollMode?: RetroScreenAnsiScrollMode;
  wrapMode?: RetroScreenAnsiWrapMode;
  blinkIntervalMs?: number;
};

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

export const useRetroScreenAnsiBytePlayer = ({
  byteStream = [],
  rows,
  cols,
  metadata = null,
  baud = 14_400,
  autoplay = true,
  loop = false,
  complete = false,
  drain = false,
  storageMode = "eager",
  controlCharacterMode = "ansi",
  scrollMode = "terminal",
  wrapMode = "xterm-delayed",
  blinkIntervalMs = 250
}: UseRetroScreenAnsiBytePlayerArgs): RetroScreenAnsiBytePlayerState &
  RetroScreenAnsiBytePlayerControls => {
  const normalizedRows = Math.max(1, Math.floor(rows));
  const normalizedCols = Math.max(1, Math.floor(cols));
  const metadataKey = JSON.stringify(metadata);
  const createEngine = useCallback(
    () =>
      createRetroScreenAnsiBytePlaybackEngine({
        rows: normalizedRows,
        cols: normalizedCols,
        metadata,
        baud,
        autoplay,
        storageMode,
        controlCharacterMode,
        scrollMode,
        wrapMode,
        blinkIntervalMs
      }),
    [
      autoplay,
      baud,
      blinkIntervalMs,
      controlCharacterMode,
      metadataKey,
      normalizedCols,
      normalizedRows,
      scrollMode,
      storageMode,
      wrapMode
    ]
  );
  const engineRef = useRef(createEngine());
  const processedChunkCountRef = useRef(0);
  const sourceClosedRef = useRef(false);
  const lastTickAtRef = useRef(now());
  const [publicationVersion, setPublicationVersion] = useState(0);
  const [sourceVersion, setSourceVersion] = useState(0);

  const publish = useCallback(() => {
    setPublicationVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    engineRef.current = createEngine();
    processedChunkCountRef.current = 0;
    sourceClosedRef.current = false;
    lastTickAtRef.current = now();
    setSourceVersion((current) => current + 1);
    publish();
  }, [createEngine, publish]);

  useEffect(() => {
    const engine = engineRef.current;

    if (byteStream.length < processedChunkCountRef.current) {
      engine.reset();
      processedChunkCountRef.current = 0;
      sourceClosedRef.current = false;
    }

    for (let index = processedChunkCountRef.current; index < byteStream.length; index += 1) {
      engine.appendSource(byteStream[index]!);
    }

    processedChunkCountRef.current = byteStream.length;

    if (complete && !sourceClosedRef.current) {
      engine.closeSource();
      sourceClosedRef.current = true;
    }

    if (drain) {
      engine.drain();
    }

    lastTickAtRef.current = now();
    setSourceVersion((current) => current + 1);
    publish();
  }, [byteStream, complete, drain, publish]);

  useEffect(() => {
    if (drain) {
      return;
    }

    let active = true;
    let rafId = 0;

    const tick = (timestamp: number) => {
      if (!active) {
        return;
      }

      const engine = engineRef.current;
      const elapsedMs = Math.max(0, timestamp - lastTickAtRef.current);
      lastTickAtRef.current = timestamp;
      let state = engine.advanceTime(elapsedMs);

      if (state.status === "complete" && loop) {
        state = engine.loop();
      }

      publish();

      if (state.status === "complete" || state.status === "paused" || state.status === "buffering") {
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const state = engineRef.current.getPlaybackState();

    if (state.status !== "complete" && state.status !== "paused" && state.status !== "buffering") {
      lastTickAtRef.current = now();
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      active = false;
      window.cancelAnimationFrame(rafId);
    };
  }, [drain, loop, publish, sourceVersion]);

  const runControl = useCallback((operation: () => unknown) => {
    operation();
    lastTickAtRef.current = now();
    setSourceVersion((current) => current + 1);
    publish();
  }, [publish]);

  const controls = useMemo<RetroScreenAnsiBytePlayerControls>(() => ({
    pause: () => runControl(() => engineRef.current.pause()),
    resume: () => runControl(() => engineRef.current.resume()),
    restart: () => runControl(() => engineRef.current.restart()),
    drain: () => runControl(() => engineRef.current.drain()),
    setBaud: (nextBaud) => runControl(() => engineRef.current.setBaud(nextBaud))
  }), [runControl]);

  return useMemo(() => {
    const engine = engineRef.current;

    return {
      ...engine.getPlaybackState(),
      frameSnapshot: engine.getScreenSnapshot(),
      sourceRows: normalizedRows,
      sourceCols: normalizedCols,
      metadata,
      storageMode,
      ...controls
    };
  }, [controls, metadataKey, normalizedCols, normalizedRows, publicationVersion, storageMode]);
};
