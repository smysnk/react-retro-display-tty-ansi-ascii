import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { RetroScreenCell } from "../core/terminal/types";
import type { RetroScreenDisplayPadding } from "../core/types";
import { RetroScreen } from "../react/RetroScreen";

const MATRIX_GREEN = "#8efe8e";
export const MATRIX_FONT_FAMILY = "\"Matrix\"";
const SHADE_COLORS = [
  0x09280e,
  0x12681d,
  0x22b032,
  0x68ff83,
  0xe6ffeb
] as const;
const GLYPH_POOL = Array.from(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()-_=+[]{}<>?/\\|"
);

const SHADE_STYLES = SHADE_COLORS.map((value) => ({
  intensity: "normal" as const,
  bold: false,
  faint: false,
  inverse: false,
  conceal: false,
  blink: false,
  foreground: {
    mode: "rgb" as const,
    value
  },
  background: {
    mode: "default" as const,
    value: 0
  }
}));

type MatrixRainColumn = {
  head: number;
  speed: number;
  trail: number;
  gap: number;
  shimmerSeed: number;
};

type MatrixRainEngine = {
  rows: number;
  cols: number;
  frame: number;
  rng: () => number;
  glyphs: string[][];
  columns: MatrixRainColumn[];
};

type MatrixCodeRainScreenProps = {
  rows?: number;
  cols?: number;
  tickMs?: number;
  displayPadding?: RetroScreenDisplayPadding;
  displayFontScale?: number;
  displayRowScale?: number;
  style?: CSSProperties;
};

const createMulberry32 = (seed: number) => {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const pickGlyph = (rng: () => number) => GLYPH_POOL[Math.floor(rng() * GLYPH_POOL.length)] ?? "0";

const createColumn = (rng: () => number, rows: number): MatrixRainColumn => {
  const trail = 8 + Math.floor(rng() * Math.max(10, rows * 0.58));

  return {
    head: -(rng() * rows * 1.5),
    speed: 0.18 + rng() * 0.34,
    trail,
    gap: 4 + Math.floor(rng() * Math.max(8, rows * 0.6)),
    shimmerSeed: Math.floor(rng() * 10_000)
  };
};

const createMatrixRainEngine = (rows: number, cols: number, seed = 1999): MatrixRainEngine => {
  const rng = createMulberry32(seed);

  return {
    rows,
    cols,
    frame: 0,
    rng,
    glyphs: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => pickGlyph(rng))
    ),
    columns: Array.from({ length: cols }, () => createColumn(rng, rows))
  };
};

const mutateColumnGlyphs = (engine: MatrixRainEngine, col: number) => {
  const column = engine.columns[col]!;
  const activeRow = Math.floor(column.head);
  const mutationCount = 1 + Math.floor(column.speed * 6);

  for (let index = 0; index < mutationCount; index += 1) {
    const favorTrail = engine.rng() < 0.62;
    const row = favorTrail && activeRow >= 0
      ? Math.max(
          0,
          Math.min(
            engine.rows - 1,
            activeRow - Math.floor(engine.rng() * Math.max(3, column.trail * 0.7))
          )
        )
      : Math.floor(engine.rng() * engine.rows);
    engine.glyphs[row]![col] = pickGlyph(engine.rng);
  }
};

const advanceMatrixRain = (engine: MatrixRainEngine) => {
  engine.frame += 1;

  for (let col = 0; col < engine.cols; col += 1) {
    const column = engine.columns[col]!;
    column.head += column.speed;

    if (column.head - column.trail > engine.rows + column.gap) {
      const next = createColumn(engine.rng, engine.rows);
      column.head = -next.gap - engine.rng() * engine.rows * 0.65;
      column.speed = next.speed;
      column.trail = next.trail;
      column.gap = next.gap;
      column.shimmerSeed = next.shimmerSeed;
    }

    mutateColumnGlyphs(engine, col);
  }
};

const getCellShade = (engine: MatrixRainEngine, row: number, col: number) => {
  const column = engine.columns[col]!;
  const distance = Math.floor(column.head) - row;

  if (distance === 0) {
    return 4;
  }

  if (distance > 0 && distance < column.trail) {
    const ratio = 1 - distance / column.trail;

    if (ratio > 0.78) {
      return 3;
    }

    if (ratio > 0.42) {
      return 2;
    }

    return 1;
  }

  const shimmerValue = (engine.frame + row * 11 + col * 17 + column.shimmerSeed) % 97;
  return shimmerValue === 0 ? 1 : 0;
};

const renderMatrixRainCells = (engine: MatrixRainEngine): RetroScreenCell[][] =>
  Array.from({ length: engine.rows }, (_, row) =>
    Array.from({ length: engine.cols }, (_, col) => ({
      char: engine.glyphs[row]![col] ?? " ",
      style: SHADE_STYLES[getCellShade(engine, row, col)] ?? SHADE_STYLES[0]!
    }))
  );

export function MatrixCodeRainScreen({
  rows = 24,
  cols = 58,
  tickMs = 62,
  displayPadding = { block: 0, inline: 8 },
  displayFontScale = 1.05,
  displayRowScale = 1.08,
  style
}: MatrixCodeRainScreenProps) {
  const [cells, setCells] = useState<RetroScreenCell[][]>(() =>
    renderMatrixRainCells(createMatrixRainEngine(rows, cols))
  );
  const inlineStyle = useMemo(
    () =>
      ({
        "--retro-screen-font-family": MATRIX_FONT_FAMILY,
        ...style
      }) as CSSProperties,
    [style]
  );

  useEffect(() => {
    const engine = createMatrixRainEngine(rows, cols);
    let timer = 0;
    let cancelled = false;

    const paint = () => {
      advanceMatrixRain(engine);
      setCells(renderMatrixRainCells(engine));
    };

    const scheduleNext = () => {
      timer = window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        paint();
        scheduleNext();
      }, tickMs);
    };

    paint();
    scheduleNext();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cols, rows, tickMs]);

  return (
    <RetroScreen
      mode="value"
      value=""
      cells={cells}
      gridMode="static"
      rows={rows}
      cols={cols}
      color={MATRIX_GREEN}
      displayColorMode="ansi-extended"
      displayPadding={displayPadding}
      displayFontScale={displayFontScale}
      displayRowScale={displayRowScale}
      displayLayoutMode="fit-width"
      style={inlineStyle}
    />
  );
}
