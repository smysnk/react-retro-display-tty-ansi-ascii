import { describe, expect, it } from "vitest";

import { createRetroScreenAnsiBytePlaybackEngine } from "./byte-playback-engine";
import {
  createRetroScreenAnsiSnapshotStream,
  stripRetroScreenAnsiSauce
} from "./player";

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

  it("accepts source arriving after buffering and completes only after the close", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 1, cols: 4 });
    engine.appendSource(encoder.encode("A"));
    engine.advanceBytes(1);

    expect(engine.getPlaybackState()).toMatchObject({ status: "buffering", totalBytes: null });
    engine.appendSource(encoder.encode("B"));
    expect(engine.advanceBytes(1)).toMatchObject({ status: "buffering", processedBytes: 2 });
    expect(engine.closeSource()).toMatchObject({ status: "complete", totalBytes: 2 });
    expect(engine.getScreenSnapshot().lines[0]).toBe("AB  ");
  });

  it("plays only canonical payload bytes after SAUCE removal", () => {
    const sauce = new Uint8Array(128).fill(0x20);
    sauce.set(encoder.encode("SAUCE00"), 0);
    const raw = Uint8Array.from([...encoder.encode("ART"), 0x1a, ...sauce]);
    const payload = stripRetroScreenAnsiSauce(raw);
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 1, cols: 8 });
    engine.appendSource(payload);
    engine.closeSource();
    engine.drain();

    expect(Array.from(payload)).toEqual(Array.from(encoder.encode("ART")));
    expect(engine.getPlaybackState().totalBytes).toBe(3);
    expect(engine.getScreenSnapshot().lines[0]).toBe("ART     ");
  });

  it("preserves DOS CP437 glyph bytes while ignoring ANSI NUL", () => {
    const ansi = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 4,
      controlCharacterMode: "ansi"
    });
    const cp437 = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 4,
      controlCharacterMode: "dos-cp437"
    });
    const payload = Uint8Array.of(0x00, 0x01, 0xdb);

    for (const engine of [ansi, cp437]) {
      engine.appendSource(payload);
      engine.closeSource();
      engine.drain();
    }

    expect(ansi.getScreenSnapshot().lines[0]).toBe("█   ");
    expect(cp437.getScreenSnapshot().lines[0]).toBe(" ☺█ ");
  });

  it("keeps canvas overflow separate from terminal viewport scrolling", () => {
    const payload = encoder.encode("A\r\nB\r\nC");
    const terminal = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 2,
      scrollMode: "terminal"
    });
    const canvas = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 2,
      scrollMode: "canvas"
    });

    for (const engine of [terminal, canvas]) {
      engine.appendSource(payload);
      engine.closeSource();
      engine.drain();
    }

    expect(terminal.getScreenSnapshot().lines).toEqual(["B ", "C "]);
    expect(canvas.getScreenSnapshot().lines).toEqual(["A ", "B "]);
  });

  it("supports delayed and immediate DOS wrapping as explicit policies", () => {
    const payload = encoder.encode("ABC");
    const delayed = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 2,
      wrapMode: "xterm-delayed",
      scrollMode: "canvas"
    });
    const immediate = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 2,
      wrapMode: "dos-immediate",
      scrollMode: "canvas"
    });

    for (const engine of [delayed, immediate]) {
      engine.appendSource(payload);
      engine.closeSource();
      engine.drain();
    }

    expect(delayed.getScreenSnapshot().lines).toEqual(["AB", "C "]);
    expect(immediate.getScreenSnapshot().lines).toEqual(["AB", "C "]);
  });

  it("derives blink presentation from the deterministic playback clock", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 2,
      baud: 8,
      blinkIntervalMs: 250
    });
    engine.appendSource(encoder.encode("AB"));

    expect(engine.getPlaybackState().blinkVisible).toBe(true);
    expect(engine.advanceTime(250)).toMatchObject({ processedBytes: 0, blinkVisible: false });
    expect(engine.advanceTime(250)).toMatchObject({ processedBytes: 0, blinkVisible: true });
  });
});
