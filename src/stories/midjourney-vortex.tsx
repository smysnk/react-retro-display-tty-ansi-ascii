import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { RetroScreenCell, RetroScreenCellStyle } from "../core/terminal/types";
import { RetroScreen } from "../react/RetroScreen";

const VORTEX_COLOR = "#f4f4f1";
const TAU = Math.PI * 2;
const FRAME_MS = 48;
const CYCLE_MS = 18_000;

const SOURCE_LINES = [
  "midjourney midjourney midjourney midjourney midjourney midjourney",
  "a screen of language slowly folding into a singular image",
  "beauty coordination reflection imagination and motion",
  "every phrase drifts inward until it becomes a living orbit",
  "the field begins as text then resolves into a white vortex",
  "stories gather density around the center and keep turning"
] as const;

const SHADE_VALUES = [0x050608, 0x11131d, 0x2a2338, 0x5a4e77, 0xa9a7c8, 0xf7f4ff] as const;

const SHADE_STYLES: readonly RetroScreenCellStyle[] = SHADE_VALUES.map((value) => ({
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

const pickStarChar = (intensity: number) => {
  if (intensity > 1.78) {
    return "✦";
  }

  if (intensity > 1.56) {
    return "·";
  }

  return "•";
};

type Particle = {
  char: string;
  startRow: number;
  startCol: number;
  orbit: number;
  band: number;
  phase: number;
  drift: number;
  noise: number;
};

type MidjourneyVortexScreenProps = {
  rows?: number;
  cols?: number;
  style?: CSSProperties;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
};

const createTextGrid = (rows: number, cols: number) =>
  Array.from({ length: rows }, (_, rowIndex) => {
    const source = SOURCE_LINES[rowIndex % SOURCE_LINES.length] ?? SOURCE_LINES[0];
    const offset = (rowIndex * 7) % Math.max(1, source.length);
    const rotated = `${source.slice(offset)} ${source.slice(0, offset)}`.trim();
    const repeated = `${rotated}     `.repeat(Math.ceil((cols + 12) / Math.max(1, rotated.length + 5)));
    return repeated.slice(0, cols).padEnd(cols, " ");
  });

const createParticles = (grid: readonly string[]) => {
  const particles: Particle[] = [];
  const cols = grid[0]?.length ?? 0;

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const line = grid[rowIndex] ?? "";

    for (let colIndex = 0; colIndex < cols; colIndex += 1) {
      const char = line[colIndex] ?? " ";
      if (char === " ") {
        continue;
      }

      const seed = particles.length + rowIndex * cols + colIndex;
      const orbit = (seed * 0.61803398875) % 1;
      const band = (seed * 0.38196601125) % 1;
      const phase = (seed * 0.17320508075) % 1;
      const drift = (seed * 0.70710678118) % 1;
      const noise = (seed * 0.41421356237) % 1;

      particles.push({
        char,
        startRow: rowIndex,
        startCol: colIndex,
        orbit,
        band,
        phase,
        drift,
        noise
      });
    }
  }

  return particles;
};

const createBlankCells = (rows: number, cols: number): RetroScreenCell[][] =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      char: " ",
      style: SHADE_STYLES[0]!
    }))
  );

