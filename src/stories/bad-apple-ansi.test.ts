import { describe, expect, it } from "vitest";
import {
  createRetroScreenAnsiFrameStream,
  materializeRetroScreenAnsiFrames
} from "../core/ansi/player";

describe("RetroScreen ANSI player helpers", () => {
  it("keeps forward-only cursor motion inside the same rendered frame", () => {
    const payload = "\u001b[1;1HAB\u001b[1;5HC";

    expect(materializeRetroScreenAnsiFrames(payload, 2, 6)).toEqual(["AB  C \n      "]);
  });

  it("starts a new frame when absolute cursor motion rewinds the screen", () => {
    const payload = "\u001b[24;1Htail\u001b[1;1Hhead";

    expect(materializeRetroScreenAnsiFrames(payload, 25, 8)).toEqual([
      `${"        \n".repeat(23)}tail    \n        `,
      `head    \n${"        \n".repeat(22)}tail    \n        `
    ]);
  });

  it("wraps to the next row after printing in the last column", () => {
    const payload = "\u001b[1;6HAB";

    expect(materializeRetroScreenAnsiFrames(payload, 2, 6)).toEqual(["     A\nB     "]);
  });

  it("clamps cursor-forward from the last column to the active row", () => {
    const payload = "\u001b[1;6H\u001b[2CX";

    expect(materializeRetroScreenAnsiFrames(payload, 3, 6)).toEqual(["     X\n      \n      "]);
  });

  it("continues decoding when a CSI sequence is split across byte chunks", () => {
    const stream = createRetroScreenAnsiFrameStream({ rows: 2, cols: 6 });
    const encoder = new TextEncoder();

    stream.appendChunk(encoder.encode("\u001b[1;"));
    const snapshot = stream.appendChunk(encoder.encode("6HAB"));

    expect(snapshot.completedFrames).toEqual([]);
    expect(snapshot.currentFrame).toBe("     A\nB     ");
  });

  it("continues accumulating frames as more stream data arrives", () => {
    const stream = createRetroScreenAnsiFrameStream({ rows: 25, cols: 8 });
    const encoder = new TextEncoder();

    stream.appendChunk(encoder.encode("\u001b[24;1Htail"));
    const snapshot = stream.appendChunk(encoder.encode("\u001b[1;1Hhead"));

    expect(snapshot.completedFrames).toEqual([
      `${"        \n".repeat(23)}tail    \n        `
    ]);
    expect(snapshot.currentFrame).toBe(
      `head    \n${"        \n".repeat(22)}tail    \n        `
    );
  });
});
