import type { CSSProperties } from "react";
import type {
  RetroScreenDisplayPadding,
  RetroScreenDisplayPaddingValue
} from "../core/types";

const toCssLength = (value?: RetroScreenDisplayPaddingValue) => {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "number" ? `${value}px` : value;
};

const setVar = (
  vars: CSSProperties,
  name: string,
  value?: RetroScreenDisplayPaddingValue
) => {
  const resolved = toCssLength(value);

  if (resolved !== undefined) {
    vars[name] = resolved;
  }
};

export const getDisplayPaddingVars = (
  displayPadding?: RetroScreenDisplayPadding
): CSSProperties => {
  if (displayPadding === undefined) {
    return {};
  }

  if (typeof displayPadding === "number" || typeof displayPadding === "string") {
    const resolved = toCssLength(displayPadding) as string;

    return {
      "--retro-screen-padding-top": resolved,
      "--retro-screen-padding-right": resolved,
      "--retro-screen-padding-bottom": resolved,
      "--retro-screen-padding-left": resolved
    } as CSSProperties;
  }

  const vars = {} as CSSProperties;
  const block = displayPadding.block;
  const inline = displayPadding.inline;

  setVar(vars, "--retro-screen-padding-top", displayPadding.top ?? block);
  setVar(vars, "--retro-screen-padding-right", displayPadding.right ?? inline);
  setVar(vars, "--retro-screen-padding-bottom", displayPadding.bottom ?? block);
  setVar(vars, "--retro-screen-padding-left", displayPadding.left ?? inline);

  return vars;
};
