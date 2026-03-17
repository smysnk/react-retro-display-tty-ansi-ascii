import type { CSSProperties } from "react";
import type {
  RetroLcdDisplayPadding,
  RetroLcdDisplayPaddingValue
} from "../core/types";

const toCssLength = (value?: RetroLcdDisplayPaddingValue) => {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "number" ? `${value}px` : value;
};

const setVar = (
  vars: CSSProperties,
  name: string,
  value?: RetroLcdDisplayPaddingValue
) => {
  const resolved = toCssLength(value);

  if (resolved !== undefined) {
    vars[name] = resolved;
  }
};

export const getDisplayPaddingVars = (
  displayPadding?: RetroLcdDisplayPadding
): CSSProperties => {
  if (displayPadding === undefined) {
    return {};
  }

  if (typeof displayPadding === "number" || typeof displayPadding === "string") {
    const resolved = toCssLength(displayPadding) as string;

    return {
      "--retro-lcd-padding-top": resolved,
      "--retro-lcd-padding-right": resolved,
      "--retro-lcd-padding-bottom": resolved,
      "--retro-lcd-padding-left": resolved
    } as CSSProperties;
  }

  const vars = {} as CSSProperties;
  const block = displayPadding.block;
  const inline = displayPadding.inline;

  setVar(vars, "--retro-lcd-padding-top", displayPadding.top ?? block);
  setVar(vars, "--retro-lcd-padding-right", displayPadding.right ?? inline);
  setVar(vars, "--retro-lcd-padding-bottom", displayPadding.bottom ?? block);
  setVar(vars, "--retro-lcd-padding-left", displayPadding.left ?? inline);

  return vars;
};
