import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: { width: 1440, height: 1100 }
});

const exampleStoryIds = [
  "readme-examples--getting-started",
  "readme-examples--touch-input",
  "readme-examples--resizable",
  "readme-examples--quiet",
  "readme-examples--signal-intercept",
  "readme-examples--matrix-rain",
  "readme-examples--editable",
  "readme-examples--terminal",
  "readme-examples--prompt",
  "readme-examples--display-colors",
  "readme-examples--control-characters",
  "readme-examples--auto-resize",
  "readme-examples--light-dark",
  "readme-examples--midjourney",
  "readme-examples--ansi-art"
];

test("canonical README examples render through their public package imports", async () => {
  for (const storyId of exampleStoryIds) {
    await harness.gotoStory(storyId);
    await harness.page.waitForSelector(".retro-screen", { timeout: 30000 });

    const summary = await harness.page.locator(".retro-screen").first().evaluate((root) => ({
      mode: root.getAttribute("data-mode"),
      rows: Number(root.getAttribute("data-rows") ?? "0"),
      cols: Number(root.getAttribute("data-cols") ?? "0")
    }));

    assert.ok(summary.mode, `${storyId} should expose a rendered mode.`);
    assert.ok(summary.rows > 0, `${storyId} should expose measured rows.`);
    assert.ok(summary.cols > 0, `${storyId} should expose measured columns.`);
  }

  await harness.gotoStory("readme-examples--ansi-art");
  await harness.page.waitForSelector('[data-retro-screen-canvas-ready="true"]', {
    timeout: 30000
  });
});
