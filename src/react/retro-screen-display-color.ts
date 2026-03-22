import type { CSSProperties } from "react";
import type { RetroScreenCell, RetroScreenTerminalColor } from "../core/terminal/types";
import type { RetroScreenDisplayColorMode, RetroScreenDisplaySurfaceMode } from "../core/types";

const DISPLAY_MODE_ACCENTS: Record<RetroScreenDisplayColorMode, string> = {
  "phosphor-green": "#97ff9b",
  "phosphor-amber": "#ffc96b",
  "phosphor-ice": "#b8f1ff",
  "ansi-classic": "#d7dde8",
  "ansi-extended": "#d7dde8"
};

const LIGHT_SURFACE_BACKGROUNDS: Record<
  RetroScreenDisplayColorMode,
  {
    top: string;
    bottom: string;
  }
> = {
  "phosphor-green": {
    top: "#fbfdf7",
    bottom: "#edf5e7"
  },
  "phosphor-amber": {
    top: "#fffaf2",
    bottom: "#f7efdf"
  },
  "phosphor-ice": {
    top: "#f7fcff",
    bottom: "#e8f3f8"
  },
  "ansi-classic": {
    top: "#f8f9fd",
    bottom: "#e8edf5"
  },
  "ansi-extended": {
    top: "#f8f9fd",
    bottom: "#e8edf5"
  }
};

const ANSI_CLASSIC_DEFAULT_FOREGROUND = "#d7dde8";
const ANSI_CLASSIC_DEFAULT_BACKGROUND = "#090d12";
const ANSI_CLASSIC_PALETTE = [
  "#1d232c",
  "#d16d68",
  "#8ec07c",
  "#d8b05d",
  "#78a5f5",
  "#c58af9",
  "#6fd1d7",
  "#d7dde8",
  "#5b6472",
  "#ff8a80",
  "#b6f67d",
  "#ffe082",
  "#8cb8ff",
  "#d4a1ff",
  "#8ce6ee",
  "#ffffff"
];

const XTERM_BASE_PALETTE = [
  "#000000",
  "#cd0000",
  "#00cd00",
  "#cdcd00",
  "#0000ee",
  "#cd00cd",
  "#00cdcd",
  "#e5e5e5",
  "#7f7f7f",
  "#ff0000",
  "#00ff00",
  "#ffff00",
  "#5c5cff",
  "#ff00ff",
  "#00ffff",
  "#ffffff"
];

const EXTENDED_PALETTE_STEPS = [0, 95, 135, 175, 215, 255];

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

const normalizeRgbColor = (value: number) => `#${value.toString(16).padStart(6, "0")}`;

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const parseHexColor = (value: string): RgbColor => {
  const normalized = value.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((segment) => `${segment}${segment}`)
          .join("")
      : normalized;

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16)
  };
};

const toHexColor = ({ red, green, blue }: RgbColor) =>
  `#${clampByte(red).toString(16).padStart(2, "0")}${clampByte(green)
    .toString(16)
    .padStart(2, "0")}${clampByte(blue).toString(16).padStart(2, "0")}`;

const toRgbaColor = ({ red, green, blue }: RgbColor, alpha: number) =>
  `rgba(${clampByte(red)}, ${clampByte(green)}, ${clampByte(blue)}, ${Math.max(0, Math.min(1, alpha))})`;

const mixColors = (left: string, right: string, ratio: number) => {
  const leftColor = parseHexColor(left);
  const rightColor = parseHexColor(right);
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  return toHexColor({
    red: leftColor.red + (rightColor.red - leftColor.red) * clampedRatio,
    green: leftColor.green + (rightColor.green - leftColor.green) * clampedRatio,
    blue: leftColor.blue + (rightColor.blue - leftColor.blue) * clampedRatio
  });
};

const toLuminanceChannel = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const getRelativeLuminance = (value: string) => {
  const { red, green, blue } = parseHexColor(value);
  return (
    0.2126 * toLuminanceChannel(red) +
    0.7152 * toLuminanceChannel(green) +
    0.0722 * toLuminanceChannel(blue)
  );
};

