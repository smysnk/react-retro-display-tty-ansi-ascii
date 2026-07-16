import type { RetroScreenRgbaColor } from "./bitmap-colors";
import type { RetroScreenBitmapDirtyCell } from "./bitmap-diff";

export type RetroScreenBitmapRasterCell = {
  glyphIndex: number;
  foreground: RetroScreenRgbaColor;
  background: RetroScreenRgbaColor;
  signature: string;
};

export type RetroScreenBitmapRasterOptions = {
  cells: readonly (readonly (RetroScreenBitmapRasterCell | undefined)[])[];
  cols: number;
  rows: number;
  glyphs: Uint8Array | readonly number[];
  glyphWidth: 8 | 9;
  glyphHeight: 16;
  defaultBackground: RetroScreenRgbaColor;
  previousPixels?: Uint8ClampedArray;
  dirtyCells?: readonly RetroScreenBitmapDirtyCell[];
};

const writePixel = (
  pixels: Uint8ClampedArray,
  pixelOffset: number,
  color: RetroScreenRgbaColor
) => {
  pixels[pixelOffset] = color.red;
  pixels[pixelOffset + 1] = color.green;
  pixels[pixelOffset + 2] = color.blue;
  pixels[pixelOffset + 3] = color.alpha;
};

const paintCell = ({
  pixels,
  canvasWidth,
  row,
  col,
  cell,
  glyphs,
  glyphWidth,
  glyphHeight,
  defaultBackground
}: {
  pixels: Uint8ClampedArray;
  canvasWidth: number;
  row: number;
  col: number;
  cell: RetroScreenBitmapRasterCell | undefined;
  glyphs: Uint8Array | readonly number[];
  glyphWidth: 8 | 9;
  glyphHeight: 16;
  defaultBackground: RetroScreenRgbaColor;
}) => {
  const background = cell?.background.alpha ? cell.background : defaultBackground;
  const cellX = col * glyphWidth;
  const cellY = row * glyphHeight;

  for (let glyphRow = 0; glyphRow < glyphHeight; glyphRow += 1) {
    for (let glyphCol = 0; glyphCol < glyphWidth; glyphCol += 1) {
      const pixelOffset = ((cellY + glyphRow) * canvasWidth + cellX + glyphCol) * 4;
      writePixel(pixels, pixelOffset, background);
    }
  }

  if (!cell || cell.foreground.alpha === 0) {
    return;
  }

  const glyphOffset = cell.glyphIndex * glyphHeight;

  for (let glyphRow = 0; glyphRow < glyphHeight; glyphRow += 1) {
    const glyphBits = glyphs[glyphOffset + glyphRow] ?? 0;

    for (let glyphCol = 0; glyphCol < 8; glyphCol += 1) {
      if ((glyphBits & (0x80 >> glyphCol)) === 0) {
        continue;
      }

      const pixelOffset = ((cellY + glyphRow) * canvasWidth + cellX + glyphCol) * 4;
      writePixel(pixels, pixelOffset, cell.foreground);

      if (
        glyphWidth === 9 &&
        glyphCol === 7 &&
        cell.glyphIndex >= 192 &&
        cell.glyphIndex <= 223
      ) {
        writePixel(pixels, pixelOffset + 4, cell.foreground);
      }
    }
  }
};

export const rasterizeRetroScreenBitmap = ({
  cells,
  cols,
  rows,
  glyphs,
  glyphWidth,
  glyphHeight,
  defaultBackground,
  previousPixels,
  dirtyCells
}: RetroScreenBitmapRasterOptions) => {
  const width = Math.max(1, cols * glyphWidth);
  const height = Math.max(1, rows * glyphHeight);
  const requiredLength = width * height * 4;
  const canReuse = previousPixels?.length === requiredLength;
  const pixels = canReuse ? previousPixels : new Uint8ClampedArray(requiredLength);
  const cellsToPaint = canReuse && dirtyCells
    ? dirtyCells
    : Array.from({ length: rows * cols }, (_, index) => ({
        row: Math.floor(index / cols),
        col: index % cols
      }));

  for (const { row, col } of cellsToPaint) {
    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      continue;
    }

    paintCell({
      pixels,
      canvasWidth: width,
      row,
      col,
      cell: cells[row]?.[col],
      glyphs,
      glyphWidth,
      glyphHeight,
      defaultBackground
    });
  }

  return { pixels, width, height };
};
