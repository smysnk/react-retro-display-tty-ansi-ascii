import type { CSSProperties } from "react";

export const getDisplayTypographyVars = (
  displayFontScale?: number,
  displayRowScale?: number
): CSSProperties => {
  const vars = {} as CSSProperties;

  if (Number.isFinite(displayFontScale) && displayFontScale !== undefined) {
    vars["--retro-lcd-font-scale"] = String(Math.max(0.1, displayFontScale));
  }

  if (Number.isFinite(displayRowScale) && displayRowScale !== undefined) {
    vars["--retro-lcd-row-scale"] = String(Math.max(0.1, displayRowScale));
  }

  return vars;
};