const getContrastRatio = (left: string, right: string) => {
  const leftLuminance = getRelativeLuminance(left);
  const rightLuminance = getRelativeLuminance(right);
  const brighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);

  return (brighter + 0.05) / (darker + 0.05);
};

const ensureContrast = (value: string, background: string, minimumRatio: number) => {
  if (getContrastRatio(value, background) >= minimumRatio) {
    return value;
  }

  const backgroundIsLight = getRelativeLuminance(background) >= 0.55;
  const target = backgroundIsLight ? "#111111" : "#ffffff";

  let bestColor = value;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixColors(value, target, step / 20);
    bestColor = candidate;

    if (getContrastRatio(candidate, background) >= minimumRatio) {
      return candidate;
    }
  }

  return bestColor;
};

const ensureBackgroundContrast = (
  value: string,
  foreground: string,
  surface: string,
  minimumRatio: number
) => {
  if (getContrastRatio(value, foreground) >= minimumRatio) {
    return value;
  }

  let bestColor = value;
  for (let step = 1; step <= 20; step += 1) {
    const surfaceCandidate = mixColors(value, surface, step / 20);
    bestColor = surfaceCandidate;

    if (getContrastRatio(surfaceCandidate, foreground) >= minimumRatio) {
      return surfaceCandidate;
    }

    const whiteCandidate = mixColors(surfaceCandidate, "#ffffff", step / 24);
    bestColor = whiteCandidate;

    if (getContrastRatio(whiteCandidate, foreground) >= minimumRatio) {
      return whiteCandidate;
    }
  }

  return bestColor;
};

const buildTextGlow = (color: string, displaySurfaceMode: RetroScreenDisplaySurfaceMode) => {
  const rgbColor = parseHexColor(color);

  if (displaySurfaceMode === "light") {
    return `0 0 3px ${toRgbaColor(rgbColor, 0.1)}, 0 0 8px ${toRgbaColor(rgbColor, 0.06)}`;
  }

  return `0 0 8px ${toRgbaColor(rgbColor, 0.18)}, 0 0 18px ${toRgbaColor(rgbColor, 0.08)}`;
};

const buildXtermPalette = () => {
  const palette = [...XTERM_BASE_PALETTE];

  for (let red = 0; red < 6; red += 1) {
    for (let green = 0; green < 6; green += 1) {
      for (let blue = 0; blue < 6; blue += 1) {
        palette.push(
          normalizeRgbColor(
            (EXTENDED_PALETTE_STEPS[red] << 16) |
              (EXTENDED_PALETTE_STEPS[green] << 8) |
              EXTENDED_PALETTE_STEPS[blue]
          )
        );
      }
    }
  }

  for (let value = 0; value < 24; value += 1) {
    const shade = 8 + value * 10;
    palette.push(normalizeRgbColor((shade << 16) | (shade << 8) | shade));
  }

  return palette;
};

const XTERM_256_PALETTE = buildXtermPalette();

const getSurfaceBackground = (
  displayColorMode: RetroScreenDisplayColorMode,
  displaySurfaceMode: RetroScreenDisplaySurfaceMode
) =>
  displaySurfaceMode === "light"
    ? LIGHT_SURFACE_BACKGROUNDS[displayColorMode]
    : {
        top:
          displayColorMode === "ansi-classic" || displayColorMode === "ansi-extended"
            ? "#141a24"
            : "#071008",
        bottom:
          displayColorMode === "ansi-classic" || displayColorMode === "ansi-extended"
            ? ANSI_CLASSIC_DEFAULT_BACKGROUND
            : "#071008"
      };

const getDefaultAnsiForeground = (
  displayColorMode: RetroScreenDisplayColorMode,
  displaySurfaceMode: RetroScreenDisplaySurfaceMode
) => {
  if (displaySurfaceMode === "dark") {
    return ANSI_CLASSIC_DEFAULT_FOREGROUND;
  }

  return ensureContrast(
    ANSI_CLASSIC_DEFAULT_FOREGROUND,
    getSurfaceBackground(displayColorMode, displaySurfaceMode).bottom,
    7
  );
};

