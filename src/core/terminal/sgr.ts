import type { RetroLcdCellStyle, RetroLcdTerminalColor } from "./types";

export const DEFAULT_TERMINAL_COLOR: RetroLcdTerminalColor = {
  mode: "default",
  value: 0
};

export const cloneColor = (color: RetroLcdTerminalColor): RetroLcdTerminalColor => ({ ...color });

export const DEFAULT_CELL_STYLE: RetroLcdCellStyle = {
  intensity: "normal",
  inverse: false,
  conceal: false,
  blink: false,
  foreground: DEFAULT_TERMINAL_COLOR,
  background: DEFAULT_TERMINAL_COLOR
};

export const cloneStyle = (style: RetroLcdCellStyle): RetroLcdCellStyle => ({
  ...style,
  foreground: cloneColor(style.foreground),
  background: cloneColor(style.background)
});

const clampColorByte = (value: number) =>
  Math.max(0, Math.min(255, Number.isFinite(value) ? Math.floor(value) : 0));

const toRgbColor = (red: number, green: number, blue: number): RetroLcdTerminalColor => ({
  mode: "rgb",
  value: (clampColorByte(red) << 16) | (clampColorByte(green) << 8) | clampColorByte(blue)
});

const toPaletteColor = (value: number): RetroLcdTerminalColor => ({
  mode: "palette",
  value: Math.max(0, Math.min(255, Number.isFinite(value) ? Math.floor(value) : 0))
});

const setExtendedColor = (
  style: RetroLcdCellStyle,
  channel: "foreground" | "background",
  params: number[],
  index: number
) => {
  const colorMode = params[index + 1];

  if (colorMode === 5) {
    const paletteIndex = params[index + 2];
    if (paletteIndex !== undefined) {
      style[channel] = toPaletteColor(paletteIndex);
      return index + 2;
    }

    return index;
  }

  if (colorMode === 2) {
    const red = params[index + 2];
    const green = params[index + 3];
    const blue = params[index + 4];
    if (red !== undefined && green !== undefined && blue !== undefined) {
      style[channel] = toRgbColor(red, green, blue);
      return index + 4;
    }
  }

  return index;
};

export const applySgrParameters = (style: RetroLcdCellStyle, params: number[]) => {
  const nextStyle = cloneStyle(style);
  const values = params.length > 0 ? params : [0];

  for (let index = 0; index < values.length; index += 1) {
    const code = values[index];

    switch (code) {
      case 0:
        Object.assign(nextStyle, cloneStyle(DEFAULT_CELL_STYLE));
        break;
      case 1:
        nextStyle.intensity = "bold";
        break;
      case 2:
        nextStyle.intensity = "faint";
        break;
      case 5:
        nextStyle.blink = true;
        break;
      case 7:
        nextStyle.inverse = true;
        break;
      case 8:
        nextStyle.conceal = true;
        break;
      case 22:
        nextStyle.intensity = "normal";
        break;
      case 25:
        nextStyle.blink = false;
        break;
      case 27:
        nextStyle.inverse = false;
        break;
      case 28:
        nextStyle.conceal = false;
        break;
      case 30:
      case 31:
      case 32:
      case 33:
      case 34:
      case 35:
      case 36:
      case 37:
        nextStyle.foreground = toPaletteColor(code - 30);
        break;
      case 38:
        index = setExtendedColor(nextStyle, "foreground", values, index);
        break;
      case 39:
        nextStyle.foreground = cloneColor(DEFAULT_TERMINAL_COLOR);
        break;
      case 40:
      case 41:
      case 42:
      case 43:
      case 44:
      case 45:
      case 46:
      case 47:
        nextStyle.background = toPaletteColor(code - 40);
        break;
      case 48:
        index = setExtendedColor(nextStyle, "background", values, index);
        break;
      case 49:
        nextStyle.background = cloneColor(DEFAULT_TERMINAL_COLOR);
        break;
      case 90:
      case 91:
      case 92:
      case 93:
      case 94:
      case 95:
      case 96:
      case 97:
        nextStyle.foreground = toPaletteColor(code - 82);
        break;
      case 100:
      case 101:
      case 102:
      case 103:
      case 104:
      case 105:
      case 106:
      case 107:
        nextStyle.background = toPaletteColor(code - 92);
        break;
      default:
        break;
    }
  }

  return nextStyle;
};
