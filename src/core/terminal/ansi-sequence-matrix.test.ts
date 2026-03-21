import { describe, expect, it, vi } from "vitest";
import { RetroLcdAnsiParser } from "./ansi-parser";
import {
  ansiSupportGapLedger,
  ansiSupportedSequenceCases
} from "./conformance/ansi-sequence-matrix";

const expectedCommandTypes = [
  "lineFeed",
  "carriageReturn",
  "backspace",
  "tab",
  "formFeed",
  "bell",
  "insertChars",
  "cursorUp",
  "cursorDown",
  "cursorForward",
  "cursorBackward",
  "cursorPosition",
  "insertLines",
  "deleteLines",
  "deleteChars",
  "scrollUp",
  "scrollDown",
  "setScrollRegion",
  "eraseInDisplay",
  "eraseInLine",
  "saveCursor",
  "restoreCursor",
  "setGraphicRendition",
  "setMode",
  "resetMode",
  "index",
  "nextLine",
  "reverseIndex",
  "resetToInitialState"
].sort();

describe("ANSI sequence support matrix", () => {
  it("tracks every currently supported command family explicitly", () => {
    const coveredTypes = Array.from(
      new Set(
        ansiSupportedSequenceCases.flatMap((entry) =>
          entry.expectedCommands.map((command) => command.type)
        )
      )
    ).sort();

    expect(coveredTypes).toEqual(expectedCommandTypes);
  });

  it("keeps sequence and gap ids unique", () => {
    const sequenceIds = ansiSupportedSequenceCases.map((entry) => entry.id);
    const gapIds = ansiSupportGapLedger.map((entry) => entry.id);

    expect(new Set(sequenceIds).size).toBe(sequenceIds.length);
    expect(new Set(gapIds).size).toBe(gapIds.length);
  });

  it("records explicit examples for every unsupported ANSI family", () => {
    for (const gap of ansiSupportGapLedger) {
      expect(gap.examples.length, `${gap.id} should include at least one concrete example.`).toBeGreaterThan(0);
      expect(gap.description.length, `${gap.id} should explain why the family is not covered.`).toBeGreaterThan(0);
    }
  });
});

describe("RetroLcdAnsiParser support matrix", () => {
  for (const entry of ansiSupportedSequenceCases) {
    it(`parses ${entry.id}`, () => {
      const handlers = {
        command: vi.fn()
      };
      const parser = new RetroLcdAnsiParser(handlers);

      parser.feed(entry.sequence);

      expect(handlers.command.mock.calls.map(([command]) => command)).toEqual(entry.expectedCommands);
    });
  }
});