const getNebulaShade = ({
  row,
  col,
  rows,
  cols,
  spin,
  morph
}: {
  row: number;
  col: number;
  rows: number;
  cols: number;
  spin: number;
  morph: number;
}) => {
  const nx = (col - cols / 2) / Math.max(1, cols / 2);
  const ny = (row - rows / 2) / Math.max(1, rows / 2);
  const tiltX = nx * 0.92 + ny * 0.22;
  const tiltY = ny * 1.24 - nx * 0.16;
  const radius = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
  const angle = Math.atan2(tiltY, tiltX);
  const lane =
    Math.sin(angle * 2 + radius * 8.2 - spin * 1.2) * 0.55 +
    Math.sin(angle * 5 - radius * 5.4 + spin * 0.8) * 0.24 +
    Math.sin(angle * 11 + radius * 14.2 - spin * 0.32) * 0.12 +
    Math.sin(angle * 17 - radius * 21.8 + spin * 0.18) * 0.07 +
    Math.sin(angle * 3 - radius * 3.6 + spin * 0.27) * 0.18;
  const disk = Math.max(0, 1 - radius * 0.96);
  const haze = disk * Math.max(0, lane + 0.26) * morph;
  const starNoise =
    Math.sin(nx * 140.3 + ny * 51.7 + spin * 0.4) *
      Math.sin(nx * 37.9 - ny * 91.1 - spin * 0.22) +
    Math.sin(nx * 233.4 + ny * 173.2 + 0.6) +
    Math.sin(nx * 412.8 - ny * 302.6 - spin * 0.1) * 0.7;

  if (radius < 0.08) {
    return 5;
  }

  if (radius > 0.52 && starNoise > 1.34 && morph > 0.24) {
    return 2;
  }

  if (radius > 0.38 && starNoise > 1.52 && morph > 0.32) {
    return 3;
  }

  if (radius > 0.24 && starNoise > 1.76 && morph > 0.48) {
    return 4;
  }

  if (haze > 0.44) {
    return 3;
  }

  if (haze > 0.2) {
    return 2;
  }

  if (haze > 0.08) {
    return 1;
  }

  return 0;
};

const renderMidjourneyVortexCells = ({
  rows,
  cols,
  particles,
  progress,
  textGrid
}: {
  rows: number;
  cols: number;
  particles: readonly Particle[];
  progress: number;
  textGrid: readonly string[];
}) => {
  const cells = createBlankCells(rows, cols);
  const strengths = Array.from({ length: rows }, () => Array.from({ length: cols }, () => -1));
  const morph = smoothstep(0.08, 0.7, progress);
  const spin = progress * TAU * 0.46;
  const radiusX = cols * 0.6;
  const radiusY = rows * 0.5;
  const centerX = (cols - 1) / 2;
  const centerY = (rows - 1) / 2;
  const tilt = -0.48;
  const armTwist = 2.2;
  const armCount = 2;
  const corePulse = 0.04 * Math.sin(progress * TAU * 1.2);
  const order = smoothstep(0.24, 0.96, progress);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let colIndex = 0; colIndex < cols; colIndex += 1) {
      const ghostChar = textGrid[rowIndex]?.[colIndex] ?? " ";
      const nebulaShade = getNebulaShade({
        row: rowIndex,
        col: colIndex,
        rows,
        cols,
        spin,
        morph
      });
      if (nebulaShade > 0) {
        const starNoise =
          Math.sin(colIndex * 0.91 + rowIndex * 0.27 + spin * 0.8) +
          Math.sin(colIndex * 0.22 - rowIndex * 0.63 - spin * 0.34);
        cells[rowIndex]![colIndex] = {
          char: ghostChar === " " ? pickStarChar(starNoise) : ghostChar,
          style: SHADE_STYLES[nebulaShade]!
        };
        strengths[rowIndex]![colIndex] = nebulaShade;
      }

      if (ghostChar === " ") {
        continue;
      }

      const ghostShade = morph < 0.15 ? 3 : morph < 0.42 ? 2 : 1;
      cells[rowIndex]![colIndex] = {
        char: ghostChar,
        style: SHADE_STYLES[ghostShade]!
      };
      strengths[rowIndex]![colIndex] = ghostShade;
    }
  }

  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index]!;
    const armIndex = Math.floor(particle.orbit * armCount) % armCount;
    const armPhase = (particle.orbit * armCount) % 1;
    const radial = 0.03 + particle.band * 0.94;
    const wobble = 0.02 * Math.sin(progress * TAU * 1.4 + particle.phase * TAU * 2);
    const filamentOffset =
      Math.sin(radial * 23 + progress * TAU * 0.9 + particle.noise * TAU * 2) * 0.09 +
      Math.sin(radial * 8 - progress * TAU * 0.4 + particle.phase * TAU) * 0.04 +
      Math.sin(radial * 35 + particle.noise * TAU * 3 - progress * TAU * 0.2) * 0.03 +
      Math.sin(radial * 5 + particle.phase * TAU * 2 + progress * TAU * 0.14) * 0.08;
    const spiralAngle =
      spin +
      armIndex * (TAU / armCount) +
      armPhase * 0.55 +
      radial * armTwist * TAU +
      particle.drift * 0.38 +
      filamentOffset;
    const spreadX = (radial + wobble + corePulse) * radiusX;
    const spreadY = (radial * 0.78 + wobble + corePulse + filamentOffset * 0.12) * radiusY;
    const rawX = Math.cos(spiralAngle) * spreadX;
    const rawY = Math.sin(spiralAngle) * spreadY;
    const targetCol = centerX + rawX;
    const targetRow = centerY + rawY * Math.cos(tilt) + rawX * Math.sin(tilt) * 0.18;
    const currentCol = particle.startCol + (targetCol - particle.startCol) * (0.18 + order * 0.82);
    const currentRow = particle.startRow + (targetRow - particle.startRow) * (0.18 + order * 0.82);
    const rasterCol = clamp(Math.round(currentCol), 0, cols - 1);
    const rasterRow = clamp(Math.round(currentRow), 0, rows - 1);
    const distanceFromCore = Math.abs(radial - 0.1);
    const armBrightness = filamentOffset > 0.03 ? 1 : filamentOffset < -0.08 ? -1 : 0;
    const flowBand =
      Math.sin(spiralAngle * 2.4 - progress * TAU * 2.4 + particle.phase * TAU) * 0.5 +
      Math.sin(radial * 19 - progress * TAU * 1.3 + particle.noise * TAU * 2) * 0.5;
    const hotness =
      distanceFromCore < 0.07
        ? 5
        : distanceFromCore < 0.15
          ? 4
          : 2 + Math.floor((1 - particle.band) * 2) + armBrightness;
    const orderedShadeBoost = flowBand > 0.58 ? 2 : flowBand > 0.22 ? 1 : 0;
    const shade = clamp(
      morph < 0.35 ? hotness - 1 : hotness + Math.round(order * orderedShadeBoost),
      1,
      SHADE_STYLES.length - 1
    );
    const outputChar =
      order > 0.4 && flowBand > 0.56
        ? particle.noise > 0.7
          ? "✦"
          : "•"
        : shade >= 4 && particle.noise > 0.72
          ? "✦"
          : particle.char;

    if (shade < strengths[rasterRow]![rasterCol]!) {
      continue;
    }

    cells[rasterRow]![rasterCol] = {
      char: outputChar,
      style: SHADE_STYLES[shade]!
    };
    strengths[rasterRow]![rasterCol] = shade;
  }

  return cells;
};

