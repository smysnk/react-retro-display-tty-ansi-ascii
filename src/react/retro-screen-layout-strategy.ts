import type {
  RetroScreenDisplayFontSizingMode,
  RetroScreenDisplayLayoutMode,
  RetroScreenGridMode
} from "../core/types";

export type RetroScreenResolvedLayoutStrategy =
  | {
      kind: "auto";
      gridMode: "auto";
      fitWidthLayoutActive: false;
      staticFitStrategy: "contain";
    }
  | {
      kind: "static-contain";
      gridMode: "static";
      fitWidthLayoutActive: false;
      staticFitStrategy: "contain";
    }
  | {
      kind: "static-fit-width";
      gridMode: "static";
      fitWidthLayoutActive: boolean;
      staticFitStrategy: "width";
    };

export const resolveRetroScreenLayoutStrategy = ({
  gridMode,
  displayLayoutMode,
  displayFontSizingMode
}: {
  gridMode?: RetroScreenGridMode;
  displayLayoutMode?: RetroScreenDisplayLayoutMode;
  displayFontSizingMode?: RetroScreenDisplayFontSizingMode;
}): RetroScreenResolvedLayoutStrategy => {
  if (gridMode !== "static") {
    return {
      kind: "auto",
      gridMode: "auto",
      fitWidthLayoutActive: false,
      staticFitStrategy: "contain"
    };
  }

  if (displayLayoutMode === "fit-width" || displayFontSizingMode === "fit-cols") {
    return {
      kind: "static-fit-width",
      gridMode: "static",
      fitWidthLayoutActive: true,
      staticFitStrategy: "width"
    };
  }

  return {
    kind: "static-contain",
    gridMode: "static",
    fitWidthLayoutActive: false,
    staticFitStrategy: "contain"
  };
};
