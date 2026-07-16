import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: { width: 1100, height: 900 }
});

test("explicit canvas backend removes cell DOM and bounds tall artwork tiles", async () => {
  await harness.gotoStory("retroscreen--canvas-backend-stress");
  await harness.page.waitForSelector('[data-retro-screen-canvas-ready="true"]');

  const metrics = await harness.page.evaluate(() => {
    const root = document.querySelector(".retro-screen");
    const canvases = Array.from(
      document.querySelectorAll("[data-retro-screen-bitmap-canvas='true']")
    );

    return {
      backend: root?.getAttribute("data-render-backend"),
      lineCount: root?.querySelectorAll(".retro-screen__line").length,
      cellCount: root?.querySelectorAll(".retro-screen__cell").length,
      accessibleTextCount: root?.querySelectorAll("[data-retro-screen-accessible-text='true']").length,
      canvasDimensions: canvases.map((canvas) => ({
        width: canvas.width,
        height: canvas.height,
        startRow: Number(canvas.getAttribute("data-retro-screen-canvas-start-row")),
        ready: canvas.getAttribute("data-retro-screen-canvas-ready")
      }))
    };
  });

  assert.equal(metrics.backend, "canvas");
  assert.equal(metrics.lineCount, 0);
  assert.equal(metrics.cellCount, 0);
  assert.equal(metrics.accessibleTextCount, 1);
  assert.deepEqual(metrics.canvasDimensions, [
    { width: 640, height: 4096, startRow: 0, ready: "true" },
    { width: 640, height: 4096, startRow: 256, ready: "true" },
    { width: 640, height: 4096, startRow: 512, ready: "true" },
    { width: 640, height: 3712, startRow: 768, ready: "true" }
  ]);
});
