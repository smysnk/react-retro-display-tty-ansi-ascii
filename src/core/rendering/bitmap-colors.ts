export type RetroScreenRgbaColor = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

export const TRANSPARENT_RGBA: RetroScreenRgbaColor = {
  red: 0,
  green: 0,
  blue: 0,
  alpha: 0
};

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export const hexToRgba = (value: string, alpha = 255): RetroScreenRgbaColor => {
  const normalized = value.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((segment) => `${segment}${segment}`).join("")
    : normalized;

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
    alpha: clampByte(alpha)
  };
};

export const rgbaToHex = ({ red, green, blue }: RetroScreenRgbaColor) =>
  `#${clampByte(red).toString(16).padStart(2, "0")}${clampByte(green)
    .toString(16)
    .padStart(2, "0")}${clampByte(blue).toString(16).padStart(2, "0")}`;

export const rgbaToCss = (color: RetroScreenRgbaColor) => {
  if (color.alpha <= 0) {
    return "transparent";
  }

  if (color.alpha >= 255) {
    return rgbaToHex(color);
  }

  return `rgba(${clampByte(color.red)}, ${clampByte(color.green)}, ${clampByte(color.blue)}, ${(
    color.alpha / 255
  ).toFixed(4)})`;
};

export const rgbaEquals = (left: RetroScreenRgbaColor, right: RetroScreenRgbaColor) =>
  left.red === right.red &&
  left.green === right.green &&
  left.blue === right.blue &&
  left.alpha === right.alpha;
