export type RetroScreenAnsiBytePlaybackClockState = {
  baud: number;
  elapsedMs: number;
  fractionalByteCredit: number;
  paused: boolean;
};

export type RetroScreenAnsiBytePlaybackClock = {
  advanceTime: (elapsedMs: number) => number;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setBaud: (baud: number) => void;
  getState: () => RetroScreenAnsiBytePlaybackClockState;
};

const normalizeBaud = (baud: number) => {
  if (!Number.isFinite(baud) || baud <= 0) {
    throw new RangeError("ANSI playback baud must be a positive finite number.");
  }

  return baud;
};

export const createRetroScreenAnsiBytePlaybackClock = ({
  baud = 14_400,
  paused = false
}: {
  baud?: number;
  paused?: boolean;
} = {}): RetroScreenAnsiBytePlaybackClock => {
  let currentBaud = normalizeBaud(baud);
  let elapsedMs = 0;
  let fractionalByteCredit = 0;
  let isPaused = paused;

  const getState = (): RetroScreenAnsiBytePlaybackClockState => ({
    baud: currentBaud,
    elapsedMs,
    fractionalByteCredit,
    paused: isPaused
  });

  return {
    advanceTime(nextElapsedMs) {
      if (!Number.isFinite(nextElapsedMs) || nextElapsedMs < 0) {
        throw new RangeError("ANSI playback elapsed time must be a non-negative finite number.");
      }

      if (isPaused || nextElapsedMs === 0) {
        return 0;
      }

      elapsedMs += nextElapsedMs;
      fractionalByteCredit += (nextElapsedMs * (currentBaud / 8)) / 1000;
      const wholeBytes = Math.floor(fractionalByteCredit);
      fractionalByteCredit -= wholeBytes;

      return wholeBytes;
    },
    pause() {
      isPaused = true;
    },
    resume() {
      isPaused = false;
    },
    reset() {
      elapsedMs = 0;
      fractionalByteCredit = 0;
      isPaused = false;
    },
    setBaud(nextBaud) {
      currentBaud = normalizeBaud(nextBaud);
    },
    getState
  };
};
