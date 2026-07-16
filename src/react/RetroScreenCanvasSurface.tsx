import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getCp437GlyphIndex } from "../core/ansi/cp437";
import { hexToRgba, TRANSPARENT_RGBA } from "../core/rendering/bitmap-colors";
import {
  diffBitmapCellSignatures,
  mergeBitmapDirtyBounds
} from "../core/rendering/bitmap-diff";
import {
  rasterizeRetroScreenBitmap,
  type RetroScreenBitmapRasterCell
} from "../core/rendering/bitmap-renderer";
import { buildBitmapTiles } from "../core/rendering/bitmap-tiles";
import type {
  RetroScreenDisplayColorMode,
  RetroScreenDisplayGlyphMode,
  RetroScreenDisplaySurfaceMode
} from "../core/types";
import { AMIGA_MICROKNIGHT_8X16_GLYPHS } from "./amiga-microknight-8x16-font";
import { getCellPresentationColors } from "./retro-screen-display-color";
import type { RetroScreenRenderModel } from "./retro-screen-render-model";
import {
  IBM_VGA_8X16_GLYPHS,
  IBM_VGA_GLYPH_HEIGHT,
  IBM_VGA_GLYPH_WIDTH
} from "./ibm-vga-8x16-font";
import { RetroScreenAccessibleText } from "./RetroScreenAccessibleText";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const FULL_UPLOAD_DIRTY_RATIO = 0.35;

type BitmapGlyphMode = Exclude<RetroScreenDisplayGlyphMode, "font">;

const colorSignature = (color: { red: number; green: number; blue: number; alpha: number }) =>
  `${color.red.toString(16).padStart(2, "0")}${color.green.toString(16).padStart(2, "0")}${color.blue
    .toString(16)
    .padStart(2, "0")}${color.alpha.toString(16).padStart(2, "0")}`;

const resolveRasterCell = ({
  cell,
  displayColorMode,
  displayIceColors,
  displaySurfaceMode,
  blinkVisible
}: {
  cell: RetroScreenRenderModel["cells"][number][number];
  displayColorMode: RetroScreenDisplayColorMode;
  displayIceColors: boolean;
  displaySurfaceMode: RetroScreenDisplaySurfaceMode;
  blinkVisible: boolean;
}): RetroScreenBitmapRasterCell => {
  const presentation = getCellPresentationColors(
    cell,
    displayColorMode,
    displaySurfaceMode,
    displayIceColors
  );
  const glyphIndex = getCp437GlyphIndex(cell.char);
  let foreground = presentation?.foreground ?? hexToRgba("#aaaaaa");
  let background = presentation?.background ?? TRANSPARENT_RGBA;

  if (cell.style.blink && !displayIceColors && !blinkVisible) {
    foreground = TRANSPARENT_RGBA;
  }

  if (cell.isSelected) {
    background = displaySurfaceMode === "light"
      ? hexToRgba("#c7d9c8")
      : hexToRgba("#1f4d2b");
  }

  return {
    glyphIndex,
    foreground,
    background,
    signature: `${glyphIndex}:${colorSignature(foreground)}:${colorSignature(background)}:${cell.isSelected ? 1 : 0}`
  };
};

