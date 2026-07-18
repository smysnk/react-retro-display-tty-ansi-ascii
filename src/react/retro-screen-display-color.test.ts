import { describe, expect, it } from "vitest";
import { rgbaToCss } from "../core/rendering/bitmap-colors";
import type { RetroScreenCell } from "../core/terminal/types";
import type { RetroScreenDisplayColorMode } from "../core/types";
import {
  getCellPresentationColors,
  getCellPresentationStyle
} from "./retro-screen-display-color";

const cell: RetroScreenCell = {
  char: "A",
  style: {
    intensity: "bold",
    bold: true,
    faint: false,
    inverse: true,
    conceal: false,
    blink: true,
    foreground: { mode: "palette", value: 1 },
    background: { mode: "palette", value: 4 }
  }
};

describe("shared DOM and bitmap color resolution", () => {
  it("applies DOS bold after inverse swaps the displayed VGA channels", () => {
    const colors = getCellPresentationColors({
      ...cell,
      style: {
        ...cell.style,
        blink: false,
        foreground: { mode: "palette", value: 0 },
        background: { mode: "default", value: 0 }
      }
    }, "ansi-vga", "dark", false);

    expect(rgbaToCss(colors!.foreground)).toBe("#555555");
    expect(rgbaToCss(colors!.background)).toBe("#000000");
  });

  it.each<RetroScreenDisplayColorMode>(["ansi-vga", "ansi-classic", "ansi-extended"])(
    "uses the same resolved colors for %s",
    (displayColorMode) => {
      const colors = getCellPresentationColors(cell, displayColorMode, "dark", true);
      const style = getCellPresentationStyle(cell, displayColorMode, "dark", true);

      expect(colors).toBeDefined();
      expect(style?.color).toBe(rgbaToCss(colors!.foreground));
      expect(style?.backgroundColor).toBe(rgbaToCss(colors!.background));
    }
  );
});
