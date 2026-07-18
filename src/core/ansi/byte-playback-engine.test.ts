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

  it("drains to the parser final state without retaining semantic frames", () => {
    const payload = encoder.encode("\u001b[2;1Htail\u001b[1;1Hhead");
    const legacy = createRetroScreenAnsiSnapshotStream({ rows: 2, cols: 8 });
    const legacySnapshot = legacy.appendChunk(payload);
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 2, cols: 8 });
    engine.appendSource(payload);
    engine.closeSource();
    engine.drain();

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

  it("removes legacy SAUCE records with malformed version bytes like Ansilove", () => {
    const sauce = new Uint8Array(128).fill(0x20);
    sauce.set(encoder.encode("SAUCE"), 0);
    sauce[5] = 0;
    sauce[6] = 0;
    const payload = stripRetroScreenAnsiSauce(
      Uint8Array.from([...encoder.encode("ART"), 0x1a, ...sauce]),
    );
    const engine = createRetroScreenAnsiBytePlaybackEngine({ rows: 1, cols: 8 });
    engine.appendSource(payload);
    engine.closeSource();
    engine.drain();

    expect(engine.getPlaybackState().totalBytes).toBe(3);
    expect(engine.getScreenSnapshot().lines).toEqual(["ART     "]);
  });

  it("removes repeated trailing SAUCE records before playback", () => {
    const innerSauce = new Uint8Array(128).fill(0x20);
    innerSauce.set(encoder.encode("SAUCE00"), 0);
    const outerSauce = new Uint8Array(128).fill(0x20);
    outerSauce.set(encoder.encode("SAUCE00"), 0);
    const raw = Uint8Array.from([
      ...encoder.encode("ART"),
      0x1a,
      ...innerSauce,
      0x1a,
      ...outerSauce,
    ]);

    expect(Array.from(stripRetroScreenAnsiSauce(raw))).toEqual(
      Array.from(encoder.encode("ART")),
    );
  });

  it("removes SAUCE comment blocks and their optional EOF marker", () => {
    const sauce = new Uint8Array(128).fill(0x20);
    sauce.set(encoder.encode("SAUCE00"), 0);
    sauce[104] = 2;
    const comments = new Uint8Array(5 + 2 * 64).fill(0x20);
    comments.set(encoder.encode("COMNT"), 0);
    comments.set(encoder.encode("first comment"), 5);
    comments.set(encoder.encode("second comment"), 5 + 64);
    const raw = Uint8Array.from([
      ...encoder.encode("ART"),
      0x1a,
      ...comments,
      ...sauce,
    ]);

    expect(Array.from(stripRetroScreenAnsiSauce(raw))).toEqual(
      Array.from(encoder.encode("ART")),
    );
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

  it("matches Ansilove DOS extended-color and PabloDraw truecolor sequences", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 2,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("\u001b[38;5;123;48;5;0mA\u001b[1;12;34;56tB"));
    engine.closeSource();
    engine.drain();
    const cells = engine.getScreenSnapshot().cells[0];

    expect(cells[0]?.style.foreground).toEqual({ mode: "default", value: 0 });
    expect(cells[0]?.style.background).toEqual({ mode: "default", value: 0 });
    expect(cells[1]?.style.foreground).toEqual({ mode: "rgb", value: 0x0c2238 });
  });

  it("restores the underlying DOS palette when bold clears PabloDraw truecolor", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 2,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("\u001b[36m\u001b[1;12;34;56tA\u001b[1mB"));
    engine.closeSource();
    engine.drain();
    const cells = engine.getScreenSnapshot().cells[0];

    expect(cells[0]?.style.foreground).toEqual({ mode: "rgb", value: 0x0c2238 });
    expect(cells[1]?.style.foreground).toEqual({ mode: "palette", value: 6 });
    expect(cells[1]?.style.bold).toBe(true);
  });

  it("does not turn a trailing SGR separator into a reset parameter", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 2,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("\u001b[0;1;mX"));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().cells[0]?.[0]?.style.bold).toBe(true);
  });

  it("uses Ansilove omitted and explicit-zero DOS CSI parameters", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 4,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("\u001b[mA\u001b[0CB\u001b[1CC"));
    engine.closeSource();
    engine.drain();

    const cells = engine.getScreenSnapshot().cells[0];
    expect(cells[0]?.char).toBe("A");
    expect(cells[0]?.style.bold).toBe(true);
    expect(cells[1]?.char).toBe("B");
    expect(cells[3]?.char).toBe("C");
  });

  it("renders a DOS ESC byte literally when it does not introduce CSI", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 4,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(Uint8Array.of(0x1b, 0x75, 0x58));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines[0]).toBe("←uX ");
  });

  it("uses Ansilove's non-consuming ESC lookahead at byte checkpoints", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 3,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(Uint8Array.of(0x1b, 0x73));
    engine.closeSource();

    engine.advanceBytes(1);
    expect(engine.getPlaybackState().processedBytes).toBe(1);
    expect(engine.getScreenSnapshot().lines[0]).toBe("←  ");

    engine.advanceBytes(1);
    expect(engine.getScreenSnapshot().lines[0]).toBe("←s ");
  });

  it("renders a lone DOS ESC at end of source", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 2,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(Uint8Array.of(0x1b));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines[0]).toBe("← ");
  });

  it("uses Ansilove letter-only CSI termination in DOS mode", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 3,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("\u001b[0_pX\u001b[0}YZ"));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines[0]).toBe("XZ ");
  });

  it("keeps nested escape bytes inside malformed DOS CSI sequences", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 3,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(Uint8Array.from([
      0x1b, 0x5b, 0x31, 0x6d,
      0x1b, 0x5b, 0x30, 0x7d, 0xdb,
      0x1b, 0x5b, 0x33, 0x31, 0x6d,
      0x58
    ]));
    engine.closeSource();
    engine.drain();

    const cell = engine.getScreenSnapshot().cells[0]?.[0];
    expect(cell?.char).toBe("X");
    expect(cell?.style.bold).toBe(false);
    expect(cell?.style.foreground).toEqual({ mode: "default", value: 0 });
  });

  it("ignores HVP while retaining Ansilove DOS CUP positioning", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 4,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("A\u001b[2;3fB\u001b[2;3HC"));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines).toEqual(["AB  ", "  C "]);
  });

  it("uses Ansilove line-feed, carriage-return, and tab semantics in DOS mode", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 8,
      controlCharacterMode: "dos-cp437",
    });
    engine.appendSource(Uint8Array.from([0x41, 0x09, 0x42, 0x0a, 0x43, 0x0d, 0x44]));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines).toEqual(["A○B     ", "CD      "]);
  });

  it("homes the DOS cursor when CSI 2 J clears the screen", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 3,
      cols: 4,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("old\r\nline\u001b[2JX"));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines).toEqual(["X   ", "    ", "    "]);
  });

  it("uses the default VGA background for DOS erase commands", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 3,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("\u001b[41mABC\u001b[1;1H\u001b[K\u001b[2J"));
    engine.closeSource();
    engine.drain();

    for (const row of engine.getScreenSnapshot().cells) {
      for (const cell of row) {
        expect(cell.style.background).toEqual({ mode: "default", value: 0 });
      }
    }
  });

  it("retains Ansilove's offscreen CUP sentinel and right-edge C behavior", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 3,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("A\u001b[3;1HX\u001b[AQ\u001b[1;3H\u001b[0CZ"));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines).toEqual(["A  ", "ZQ "]);
  });

  it("skips right movement when DOS CSI C scrolls from the bottom edge", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 3,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("\u001b[1;3H\u001b[2CX"));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines[0]).toBe("X  ");
  });

  it("retains Ansilove's stale CSI prefix after right-edge C scrolls", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 10,
      controlCharacterMode: "dos-cp437"
    });
    engine.appendSource(encoder.encode("\u001b[1;10H\u001b[6C\u001b[30CX"));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines[0]).toBe("      X   ");
  });

  it("keeps DOS saved cursor coordinates fixed while the viewport scrolls", () => {
    const engine = createRetroScreenAnsiBytePlaybackEngine({
      rows: 2,
      cols: 3,
      controlCharacterMode: "dos-cp437",
      scrollMode: "terminal"
    });
    engine.appendSource(encoder.encode("A\r\n\u001b[sB\r\nC\u001b[uX"));
    engine.closeSource();
    engine.drain();

    expect(engine.getScreenSnapshot().lines).toEqual(["B  ", "X  "]);
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
    }

    delayed.drain();
    immediate.drain();

    expect(delayed.getScreenSnapshot().lines).toEqual(["AB", "C "]);
    expect(immediate.getScreenSnapshot().lines).toEqual(["AB", "C "]);

    const delayedBoundary = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 2,
      wrapMode: "xterm-delayed",
      scrollMode: "terminal"
    });
    const immediateBoundary = createRetroScreenAnsiBytePlaybackEngine({
      rows: 1,
      cols: 2,
      wrapMode: "dos-immediate",
      scrollMode: "terminal"
    });
    for (const engine of [delayedBoundary, immediateBoundary]) {
      engine.appendSource(encoder.encode("AB"));
      engine.advanceBytes(2);
    }
    expect(delayedBoundary.getScreenSnapshot().lines).toEqual(["AB"]);
    expect(immediateBoundary.getScreenSnapshot().lines).toEqual(["  "]);
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
