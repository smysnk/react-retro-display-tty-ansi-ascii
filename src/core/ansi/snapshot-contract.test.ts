import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY,
  normalizeRetroScreenAnsiViewportWindow,
  resolveRetroScreenAnsiSourceGeometry,
} from "./snapshot-contract";

describe("ANSI snapshot contract", () => {
  it("resolves sane SAUCE geometry into eager source dimensions", () => {
    const geometry = resolveRetroScreenAnsiSourceGeometry({
      metadata: {
        title: "demo",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 160,
        height: 320,
      },
    });

    expect(geometry).toMatchObject({
      rows: 320,
      cols: 160,
      totalCells: 51_200,
      geometrySource: "sauce",
      storageMode: "eager",
    });
  });

  it("falls back to default 80x25 geometry when SAUCE dimensions are unusable", () => {
    const geometry = resolveRetroScreenAnsiSourceGeometry({
      metadata: {
        title: "broken",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 0,
        height: Number.NaN,
      },
    });

    expect(geometry).toMatchObject({
      rows: DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY.fallbackRows,
      cols: DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY.fallbackCols,
      geometrySource: "fallback",
      storageMode: "eager",
    });
  });

  it("marks pathological large geometries for sparse storage", () => {
    const geometry = resolveRetroScreenAnsiSourceGeometry({
      metadata: {
        title: "huge",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 8_301,
        height: 23_323,
      },
    });

    expect(geometry.rows).toBe(23_323);
    expect(geometry.cols).toBe(8_301);
    expect(geometry.totalCells).toBeGreaterThan(DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY.eagerMaxCells);
    expect(geometry.storageMode).toBe("sparse");
  });

  it("marks pathological huge-width geometries for sparse storage even when total rows are small", () => {
    const geometry = resolveRetroScreenAnsiSourceGeometry({
      metadata: {
        title: "wide",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 20_480,
        height: 25,
      },
    });

    expect(geometry.rows).toBe(25);
    expect(geometry.cols).toBe(20_480);
    expect(geometry.totalCells).toBeLessThan(DEFAULT_RETROSCREEN_ANSI_GEOMETRY_POLICY.eagerMaxCells);
    expect(geometry.storageMode).toBe("sparse");
  });

  it("normalizes an 80x25 viewport window while preserving source geometry bounds", () => {
    const window = normalizeRetroScreenAnsiViewportWindow({
      sourceRows: 400,
      sourceCols: 160,
      rowOffset: 999,
      colOffset: 999,
      rows: 25,
      cols: 80,
    });

    expect(window).toEqual({
      rowOffset: 375,
      colOffset: 80,
      rows: 25,
      cols: 80,
      maxRowOffset: 375,
      maxColOffset: 80,
    });
  });

  it("keeps the fixed viewport size even when the source geometry is smaller", () => {
    const window = normalizeRetroScreenAnsiViewportWindow({
      sourceRows: 12,
      sourceCols: 41,
      rowOffset: 4,
      colOffset: 9,
      rows: 25,
      cols: 80,
    });

    expect(window).toEqual({
      rowOffset: 0,
      colOffset: 0,
      rows: 25,
      cols: 80,
      maxRowOffset: 0,
      maxColOffset: 0,
    });
  });
});