const resolveAnsiColor = (
  color: RetroScreenTerminalColor,
  role: "foreground" | "background",
  palette: string[],
  displayColorMode: RetroScreenDisplayColorMode,
  displaySurfaceMode: RetroScreenDisplaySurfaceMode
) => {
  const surfaceBackground = getSurfaceBackground(displayColorMode, displaySurfaceMode).bottom;
  const defaultForeground = getDefaultAnsiForeground(displayColorMode, displaySurfaceMode);
  const baseColor =
    color.mode === "rgb"
      ? normalizeRgbColor(color.value)
      : color.mode === "palette"
        ? palette[color.value] ?? ANSI_CLASSIC_DEFAULT_FOREGROUND
        : role === "foreground"
          ? ANSI_CLASSIC_DEFAULT_FOREGROUND
          : ANSI_CLASSIC_DEFAULT_BACKGROUND;

  if (displaySurfaceMode === "dark") {
    return role === "foreground" || color.mode !== "default"
      ? baseColor
      : ANSI_CLASSIC_DEFAULT_BACKGROUND;
  }

  if (role === "foreground") {
    if (color.mode === "default") {
      return defaultForeground;
    }

    return ensureContrast(baseColor, surfaceBackground, 4.8);
  }

  if (color.mode === "default") {
    return surfaceBackground;
  }

  const tintedColor = mixColors(baseColor, surfaceBackground, 0.76);
  return ensureBackgroundContrast(tintedColor, defaultForeground, surfaceBackground, 5);
};

export const getDisplayModeRootVars = (
  displayColorMode: RetroScreenDisplayColorMode,
  displaySurfaceMode: RetroScreenDisplaySurfaceMode,
  colorOverride?: string
): CSSProperties => {
  const surface = getSurfaceBackground(displayColorMode, displaySurfaceMode);
  const baseAccent = colorOverride ?? DISPLAY_MODE_ACCENTS[displayColorMode];
  const nextColor =
    displaySurfaceMode === "light" ? ensureContrast(baseAccent, surface.bottom, 6) : baseAccent;

  return {
    "--retro-screen-color": nextColor,
    "--retro-screen-color-soft": mixColors(nextColor, surface.bottom, 0.18),
    "--retro-screen-color-dim": mixColors(
      nextColor,
      surface.bottom,
      displaySurfaceMode === "light" ? 0.42 : 0.5
    ),
    "--retro-screen-bg-top": surface.top,
    "--retro-screen-bg-bottom": surface.bottom,
    "--retro-screen-inverse-foreground": displaySurfaceMode === "light" ? surface.bottom : "#071008",
    "--retro-screen-inverse-background": nextColor
  } as CSSProperties;
};

export const getCellPresentationStyle = (
  cell: RetroScreenCell,
  displayColorMode: RetroScreenDisplayColorMode,
  displaySurfaceMode: RetroScreenDisplaySurfaceMode
): CSSProperties | undefined => {
  if (displayColorMode !== "ansi-classic" && displayColorMode !== "ansi-extended") {
    return undefined;
  }

  const palette = displayColorMode === "ansi-extended" ? XTERM_256_PALETTE : ANSI_CLASSIC_PALETTE;
  const resolvedForeground = resolveAnsiColor(
    cell.style.foreground,
    "foreground",
    palette,
    displayColorMode,
    displaySurfaceMode
  );
  const resolvedBackground = resolveAnsiColor(
    cell.style.background,
    "background",
    palette,
    displayColorMode,
    displaySurfaceMode
  );
  let [color, backgroundColor] = cell.style.inverse
    ? [resolvedBackground, resolvedForeground]
    : [resolvedForeground, resolvedBackground];
  const showBackground = cell.style.inverse || cell.style.background.mode !== "default";
  const surfaceBackground = getSurfaceBackground(displayColorMode, displaySurfaceMode).bottom;

  if (displaySurfaceMode === "light" && showBackground) {
    backgroundColor = ensureBackgroundContrast(backgroundColor, color, surfaceBackground, 4.8);
    color = ensureContrast(color, backgroundColor, 4.8);
  }

  return {
    color: cell.style.conceal ? "transparent" : color,
    backgroundColor: showBackground ? backgroundColor : "transparent",
    textShadow: cell.style.conceal ? "none" : buildTextGlow(color, displaySurfaceMode)
  };
};
