import { describe, expect, it } from "vitest";
import { resolveRetroScreenFitWidthLayout } from "./retro-screen-fit-layout";

describe("resolveRetroScreenFitWidthLayout", () => {
  it("fills the available width and derives height from stable chrome and content aspect metrics", () => {
    expect(
      resolveRetroScreenFitWidthLayout({
        availableOuterWidth: 1226,
        chromeWidth: 26,
        chromeHeight: 26,
        contentAspectRatio: 1200 / 775
      })
    ).toEqual({
      width: 1226,
      height: 801,
      chromeWidth: 26,
      chromeHeight: 26,
      aspectRatio: 1200 / 775
    });
  });

  it("keeps the available width and clamps only the height when a max outer height is exceeded", () => {
    expect(
      resolveRetroScreenFitWidthLayout({
        availableOuterWidth: 1400,
        chromeWidth: 26,
        chromeHeight: 26,
        contentAspectRatio: 1200 / 775,
        maxOuterHeight: 700
      })
    ).toEqual({
      width: 1400,
      height: 700,
      chromeWidth: 26,
      chromeHeight: 26,
      aspectRatio: 1200 / 775
    });
  });

  it("can use an explicit content aspect ratio without current inner box measurements", () => {
    expect(
      resolveRetroScreenFitWidthLayout({
        availableOuterWidth: 1500,
        chromeWidth: 90,
        chromeHeight: 56,
        contentAspectRatio: 1.6
      })
    ).toEqual({
      width: 1500,
      height: 937,
      chromeWidth: 90,
      chromeHeight: 56,
      aspectRatio: 1.6
    });
  });
});
