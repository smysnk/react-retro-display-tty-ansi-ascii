import { describe, expect, it } from "vitest";
import { hexToRgba, TRANSPARENT_RGBA } from "./bitmap-colors";
import { diffBitmapCellSignatures } from "./bitmap-diff";
import { rasterizeRetroScreenBitmap } from "./bitmap-renderer";
import { buildBitmapTiles } from "./bitmap-tiles";

const solidGlyphs = new Uint8Array(256 * 16);
solidGlyphs.fill(0xff, 65 * 16, 66 * 16);

describe("bitmap renderer", () => {
  it("renders numeric RGBA pixels without a canvas dependency", () => {
    const result = rasterizeRetroScreenBitmap({
      cells: [[{
        glyphIndex: 65,
        foreground: hexToRgba("#ff5555"),
        background: hexToRgba("#0000aa"),
        signature: "A"
      }]],
      cols: 1,
      rows: 1,
      glyphs: solidGlyphs,
      glyphWidth: 8,
      glyphHeight: 16,
      defaultBackground: TRANSPARENT_RGBA
    });

    expect(result.width).toBe(8);
    expect(result.height).toBe(16);
    expect(Array.from(result.pixels.slice(0, 4))).toEqual([255, 85, 85, 255]);
  });

  it("duplicates VGA line drawing glyphs into the ninth column", () => {
    const glyphs = new Uint8Array(256 * 16);
    glyphs[192 * 16] = 0x01;
    const result = rasterizeRetroScreenBitmap({
      cells: [[{
        glyphIndex: 192,
        foreground: hexToRgba("#ffffff"),
        background: TRANSPARENT_RGBA,
        signature: "line"
      }]],
      cols: 1,
      rows: 1,
      glyphs,
      glyphWidth: 9,
      glyphHeight: 16,
      defaultBackground: TRANSPARENT_RGBA
    });

    expect(result.pixels[7 * 4 + 3]).toBe(255);
    expect(result.pixels[8 * 4 + 3]).toBe(255);
  });

  it("detects unchanged and dirty frames", () => {
    expect(diffBitmapCellSignatures([["a", "b"]], [["a", "b"]]).changed).toBe(false);
    expect(diffBitmapCellSignatures([["a", "b"]], [["a", "c"]]).dirtyCells).toEqual([
      { row: 0, col: 1 }
    ]);
  });

  it("produces identical pixels for dirty and complete frame updates", () => {
    const firstCells = [[
      {
        glyphIndex: 65,
        foreground: hexToRgba("#ffffff"),
        background: hexToRgba("#000000"),
        signature: "first-a"
      },
      {
        glyphIndex: 65,
        foreground: hexToRgba("#ffffff"),
        background: hexToRgba("#000000"),
        signature: "first-b"
      }
    ]];
    const nextCells = [[
      firstCells[0][0],
      {
        ...firstCells[0][1],
        foreground: hexToRgba("#55ffff"),
        signature: "next-b"
      }
    ]];
    const first = rasterizeRetroScreenBitmap({
      cells: firstCells,
      cols: 2,
      rows: 1,
      glyphs: solidGlyphs,
      glyphWidth: 8,
      glyphHeight: 16,
      defaultBackground: TRANSPARENT_RGBA
    });
    const dirty = rasterizeRetroScreenBitmap({
      cells: nextCells,
      cols: 2,
      rows: 1,
      glyphs: solidGlyphs,
      glyphWidth: 8,
      glyphHeight: 16,
      defaultBackground: TRANSPARENT_RGBA,
      previousPixels: first.pixels,
      dirtyCells: [{ row: 0, col: 1 }]
    });
    const complete = rasterizeRetroScreenBitmap({
      cells: nextCells,
      cols: 2,
      rows: 1,
      glyphs: solidGlyphs,
      glyphWidth: 8,
      glyphHeight: 16,
      defaultBackground: TRANSPARENT_RGBA
    });

    expect(dirty.pixels).toEqual(complete.pixels);
  });

  it("bounds tall artwork to 256-row canvas tiles", () => {
    const tiles = buildBitmapTiles(1_000);
    expect(tiles).toHaveLength(4);
    expect(tiles.map((tile) => tile.rowCount)).toEqual([256, 256, 256, 232]);
  });
});
