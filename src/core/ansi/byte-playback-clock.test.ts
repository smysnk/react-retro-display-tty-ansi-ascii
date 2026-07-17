import { describe, expect, it } from "vitest";

import { createRetroScreenAnsiBytePlaybackClock } from "./byte-playback-clock";

describe("ANSI byte playback clock", () => {
  it("matches Ansilove 10ms byte quanta at 14,400 baud", () => {
    const clock = createRetroScreenAnsiBytePlaybackClock({ baud: 14_400 });

    expect(clock.advanceTime(10)).toBe(18);
    expect(clock.advanceTime(10)).toBe(18);
    expect(clock.getState()).toMatchObject({
      elapsedMs: 20,
      fractionalByteCredit: 0
    });
  });

  it("retains fractional byte credit across time advances", () => {
    const clock = createRetroScreenAnsiBytePlaybackClock({ baud: 300 });

    expect(clock.advanceTime(10)).toBe(0);
    expect(clock.advanceTime(10)).toBe(0);
    expect(clock.advanceTime(10)).toBe(1);
    expect(clock.getState().fractionalByteCredit).toBeCloseTo(0.125, 10);
  });

  it("does not accrue elapsed time or byte credit while paused", () => {
    const clock = createRetroScreenAnsiBytePlaybackClock({ baud: 8 });
    clock.advanceTime(500);
    clock.pause();

    expect(clock.advanceTime(10_000)).toBe(0);
    expect(clock.getState()).toMatchObject({
      elapsedMs: 500,
      fractionalByteCredit: 0.5,
      paused: true
    });

    clock.resume();
    expect(clock.advanceTime(500)).toBe(1);
  });

  it("resets time and credit without changing baud", () => {
    const clock = createRetroScreenAnsiBytePlaybackClock({ baud: 115_200 });
    clock.advanceTime(15);
    clock.pause();
    clock.reset();

    expect(clock.getState()).toEqual({
      baud: 115_200,
      elapsedMs: 0,
      fractionalByteCredit: 0,
      paused: false
    });
  });

  it("rejects invalid baud and elapsed-time inputs", () => {
    expect(() => createRetroScreenAnsiBytePlaybackClock({ baud: 0 })).toThrow(RangeError);
    const clock = createRetroScreenAnsiBytePlaybackClock();

    expect(() => clock.setBaud(Number.NaN)).toThrow(RangeError);
    expect(() => clock.advanceTime(-1)).toThrow(RangeError);
  });
});
