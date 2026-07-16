import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetroScreen } from "./RetroScreen";

const createCanvasContext = () => ({
  imageSmoothingEnabled: true,
  createImageData: (width: number, height: number) => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height
  }),
  putImageData: vi.fn()
}) as unknown as CanvasRenderingContext2D;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RetroScreen canvas backend", () => {
  it("renders canvas tiles and accessible text without line or cell DOM", async () => {
    const context = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const { container } = render(
      <RetroScreen
        mode="value"
        value="ABCD"
        gridMode="static"
        rows={2}
        cols={2}
        displayColorMode="ansi-vga"
        displayGlyphMode="ibm-vga-8x16"
        renderBackend="canvas"
      />
    );

    expect(container.querySelector(".retro-screen")?.getAttribute("data-render-backend")).toBe("canvas");
    expect(container.querySelectorAll(".retro-screen__line")).toHaveLength(0);
    expect(container.querySelectorAll(".retro-screen__cell")).toHaveLength(0);
    expect(container.querySelectorAll("[data-retro-screen-bitmap-canvas='true']")).toHaveLength(1);
    expect(container.querySelector("[data-retro-screen-accessible-text='true']")?.textContent).toBe("AB\nCD");
    await waitFor(() => expect(context.putImageData).toHaveBeenCalled());
  });

  it("falls back to DOM when a 2D context is unavailable", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { container } = render(
      <RetroScreen
        mode="value"
        value="AB"
        gridMode="static"
        rows={1}
        cols={2}
        displayGlyphMode="ibm-vga-8x16"
        renderBackend="canvas"
      />
    );

    await waitFor(() => {
      expect(container.querySelector(".retro-screen")?.getAttribute("data-render-backend")).toBe("dom");
    });
    expect(container.querySelectorAll(".retro-screen__line")).toHaveLength(1);
    expect(container.querySelectorAll(".retro-screen__cell")).toHaveLength(2);
  });

  it("keeps interactive modes on the DOM backend", () => {
    const { container } = render(
      <RetroScreen
        mode="value"
        editable
        value="AB"
        gridMode="static"
        rows={1}
        cols={2}
        displayGlyphMode="ibm-vga-8x16"
        renderBackend="canvas"
      />
    );

    expect(container.querySelector(".retro-screen")?.getAttribute("data-render-backend")).toBe("dom");
    expect(container.querySelectorAll(".retro-screen__cell")).toHaveLength(2);
  });
});
