import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1660,
    height: 1400
  }
});

const page = () => harness.page;

const readAppleDos33Visibility = async () =>
  page().locator(".retro-screen").evaluate((root) => {
    const viewport = root.querySelector(".retro-screen__viewport");
    const cursor = root.querySelector(".retro-screen__cursor");
    const transcriptLines = Array.from(root.querySelectorAll(".retro-screen__line")).map((line) =>
      (line.textContent ?? "").replace(/\u00a0/gu, " ")
    );
    const viewportRect = viewport?.getBoundingClientRect();
    const cursorRect = cursor?.getBoundingClientRect();
    const cursorStyle =
      cursor instanceof HTMLElement
        ? {
            row: Number(cursor.style.getPropertyValue("--retro-screen-cursor-row") ?? -1),
            col: Number(cursor.style.getPropertyValue("--retro-screen-cursor-col") ?? -1)
          }
        : { row: -1, col: -1 };

    return {
      cols: Number(root.getAttribute("data-cols") ?? 0),
      rows: Number(root.getAttribute("data-rows") ?? 0),
      cursorRow: cursorStyle.row,
      cursorCol: cursorStyle.col,
      viewportTop: viewportRect?.top ?? null,
      viewportBottom: viewportRect?.bottom ?? null,
      cursorTop: cursorRect?.top ?? null,
      cursorBottom: cursorRect?.bottom ?? null,
      cursorVisible: Boolean(
        viewportRect &&
          cursorRect &&
          cursorRect.top >= viewportRect.top - 1 &&
          cursorRect.bottom <= viewportRect.bottom + 1
      ),
      tail: transcriptLines.slice(-8)
    };
  });

test("apple dos 3.3 autoplay keeps the active typing cursor inside the visible viewport", async () => {
  await harness.gotoStory("retroscreen-apple-ii-dos-3-3--apple-2-dos-33-story");

  await page().waitForSelector(".retro-screen__cursor", { timeout: 60_000 });
  await page().waitForFunction(async () => {
    if (!("fonts" in document) || !document.fonts?.ready) {
      return true;
    }

    await document.fonts.ready;
    return true;
  });

  const samples = [];

  for (let sampleIndex = 0; sampleIndex < 12; sampleIndex += 1) {
    const sample = await readAppleDos33Visibility();
    samples.push(sample);

    assert.ok(sample.cols >= 80, "The DOS 3.3 story should expose its 80-column grid.");
    assert.ok(sample.rows >= 12, "The DOS 3.3 story should expose its 12-row grid.");
    assert.ok(
      sample.cursorVisible,
      [
        `Sample ${sampleIndex + 1}: the active Apple DOS 3.3 cursor left the visible viewport.`,
        `Cursor row ${sample.cursorRow}, col ${sample.cursorCol}.`,
        `Cursor top/bottom: ${sample.cursorTop} / ${sample.cursorBottom}.`,
        `Viewport top/bottom: ${sample.viewportTop} / ${sample.viewportBottom}.`,
        `Transcript tail: ${sample.tail.join(" | ")}`
      ].join(" ")
    );

    await page().waitForTimeout(350);
  }

  assert.ok(
    samples.some((sample) => sample.cursorRow >= 10),
    "The autoplay should advance far enough to exercise lower rows in the Apple DOS 3.3 screen."
  );
});
