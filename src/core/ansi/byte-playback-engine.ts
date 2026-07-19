import type { RetroScreenAnsiSnapshotStorageMode } from "./snapshot-contract";
import {
  createRetroScreenAnsiSnapshotStream,
  type RetroScreenAnsiByteChunk,
  type RetroScreenAnsiControlCharacterMode,
  type RetroScreenAnsiMetadata,
  type RetroScreenAnsiScrollMode,
  type RetroScreenAnsiSnapshotStream,
  type RetroScreenAnsiWrapMode
} from "./player";
import { createRetroScreenAnsiBytePlaybackClock } from "./byte-playback-clock";
import type {
  RetroScreenAnsiBytePlaybackEngine,
  RetroScreenAnsiBytePlaybackState
} from "./byte-playback-types";

const normalizeChunk = (chunk: RetroScreenAnsiByteChunk) => {
  if (chunk instanceof Uint8Array) {
    return chunk.slice();
  }

  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk.slice(0));
  }

  return Uint8Array.from(chunk);
};

const normalizeByteCount = (count: number) => {
  if (!Number.isFinite(count) || count < 0) {
    throw new RangeError("ANSI playback byte count must be a non-negative finite number.");
  }

  return Math.floor(count);
};

export const createRetroScreenAnsiBytePlaybackEngine = ({
  rows,
  cols,
  metadata = null,
  storageMode = "eager",
  controlCharacterMode = "ansi",
  scrollMode = "terminal",
  wrapMode = "xterm-delayed",
  baud = 14_400,
  autoplay = true,
  blinkIntervalMs = 250
}: {
  rows: number;
  cols: number;
  metadata?: RetroScreenAnsiMetadata | null;
  storageMode?: RetroScreenAnsiSnapshotStorageMode;
  controlCharacterMode?: RetroScreenAnsiControlCharacterMode;
  scrollMode?: RetroScreenAnsiScrollMode;
  wrapMode?: RetroScreenAnsiWrapMode;
  baud?: number;
  autoplay?: boolean;
  blinkIntervalMs?: number;
}): RetroScreenAnsiBytePlaybackEngine => {
  if (!Number.isFinite(blinkIntervalMs) || blinkIntervalMs <= 0) {
    throw new RangeError("ANSI playback blink interval must be a positive finite number.");
  }

  const createStream = (): RetroScreenAnsiSnapshotStream =>
    createRetroScreenAnsiSnapshotStream({
      rows,
      cols,
      metadata,
      storageMode,
      controlCharacterMode,
      scrollMode,
      wrapMode
    });

  let stream = createStream();
  let sourceChunks: Uint8Array[] = [];
  let availableBytes = 0;
  let processedBytes = 0;
  let sourceChunkIndex = 0;
  let sourceChunkOffset = 0;
  let sourceClosed = false;
  let paused = !autoplay;
  let loopCount = 0;
  const clock = createRetroScreenAnsiBytePlaybackClock({ baud, paused });

  const settleIfComplete = () => {
    if (sourceClosed && processedBytes === availableBytes) {
      stream.finalize();
    }
  };

  const peekNextAvailableByte = () => {
    const chunk = sourceChunks[sourceChunkIndex];
    return chunk && sourceChunkOffset < chunk.length
      ? chunk[sourceChunkOffset]
      : undefined;
  };

  const resolveAvailableLookahead = () => {
    const nextByte = peekNextAvailableByte();
    if (nextByte !== undefined) {
      stream.resolveLookahead(nextByte);
    }
  };

  const getPlaybackState = (): RetroScreenAnsiBytePlaybackState => {
    const clockState = clock.getState();
    const parserSettled = stream.isParserSettled();
    const complete =
      sourceClosed && processedBytes === availableBytes && parserSettled;
    const status = complete
      ? "complete"
      : paused
        ? "paused"
        : availableBytes === 0 && processedBytes === 0
          ? "idle"
          : processedBytes >= availableBytes
            ? "buffering"
            : "playing";

    return {
      status,
      baud: clockState.baud,
      availableBytes,
      processedBytes,
      totalBytes: sourceClosed ? availableBytes : null,
      sourceClosed,
      parserSettled,
      elapsedMs: clockState.elapsedMs,
      estimatedDurationMs: sourceClosed
        ? (availableBytes * 8 * 1000) / clockState.baud
        : null,
      loopCount,
      blinkVisible:
        complete || Math.floor(clockState.elapsedMs / blinkIntervalMs) % 2 === 0
    };
  };

  const advanceBytes = (requestedCount: number) => {
    let remaining = Math.min(
      normalizeByteCount(requestedCount),
      availableBytes - processedBytes
    );

    while (remaining > 0) {
      const chunk = sourceChunks[sourceChunkIndex];

      if (!chunk) {
        break;
      }

      const availableInChunk = chunk.length - sourceChunkOffset;
      const consume = Math.min(remaining, availableInChunk);
      stream.writeChunk(chunk.subarray(sourceChunkOffset, sourceChunkOffset + consume));
      sourceChunkOffset += consume;
      processedBytes += consume;
      remaining -= consume;

      if (sourceChunkOffset === chunk.length) {
        sourceChunkIndex += 1;
        sourceChunkOffset = 0;
      }
    }

    resolveAvailableLookahead();
    settleIfComplete();
    return getPlaybackState();
  };

  const resetPlaybackPosition = ({ incrementLoop = false } = {}) => {
    stream.reset();
    sourceChunkIndex = 0;
    sourceChunkOffset = 0;
    processedBytes = 0;
    clock.reset();
    paused = false;

    if (incrementLoop) {
      loopCount += 1;
    } else {
      loopCount = 0;
    }

    settleIfComplete();
    return getPlaybackState();
  };

  return {
    appendSource(chunk) {
      if (sourceClosed) {
        throw new Error("Cannot append ANSI bytes after the source has closed.");
      }

      const normalized = normalizeChunk(chunk);

      if (normalized.length > 0) {
        sourceChunks.push(normalized);
        availableBytes += normalized.length;
        resolveAvailableLookahead();
      }
    },
    closeSource() {
      sourceClosed = true;
      settleIfComplete();
      return getPlaybackState();
    },
    advanceBytes,
    advanceTime(elapsedMs) {
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
        throw new RangeError("ANSI playback elapsed time must be a non-negative finite number.");
      }

      if (paused || (sourceClosed && processedBytes === availableBytes)) {
        settleIfComplete();
        return getPlaybackState();
      }

      if (processedBytes >= availableBytes) {
        return getPlaybackState();
      }

      return advanceBytes(clock.advanceTime(elapsedMs));
    },
    drain() {
      return advanceBytes(availableBytes - processedBytes);
    },
    pause() {
      paused = true;
      clock.pause();
      return getPlaybackState();
    },
    resume() {
      if (!(sourceClosed && processedBytes === availableBytes)) {
        paused = false;
        clock.resume();
      }
      return getPlaybackState();
    },
    restart() {
      return resetPlaybackPosition();
    },
    loop() {
      if (!sourceClosed) {
        throw new Error("Cannot loop ANSI playback before the source has closed.");
      }
      return resetPlaybackPosition({ incrementLoop: true });
    },
    setBaud(nextBaud) {
      clock.setBaud(nextBaud);
      return getPlaybackState();
    },
    getPlaybackState,
    getScreenSnapshot() {
      return stream.getSnapshot().currentFrame;
    },
    getParserState() {
      const snapshot = stream.getSnapshot();
      return {
        cursorRow: snapshot.cursorRow,
        cursorCol: snapshot.cursorCol,
        parserSettled: snapshot.parserSettled
      };
    },
    reset() {
      stream = createStream();
      sourceChunks = [];
      availableBytes = 0;
      processedBytes = 0;
      sourceChunkIndex = 0;
      sourceChunkOffset = 0;
      sourceClosed = false;
      paused = !autoplay;
      loopCount = 0;
      clock.reset();

      if (paused) {
        clock.pause();
      }

      return getPlaybackState();
    }
  };
};
