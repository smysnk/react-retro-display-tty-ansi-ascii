import { describe, expect, it } from "vitest";

import { createRetroScreenAnsiBytePlaybackEngine } from "./byte-playback-engine";
import { createRetroScreenAnsiSnapshotStream } from "./player";

const encoder = new TextEncoder();

describe("ANSI byte playback engine", () => {
  it("plays exact byte budgets and completes only after source close", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 2, cols: 8, baud: 8 });
    engine.appendSource(encoder.encode("AB"));

    expect(engine.advanceTime(500)).toMatchObject({
      status: "playing",
      processedBytes: 0,
      availableBytes: 2,
      totalBytes: null
    });
    expect(engine.advanceTime(500)).toMatchObject({
      status: "playing",
      processedBytes: 1
    });
    expect(engine.advanceTime(1000)).toMatchObject({
      status: "buffering",
      processedBytes: 2,
      sourceClosed: false
    });
    expect(engine.closeSource()).toMatchObject({
      status: "complete",
      totalBytes: 2,
      parserSettled: true
    });
    expect(engine.getScreenSnapshot().lines[0]).toBe("AB      ");
  });

  it("preserves parser state across network and scheduler chunk boundaries", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 2, cols: 8 });
    const firstChunk = encoder.encode("\u001b[31");
    const secondChunk = encoder.encode("mA\u001b[2;3HZ");
    engine.appendSource(firstChunk);
    engine.advanceBytes(4);

    expect(engine.getPlaybackState().parserSettled).toBe(false);
    engine.appendSource(secondChunk);
    engine.closeSource();
    engine.drain();

    expect(engine.getPlaybackState()).toMatchObject({
      status: "complete",
      processedBytes: firstChunk.length + secondChunk.length,
      parserSettled: true
    });
    expect(engine.getScreenSnapshot().getCellSlice(0, 0, 1)[0]).toMatchObject({
      char: "A",
      style: {
        foreground: {
          mode: "palette",
          value: 1
        }
      }
    });
    expect(engine.getScreenSnapshot().lines[1]?.slice(0, 3)).toBe("  Z");
  });

  it("drains to the legacy parser final state without retaining completed frames", () => {
    const payload = encoder.encode("\u001b[2;1Htail\u001b[1;1Hhead");
    const legacy = createRetroScreenAnsiSnapshotStream({ rows: 2, cols: 8 });
    const legacySnapshot = legacy.appendChunk(payload);
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 2, cols: 8 });
    engine.appendSource(payload);
    engine.closeSource();
    engine.drain();

    expect(legacySnapshot.completedFrames).toHaveLength(1);
    expect(engine.getScreenSnapshot().lines).toEqual(legacySnapshot.currentFrame.lines);
  });

  it("pauses, resumes, restarts, and loops from a clean screen", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 1, cols: 4, baud: 8 });
    engine.appendSource(encoder.encode("AB"));
    engine.closeSource();
    engine.pause();

    expect(engine.advanceTime(2000).processedBytes).toBe(0);
    engine.resume();
    expect(engine.advanceTime(1000).processedBytes).toBe(1);
    expect(engine.restart()).toMatchObject({ processedBytes: 0, loopCount: 0 });
    expect(engine.getScreenSnapshot().lines[0]).toBe("    ");
    engine.drain();
    expect(engine.loop()).toMatchObject({ processedBytes: 0, loopCount: 1 });
    expect(engine.getScreenSnapshot().lines[0]).toBe("    ");
  });

  it("settles an incomplete escape sequence at EOF", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 1, cols: 4 });
    engine.appendSource(encoder.encode("A\u001b[31"));
    engine.closeSource();
    engine.drain();

    expect(engine.getPlaybackState()).toMatchObject({
      status: "complete",
      parserSettled: true
    });
    expect(engine.getScreenSnapshot().lines[0]).toBe("A   ");
  });

  it("clones appended chunks and rejects invalid lifecycle operations", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 1, cols: 4 });
    const source = encoder.encode("AB");
    engine.appendSource(source);
    source[0] = "Z".charCodeAt(0);
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines[0]).toBe("AB  ");
    expect(() => engine.appendSource(Uint8Array.of(1))).toThrow(/source has closed/);
    expect(() => engine.advanceBytes(-1)).toThrow(RangeError);
    expect(() => engine.advanceTime(-1)).toThrow(RangeError);
  });
});
