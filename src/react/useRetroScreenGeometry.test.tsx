import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RetroScreen } from "./RetroScreen";

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  callback: ResizeObserverCallback;
  observedTargets = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe = (target: Element) => {
    this.observedTargets.add(target);
  };

  unobserve = (target: Element) => {
    this.observedTargets.delete(target);
  };

  disconnect = () => {
    this.observedTargets.clear();
  };

  trigger(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: target.getBoundingClientRect(),
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    );
  }
}

describe("useRetroScreenGeometry", () => {
  it("remeasures static geometry when the probe font metrics change", () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    let probeWidth = 14.4;

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });

    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    try {
      const { container } = render(
        <RetroScreen
          mode="value"
          value={"█".repeat(10)}
          gridMode="static"
          rows={1}
          cols={10}
          style={{ width: 200, height: 80 }}
        />
      );

      const root = container.querySelector(".retro-screen") as HTMLDivElement | null;
      const grid = container.querySelector(".retro-screen__grid") as HTMLDivElement | null;
      const probe = container.querySelector(".retro-screen__probe") as HTMLSpanElement | null;

      expect(root).not.toBeNull();
      expect(grid).not.toBeNull();
      expect(probe).not.toBeNull();

      vi.spyOn(grid!, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            width: 200,
            height: 80,
            right: 200,
            bottom: 80,
            toJSON: () => ({}),
          }) as DOMRect
      );

      vi.spyOn(probe!, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            width: probeWidth,
            height: 20,
            right: probeWidth,
            bottom: 20,
            toJSON: () => ({}),
          }) as DOMRect
      );

      act(() => {
        const observer = ResizeObserverMock.instances[0];
        observer?.trigger(grid!);
      });

      expect(root!.style.getPropertyValue("--retro-screen-font-size")).toBe("33.333333333333336px");

      probeWidth = 12;

      act(() => {
        const observer = ResizeObserverMock.instances[0];
        observer?.trigger(probe!);
      });

      expect(root!.style.getPropertyValue("--retro-screen-font-size")).toBe("40px");
    } finally {
      ResizeObserverMock.instances = [];

      if (originalResizeObserver) {
        Object.defineProperty(globalThis, "ResizeObserver", {
          configurable: true,
          writable: true,
          value: originalResizeObserver,
        });
      } else {
        // @ts-expect-error test cleanup for missing browser API
        delete globalThis.ResizeObserver;
      }

      if (originalFonts) {
        Object.defineProperty(document, "fonts", originalFonts);
      } else {
        // @ts-expect-error test cleanup for missing browser API
        delete document.fonts;
      }
    }
  });
});
