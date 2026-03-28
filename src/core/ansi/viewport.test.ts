import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COLS,
  DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COL_STEP,
  DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROWS,
  DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
  getNextRetroScreenAnsiViewportAxisOffset,
  getNextRetroScreenAnsiViewportOffsets,
  getNextRetroScreenAnsiViewportOffsetsForKey,
  getRetroScreenAnsiViewportAspectRatio,
  MAX_RETROSCREEN_ANSI_ADAPTIVE_VIEWPORT_COLS,
  normalizeRetroScreenAnsiWheelPanDeltas,
  resolveRetroScreenAnsiViewportCols,
  resolveRetroScreenAnsiViewportRows
} from "./viewport";

describe("retro ANSI viewport helpers", () => {
  it("keeps the default 80x25 terminal baseline", () => {
    expect(DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COLS).toBe(80);
    expect(DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROWS).toBe(25);
  });

  it("clamps rows to short source buffers", () => {
    expect(resolveRetroScreenAnsiViewportRows({ sourceRows: 25 })).toBe(25);
    expect(resolveRetroScreenAnsiViewportRows({ sourceRows: 23 })).toBe(23);
    expect(resolveRetroScreenAnsiViewportRows({ sourceRows: 2 })).toBe(2);
    expect(resolveRetroScreenAnsiViewportRows({ sourceRows: 400 })).toBe(25);
  });

  it("adapts width for sane source buffers and falls back for giant buffers", () => {
    expect(resolveRetroScreenAnsiViewportCols({ sourceCols: 80 })).toBe(80);
    expect(resolveRetroScreenAnsiViewportCols({ sourceCols: 84 })).toBe(84);
    expect(resolveRetroScreenAnsiViewportCols({ sourceCols: 160 })).toBe(160);
    expect(
      resolveRetroScreenAnsiViewportCols({
        sourceCols: MAX_RETROSCREEN_ANSI_ADAPTIVE_VIEWPORT_COLS
      })
    ).toBe(200);
    expect(resolveRetroScreenAnsiViewportCols({ sourceCols: 320 })).toBe(80);
    expect(resolveRetroScreenAnsiViewportCols({ sourceCols: 20_480 })).toBe(80);
  });

  it("computes aspect ratio from visible geometry", () => {
    expect(
      getRetroScreenAnsiViewportAspectRatio({
        cols: 80,
        rows: 25,
        cellWidthRatio: 0.5,
        cellHeightRatio: 1
      })
    ).toBe(1.6);
    expect(
      getRetroScreenAnsiViewportAspectRatio({
        cols: 160,
        rows: 25,
        cellWidthRatio: 0.5,
        cellHeightRatio: 1
      })
    ).toBe(3.2);
  });

  it("scrolls by text-cell steps and clamps to bounds", () => {
    expect(
      getNextRetroScreenAnsiViewportAxisOffset({
        currentOffset: 0,
        delta: 120,
        unitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
        maxOffset: 50
      })
    ).toBe(9);
    expect(
      getNextRetroScreenAnsiViewportAxisOffset({
        currentOffset: 9,
        delta: -60,
        unitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
        maxOffset: 50
      })
    ).toBe(6);
    expect(
      getNextRetroScreenAnsiViewportAxisOffset({
        currentOffset: 48,
        delta: 240,
        unitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
        maxOffset: 50
      })
    ).toBe(50);
  });

  it("can pan diagonally across rows and columns", () => {
    expect(
      getNextRetroScreenAnsiViewportOffsets({
        rowOffset: 0,
        colOffset: 0,
        deltaX: 96,
        deltaY: 144,
        rowUnitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
        colUnitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COL_STEP,
        maxRowOffset: 100,
        maxColOffset: 40
      })
    ).toEqual({
      rowOffset: 9,
      colOffset: 4
    });
  });

  it("uses W/A/S/D panning and clamps to bounds", () => {
    expect(
      getNextRetroScreenAnsiViewportOffsetsForKey({
        key: "s",
        rowOffset: 0,
        colOffset: 0,
        rowUnitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
        colUnitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COL_STEP,
        maxRowOffset: 10,
        maxColOffset: 8
      })
    ).toEqual({
      rowOffset: 3,
      colOffset: 0
    });
    expect(
      getNextRetroScreenAnsiViewportOffsetsForKey({
        key: "D",
        rowOffset: 3,
        colOffset: 0,
        rowUnitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_ROW_STEP,
        colUnitsPerStep: DEFAULT_RETROSCREEN_ANSI_VIEWPORT_COL_STEP,
        maxRowOffset: 10,
        maxColOffset: 8
      })
    ).toEqual({
      rowOffset: 3,
      colOffset: 2
    });
  });

  it("normalizes shift-wheel into horizontal pan when needed", () => {
    expect(
      normalizeRetroScreenAnsiWheelPanDeltas({
        deltaX: 0,
        deltaY: 120,
        shiftKey: true
      })
    ).toEqual({
      deltaX: 120,
      deltaY: 0
    });
  });
});
