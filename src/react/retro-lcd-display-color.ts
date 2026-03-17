import type { CSSProperties } from "react";
import type { RetroLcdCell, RetroLcdTerminalColor } from "../core/terminal/types";
import type { RetroLcdDisplayColorMode } from "../core/types";

const DISPLAY_MODE_ACCENTS: Record<RetroLcdDisplayColorMode, string> = {
  "phosphor-green": "#97ff9b",
  "phosphor-amber": "#ffc96b",
  "phosphor-ice": "#b8f1ff",
  "ansi-classic": "#d7dde8",
  "ansi-extended": "#d7dde8"
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

const normalizeRgbColor = (value: number) => `#${value.toString(16).padStart(6, "0")}`;

const buildTextGlow = (color: string) =>
  `0 0 8px color-mix(in srgb, ${color}, transparent 82%), 0 0 18px color-mix(in srgb, ${color}, transparent 92%)`;

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

const resolveAnsiClassicColor = (
  color: RetroLcdTerminalColor,
  role: "foreground" | "background"
) => {
  if (color.mode === "rgb") {
    return normalizeRgbColor(color.value);
  }

  if (color.mode === "palette") {
    return ANSI_CLASSIC_PALETTE[color.value] ?? ANSI_CLASSIC_DEFAULT_FOREGROUND;
  }

  return role === "foreground" ? ANSI_CLASSIC_DEFAULT_FOREGROUND : ANSI_CLASSIC_DEFAULT_BACKGROUND;
};

const resolveAnsiExtendedColor = (
  color: RetroLcdTerminalColor,
  role: "foreground" | "background"
) => {
  if (color.mode === "rgb") {
    return normalizeRgbColor(color.value);
  }

  if (color.mode === "palette") {
    return XTERM_256_PALETTE[color.value] ?? ANSI_CLASSIC_DEFAULT_FOREGROUND;
  }

  return role === "foreground" ? ANSI_CLASSIC_DEFAULT_FOREGROUND : ANSI_CLASSIC_DEFAULT_BACKGROUND;
};

export const getDisplayModeRootVars = (
  displayColorMode: RetroLcdDisplayColorMode,
  colorOverride?: string
): CSSProperties => {
  const nextColor = colorOverride ?? DISPLAY_MODE_ACCENTS[displayColorMode];
  const vars = {
    "--retro-lcd-color": nextColor
  } as CSSProperties;

  if (displayColorMode === "ansi-classic" || displayColorMode === "ansi-extended") {
    vars["--retro-lcd-bg-top"] = "#141a24";
    vars["--retro-lcd-bg-bottom"] = ANSI_CLASSIC_DEFAULT_BACKGROUND;
  }

  return vars;
};

export const getCellPresentationStyle = (
  cell: RetroLcdCell,
  displayColorMode: RetroLcdDisplayColorMode
): CSSProperties | undefined => {
  if (displayColorMode !== "ansi-classic" && displayColorMode !== "ansi-extended") {
    return undefined;
  }

  const resolveColor =
    displayColorMode === "ansi-extended" ? resolveAnsiExtendedColor : resolveAnsiClassicColor;
  const resolvedForeground = resolveColor(cell.style.foreground, "foreground");
  const resolvedBackground = resolveColor(cell.style.background, "background");
  const [color, backgroundColor] = cell.style.inverse
    ? [resolvedBackground, resolvedForeground]
    : [resolvedForeground, resolvedBackground];
  const showBackground = cell.style.inverse || cell.style.background.mode !== "default";

  return {
    color: cell.style.conceal ? "transparent" : color,
    backgroundColor: showBackground ? backgroundColor : "transparent",
    textShadow: cell.style.conceal ? "none" : buildTextGlow(color)
  };
};
