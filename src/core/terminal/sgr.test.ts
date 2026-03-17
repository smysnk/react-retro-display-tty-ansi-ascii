import { describe, expect, it } from "vitest";
import { applySgrParameters, DEFAULT_CELL_STYLE } from "./sgr";

describe("applySgrParameters", () => {
  it("supports ANSI 16 foreground and background colors", () => {
    const nextStyle = applySgrParameters(DEFAULT_CELL_STYLE, [31, 44, 91, 102]);

    expect(nextStyle).toMatchObject({
      foreground: {
        mode: "palette",
        value: 9
      },
      background: {
        mode: "palette",
        value: 10
      }
    });
  });

  it("supports 256-color and truecolor sequences", () => {
    const nextStyle = applySgrParameters(DEFAULT_CELL_STYLE, [
      38,
      5,
      196,
      48,
      2,
      68,
      85,
      102
    ]);

    expect(nextStyle).toMatchObject({
      foreground: {
        mode: "palette",
        value: 196
      },
      background: {
        mode: "rgb",
        value: (68 << 16) | (85 << 8) | 102
      }
    });
  });

  it("resets default foreground and background independently", () => {
    const colored = applySgrParameters(DEFAULT_CELL_STYLE, [38, 5, 123, 48, 5, 45]);
    const reset = applySgrParameters(colored, [39, 49]);

    expect(reset).toMatchObject({
      foreground: {
        mode: "default",
        value: 0
      },
      background: {
        mode: "default",
        value: 0
      }
    });
  });
});
