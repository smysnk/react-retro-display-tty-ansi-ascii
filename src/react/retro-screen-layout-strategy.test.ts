import { describe, expect, it } from "vitest";
import { resolveRetroScreenLayoutStrategy } from "./retro-screen-layout-strategy";

describe("resolveRetroScreenLayoutStrategy", () => {
  it("resolves auto mode by default", () => {
    expect(resolveRetroScreenLayoutStrategy({})).toEqual({
      kind: "auto",
      gridMode: "auto",
      fitWidthLayoutActive: false,
      staticFitStrategy: "contain"
    });
  });

  it("resolves static contain mode when the grid is fixed without width-driven sizing", () => {
    expect(
      resolveRetroScreenLayoutStrategy({
        gridMode: "static"
      })
    ).toEqual({
      kind: "static-contain",
      gridMode: "static",
      fitWidthLayoutActive: false,
      staticFitStrategy: "contain"
    });
  });

  it("resolves width-driven static mode for fit-width layout", () => {
    expect(
      resolveRetroScreenLayoutStrategy({
        gridMode: "static",
        displayLayoutMode: "fit-width"
      })
    ).toEqual({
      kind: "static-fit-width",
      gridMode: "static",
      fitWidthLayoutActive: true,
      staticFitStrategy: "width"
    });
  });

  it("treats fit-cols sizing as the width-driven fit-width strategy", () => {
    expect(
      resolveRetroScreenLayoutStrategy({
        gridMode: "static",
        displayFontSizingMode: "fit-cols"
      })
    ).toEqual({
      kind: "static-fit-width",
      gridMode: "static",
      fitWidthLayoutActive: true,
      staticFitStrategy: "width"
    });
  });
});
