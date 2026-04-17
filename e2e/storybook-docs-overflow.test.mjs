import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 794,
    height: 1134
  }
});

const page = () => harness.page;

const docsUrl = (baseUrl) => {
  const url = new URL("/iframe.html", baseUrl);
  url.searchParams.set("id", "retroscreen--docs");
  url.searchParams.set("viewMode", "docs");
  return url;
};

test("docs previews keep RetroScreen stories inside the narrow docs viewport", async () => {
  await page().goto(String(docsUrl(harness.baseUrl)), {
    waitUntil: "networkidle"
  });

  const cases = ["calm-readout", "fit-width-locked-frame", "prompt-loop"];

  for (const docsStoryId of cases) {
    const storyRoot = page().locator(`[data-docs-story="${docsStoryId}"]`);
    await storyRoot.scrollIntoViewIfNeeded();
    await storyRoot.locator(".retro-screen").waitFor({ timeout: 60_000 });

    const metrics = await storyRoot.evaluate((root) => {
      const screen = root.querySelector(".retro-screen");
      const stage = root.querySelector(".sb-retro-stage");
      const viewportWidth = window.innerWidth;
      const toRect = (element) =>
        element instanceof HTMLElement
          ? {
              left: Math.round(element.getBoundingClientRect().left * 100) / 100,
              right: Math.round(element.getBoundingClientRect().right * 100) / 100,
              width: Math.round(element.getBoundingClientRect().width * 100) / 100
            }
          : null;

      return {
        viewportWidth,
        stage: toRect(stage),
        screen: toRect(screen)
      };
    });

    assert.ok(
      (metrics.stage?.right ?? 0) <= metrics.viewportWidth,
      `${docsStoryId} stage should stay inside the docs viewport.`
    );
    assert.ok(
      (metrics.screen?.right ?? 0) <= metrics.viewportWidth,
      `${docsStoryId} screen should stay inside the docs viewport.`
    );
    assert.ok(
      (metrics.screen?.left ?? 0) >= 0,
      `${docsStoryId} screen should not clip off the left edge.`
    );
  }
});
