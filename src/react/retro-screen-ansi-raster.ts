import { getCp437GlyphIndex } from "../core/ansi/cp437";
import type { RetroScreenAnsiSnapshotFrame } from "../core/ansi/player";
import { hexToRgba, TRANSPARENT_RGBA } from "../core/rendering/bitmap-colors";
import {
  rasterizeRetroScreenBitmap,
  type RetroScreenBitmapRasterCell
} from "../core/rendering/bitmap-renderer";
import { ansiSnapshotToRenderModelWindow } from "./retro-screen-render-model";
import { getCellPresentationColors } from "./retro-screen-display-color";
import {
  IBM_VGA_8X16_GLYPHS,
  IBM_VGA_GLYPH_HEIGHT
} from "./ibm-vga-8x16-font";

export const rasterizeRetroScreenAnsiSnapshot = ({
  snapshot,
  rows,
  cols,
  glyphWidth = 8,
  iceColors = false,
  blinkVisible = true
}: {
  snapshot: RetroScreenAnsiSnapshotFrame;
  rows: number;
  cols: number;
  glyphWidth?: 8 | 9;
  iceColors?: boolean;
  blinkVisible?: boolean;
}) => {
  const renderModel = ansiSnapshotToRenderModelWindow(
    {
      sourceRows: rows,
      sourceCols: cols,
      frameIndex: 0,
      frameCount: 1,
      isComplete: true,
      isStreaming: false,
      storageMode: snapshot.storageMode,
      lines: [...snapshot.lines],
      cells: snapshot.cells?.map((row) => [...row]),
      getLineSlice: snapshot.getLineSlice,
      getCellSlice: snapshot.getCellSlice
    },
    { rows, cols }
  );
  const cells: RetroScreenBitmapRasterCell[][] = renderModel.cells.map((row) =>
    row.map((cell) => {
      const presentation = getCellPresentationColors(
        cell,
        "ansi-vga",
        "dark",
        iceColors
      );
      const foreground =
        cell.style.blink && !iceColors && !blinkVisible
          ? TRANSPARENT_RGBA
          : presentation?.foreground ?? hexToRgba("#aaaaaa");
      const background = presentation?.background ?? TRANSPARENT_RGBA;

      return {
        glyphIndex: getCp437GlyphIndex(cell.char),
        foreground,
        background,
        signature: ""
      };
    })
  );

  return rasterizeRetroScreenBitmap({
    cells,
    cols,
    rows,
    glyphs: IBM_VGA_8X16_GLYPHS,
    glyphWidth,
    glyphHeight: IBM_VGA_GLYPH_HEIGHT,
    defaultBackground: hexToRgba("#000000")
  });
};