function RetroScreenCanvasTile({
  cells,
  cols,
  displayGlyphMode,
  defaultBackground,
  startRow,
  totalRows,
  onCanvasUnavailable
}: {
  cells: readonly (readonly (RetroScreenBitmapRasterCell | undefined)[])[];
  cols: number;
  displayGlyphMode: BitmapGlyphMode;
  defaultBackground: ReturnType<typeof hexToRgba>;
  startRow: number;
  totalRows: number;
  onCanvasUnavailable: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelsRef = useRef<Uint8ClampedArray | undefined>(undefined);
  const signaturesRef = useRef<readonly (readonly string[])[] | null>(null);
  const glyphWidth = displayGlyphMode === "ibm-vga-9x16" ? 9 : IBM_VGA_GLYPH_WIDTH;
  const glyphs = displayGlyphMode === "amiga-microknight-8x16"
    ? AMIGA_MICROKNIGHT_8X16_GLYPHS
    : IBM_VGA_8X16_GLYPHS;
  const rows = cells.length;
  const width = Math.max(1, cols * glyphWidth);
  const height = Math.max(1, rows * IBM_VGA_GLYPH_HEIGHT);
  const signatures = useMemo(
    () => cells.map((row) => row.map((cell) => cell.signature)),
    [cells]
  );

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });

    if (!canvas || !context) {
      onCanvasUnavailable();
      return;
    }

    context.imageSmoothingEnabled = false;
    const diff = diffBitmapCellSignatures(signaturesRef.current, signatures);

    if (!diff.changed && pixelsRef.current) {
      canvas.dataset.retroScreenCanvasUpload = "unchanged";
      return;
    }

    const fullUpload =
      !pixelsRef.current ||
      pixelsRef.current.length !== width * height * 4 ||
      diff.dirtyRatio >= FULL_UPLOAD_DIRTY_RATIO;
    const dirtyCells = fullUpload ? undefined : diff.dirtyCells;
    const raster = rasterizeRetroScreenBitmap({
      cells,
      cols,
      rows,
      glyphs,
      glyphWidth,
      glyphHeight: IBM_VGA_GLYPH_HEIGHT,
      defaultBackground,
      previousPixels: pixelsRef.current,
      dirtyCells
    });
    const imageData = context.createImageData(raster.width, raster.height);
    imageData.data.set(raster.pixels);

    if (fullUpload) {
      context.putImageData(imageData, 0, 0);
    } else {
      const bounds = mergeBitmapDirtyBounds(diff.dirtyCells, glyphWidth, IBM_VGA_GLYPH_HEIGHT);
      if (bounds) {
        context.putImageData(
          imageData,
          0,
          0,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height
        );
      }
    }

    pixelsRef.current = raster.pixels;
    signaturesRef.current = signatures;
    canvas.dataset.retroScreenCanvasReady = "true";
    canvas.dataset.retroScreenCanvasUpload = fullUpload ? "full" : "dirty";
    canvas.dataset.retroScreenCanvasDirtyCells = String(diff.dirtyCells.length);
  }, [cells, cols, defaultBackground, glyphWidth, glyphs, height, onCanvasUnavailable, rows, signatures, width]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="retro-screen__bitmap-canvas"
      data-retro-screen-bitmap-canvas="true"
      data-retro-screen-canvas-ready="false"
      data-retro-screen-canvas-start-row={startRow}
      height={height}
      style={{
        top: `${(startRow / Math.max(1, totalRows)) * 100}%`,
        height: `${(rows / Math.max(1, totalRows)) * 100}%`
      }}
      width={width}
    />
  );
}

export function RetroScreenCanvasSurface({
  renderModel,
  rows,
  cols,
  displayColorMode,
  displayGlyphMode,
  displayIceColors,
  displaySurfaceMode,
  accessibilityLabel,
  accessible,
  accessibleText,
  onCanvasUnavailable
}: {
  renderModel: RetroScreenRenderModel;
  rows: number;
  cols: number;
  displayColorMode: RetroScreenDisplayColorMode;
  displayGlyphMode: BitmapGlyphMode;
  displayIceColors: boolean;
  displaySurfaceMode: RetroScreenDisplaySurfaceMode;
  accessibilityLabel?: string;
  accessible: boolean;
  accessibleText: boolean;
  onCanvasUnavailable: () => void;
}) {
  const hasBlinkingCells = useMemo(
    () => !displayIceColors && renderModel.cells.some((row) => row.some((cell) => cell.style.blink)),
    [displayIceColors, renderModel.cells]
  );
  const [blinkVisible, setBlinkVisible] = useState(true);

  useEffect(() => {
    if (!hasBlinkingCells) {
      setBlinkVisible(true);
      return;
    }

    const interval = window.setInterval(() => {
      setBlinkVisible((current) => !current);
    }, 600);

    return () => window.clearInterval(interval);
  }, [hasBlinkingCells]);

  const rasterCells = useMemo(
    () => renderModel.cells.map((row) => row.map((cell) => resolveRasterCell({
      cell,
      displayColorMode,
      displayIceColors,
      displaySurfaceMode,
      blinkVisible
    }))),
    [blinkVisible, displayColorMode, displayIceColors, displaySurfaceMode, renderModel.cells]
  );
  const tiles = useMemo(() => buildBitmapTiles(rows), [rows]);
  const defaultBackground = useMemo(
    () => displayColorMode === "ansi-vga" ? hexToRgba("#000000") : TRANSPARENT_RGBA,
    [displayColorMode]
  );

  return (
    <div
      className="retro-screen__canvas-surface"
      data-retro-screen-canvas-surface="true"
      data-retro-screen-canvas-tile-count={tiles.length}
      role={accessible ? "group" : undefined}
      aria-label={accessible ? accessibilityLabel ?? "RetroScreen bitmap display" : undefined}
      aria-hidden={accessible ? undefined : true}
    >
      {tiles.map((tile) => (
        <RetroScreenCanvasTile
          key={`${tile.startRow}-${tile.endRow}`}
          cells={Array.from(
            { length: tile.rowCount },
            (_, rowOffset) => rasterCells[tile.startRow + rowOffset] ?? []
          )}
          cols={cols}
          defaultBackground={defaultBackground}
          displayGlyphMode={displayGlyphMode}
          startRow={tile.startRow}
          totalRows={rows}
          onCanvasUnavailable={onCanvasUnavailable}
        />
      ))}
      {accessibleText ? <RetroScreenAccessibleText renderModel={renderModel} /> : null}
    </div>
  );
}