export function MidjourneyVortexScreen({
  rows = 40,
  cols = 156,
  style
}: MidjourneyVortexScreenProps) {
  const textGrid = useMemo(() => createTextGrid(rows, cols), [cols, rows]);
  const particles = useMemo(() => createParticles(textGrid), [textGrid]);
  const [progress, setProgress] = useState(0);
  const cells = useMemo(
    () =>
      renderMidjourneyVortexCells({
        rows,
        cols,
        particles,
        progress,
        textGrid
      }),
    [cols, particles, progress, rows, textGrid]
  );
  const inlineStyle = useMemo(
    () =>
      ({
        ...style
      }) as CSSProperties,
    [style]
  );

  useEffect(() => {
    let timer = 0;
    let cancelled = false;
    const startedAt = performance.now();

    const tick = () => {
      if (cancelled) {
        return;
      }

      const elapsed = performance.now() - startedAt;
      setProgress((elapsed % CYCLE_MS) / CYCLE_MS);
      timer = window.setTimeout(tick, FRAME_MS);
    };

    tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <RetroScreen
      mode="value"
      value=""
      cells={cells}
      gridMode="static"
      rows={rows}
      cols={cols}
      color={VORTEX_COLOR}
      displayColorMode="ansi-extended"
      displayPadding={0}
      displayLayoutMode="fit-width"
      displayLayoutMaxHeight={1040}
      displayScanlines={false}
      disableCellRowScale
      style={inlineStyle}
    />
  );
}
