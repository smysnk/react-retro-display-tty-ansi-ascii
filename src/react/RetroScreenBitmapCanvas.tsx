import { useEffect, useLayoutEffect, useRef } from "react";
import { getCp437GlyphIndex } from "../core/ansi/cp437";
import type {
  RetroScreenDisplayColorMode,
  RetroScreenDisplaySurfaceMode
} from "../core/types";
import { getCellPresentationStyle } from "./retro-screen-display-color";
import type { RetroScreenRenderModel } from "./retro-screen-render-model";
import {
  IBM_VGA_8X16_GLYPHS,
  IBM_VGA_GLYPH_HEIGHT,
  IBM_VGA_GLYPH_WIDTH
} from "./ibm-vga-8x16-font";
import { AMIGA_MICROKNIGHT_8X16_GLYPHS } from "./amiga-microknight-8x16-font";
import type { RetroScreenDisplayGlyphMode } from "../core/types";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const readCssColor = (value: unknown, fallback: string) =>
  typeof value === "string" && value.length > 0 ? value : fallback;

export function RetroScreenBitmapCanvas({
  renderModel,
  displayColorMode,
  displaySurfaceMode,
  displayGlyphMode,
  displayIceColors
}: {
  renderModel: RetroScreenRenderModel;
  displayColorMode: RetroScreenDisplayColorMode;
  displaySurfaceMode: RetroScreenDisplaySurfaceMode;
  displayGlyphMode: Exclude<RetroScreenDisplayGlyphMode, "font">;
  displayIceColors: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rows = renderModel.cells.length;
  const cols = renderModel.cells.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  const glyphWidth = displayGlyphMode === "ibm-vga-9x16" ? 9 : IBM_VGA_GLYPH_WIDTH;
  const glyphs = displayGlyphMode === "amiga-microknight-8x16"
    ? AMIGA_MICROKNIGHT_8X16_GLYPHS
    : IBM_VGA_8X16_GLYPHS;
  const width = Math.max(1, cols * glyphWidth);
  const height = Math.max(1, rows * IBM_VGA_GLYPH_HEIGHT);

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });

    if (!canvas || !context) {
      return;
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);

    if (displayColorMode === "ansi-vga") {
      context.fillStyle = "#000000";
      context.fillRect(0, 0, width, height);
    }

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const row = renderModel.cells[rowIndex] ?? [];

      for (let colIndex = 0; colIndex < cols; colIndex += 1) {
        const cell = row[colIndex];

        if (!cell) {
          continue;
        }

        const presentation = getCellPresentationStyle(
          cell,
          displayColorMode,
          displaySurfaceMode,
          displayIceColors
        );
        const foreground = readCssColor(presentation?.color, "#aaaaaa");
        const background = readCssColor(presentation?.backgroundColor, "transparent");
        const cellX = colIndex * glyphWidth;
        const cellY = rowIndex * IBM_VGA_GLYPH_HEIGHT;

        if (background !== "transparent") {
          context.fillStyle = background;
          context.fillRect(cellX, cellY, glyphWidth, IBM_VGA_GLYPH_HEIGHT);
        }

        if (foreground === "transparent") {
          continue;
        }

        const glyphIndex = getCp437GlyphIndex(cell.char);
        const glyphOffset = glyphIndex * IBM_VGA_GLYPH_HEIGHT;
        context.fillStyle = foreground;

        for (let glyphRow = 0; glyphRow < IBM_VGA_GLYPH_HEIGHT; glyphRow += 1) {
          const glyphBits = glyphs[glyphOffset + glyphRow] ?? 0;

          for (let glyphCol = 0; glyphCol < IBM_VGA_GLYPH_WIDTH; glyphCol += 1) {
            if ((glyphBits & (0x80 >> glyphCol)) !== 0) {
              context.fillRect(cellX + glyphCol, cellY + glyphRow, 1, 1);

              if (
                displayGlyphMode === "ibm-vga-9x16" &&
                glyphCol === 7 &&
                glyphIndex >= 192 &&
                glyphIndex <= 223
              ) {
                context.fillRect(cellX + 8, cellY + glyphRow, 1, 1);
              }
            }
          }
        }
      }
    }
  }, [cols, displayColorMode, displayGlyphMode, displayIceColors, displaySurfaceMode, glyphWidth, glyphs, height, renderModel, rows, width]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="retro-screen__bitmap-canvas"
      data-retro-screen-bitmap-canvas="true"
      height={height}
      width={width}
    />
  );
}
