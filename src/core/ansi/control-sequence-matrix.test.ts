import { describe, expect, it } from "vitest";

import { ansiDisplayFacingCommandInventory } from "../terminal/conformance/ansi-sequence-matrix";
import {
  artworkAnsiAdditionalControlCases,
  artworkAnsiControlInventory,
  artworkAnsiImplementedSequences
} from "./control-sequence-matrix";
import { createRetroScreenAnsiSnapshotStream } from "./player";

const encoder = new TextEncoder();

const snapshotForChunks = (chunks: Uint8Array[]) => {
  const stream = createRetroScreenAnsiSnapshotStream({
    rows: 8,
    cols: 20,
    controlCharacterMode: "ansi",
    scrollMode: "terminal"
  });

  for (const chunk of chunks) {
    stream.appendChunk(chunk);
  }

  const snapshot = stream.getSnapshot();

  return {
    lines: snapshot.currentFrame.lines,
    cells: Array.from({ length: snapshot.sourceRows }, (_, row) =>
      snapshot.currentFrame.getCellSlice(row, 0, snapshot.sourceCols)
    )
  };
};

const payloadForSequence = (sequence: string) =>
  encoder.encode(`ABCDE\r\nFGHIJ\u001b[2;3H${sequence}Z`);

describe("artwork ANSI control sequence matrix", () => {
  it("classifies every terminal display-control family for the artwork parser", () => {
    expect(artworkAnsiControlInventory.map((entry) => entry.id)).toEqual(
      ansiDisplayFacingCommandInventory.map((entry) => entry.id)
    );

    for (const entry of artworkAnsiControlInventory) {
      expect(["implemented", "partial", "deferred"]).toContain(entry.artworkSupport);
    }
  });

  it("keeps artwork-only C0 and cancellation controls explicit", () => {
    expect(artworkAnsiAdditionalControlCases.map((entry) => entry.id)).toEqual([
      "c0-bell",
      "csi-cancel-can",
      "csi-cancel-sub"
    ]);
  });

  for (const control of artworkAnsiImplementedSequences) {
    it(`preserves ${control.id} across every source-byte split`, () => {
      const payload = payloadForSequence(control.sequence);
      const expected = snapshotForChunks([payload]);

      for (let split = 1; split < payload.length; split += 1) {
        expect(
          snapshotForChunks([payload.slice(0, split), payload.slice(split)]),
          `split ${split}/${payload.length}`
        ).toEqual(expected);
      }

      expect(snapshotForChunks(Array.from(payload, (byte) => Uint8Array.of(byte)))).toEqual(
        expected
      );
    });
  }
});
