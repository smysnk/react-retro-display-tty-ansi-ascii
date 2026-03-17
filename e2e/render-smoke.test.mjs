import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

test("core rendering stories paint stable retro surfaces in the browser", async () => {
  const stories = [
    { id: "retroscreen--calm-readout", mode: "value" },
    { id: "retroscreen--terminal-stream", mode: "terminal" },
    { id: "retroscreen--prompt-loop", mode: "prompt" }
  ];

  for (const story of stories) {
    await harness.gotoStory(story.id);

    const summary = await page().locator(".retro-lcd").evaluate((root) => ({
      mode: root.getAttribute("data-mode"),
      rows: Number(root.getAttribute("data-rows")),
      cols: Number(root.getAttribute("data-cols")),
      lineCount: root.querySelectorAll(".retro-lcd__line").length,
      hasCursor: Boolean(root.querySelector(".retro-lcd__cursor")),
      text: (root.querySelector(".retro-lcd__body")?.textContent ?? "").replace(/\u00a0/gu, " ").trim()
    }));

    assert.equal(summary.mode, story.mode, `${story.id} should report the expected mode.`);
    assert.ok(summary.rows > 0, `${story.id} should expose measured row geometry.`);
    assert.ok(summary.cols > 0, `${story.id} should expose measured column geometry.`);
    assert.ok(summary.lineCount > 0, `${story.id} should render at least one visible line.`);
    assert.ok(summary.text.length > 0, `${story.id} should render non-empty terminal text.`);
    if (story.mode !== "value") {
      assert.ok(summary.hasCursor, `${story.id} should render a cursor for interactive modes.`);
    }
  }
});

test("display color modes story covers every supported display palette and ANSI projection path", async () => {
  await harness.gotoStory("retroscreen--display-color-modes");

  const modes = await page().locator("[data-display-mode-card]").evaluateAll((cards) =>
    cards.map((card) => {
      const mode = card.getAttribute("data-display-mode-card") ?? "";
      const root = card.querySelector(".retro-lcd");
      const firstCell = root?.querySelector(".retro-lcd__cell");
      const lines = Array.from(root?.querySelectorAll(".retro-lcd__line") ?? []).map((line) =>
        (line.textContent ?? "").replace(/\u00a0/gu, " ").trim()
      );

      return {
        mode,
        dataMode: root?.getAttribute("data-display-color-mode") ?? "",
        accent: root instanceof HTMLElement ? root.style.getPropertyValue("--retro-lcd-color") : "",
        firstCellColor:
          firstCell instanceof HTMLElement ? getComputedStyle(firstCell).color : "missing",
        firstCellBackground:
          firstCell instanceof HTMLElement ? getComputedStyle(firstCell).backgroundColor : "missing",
        lineCount: lines.filter(Boolean).length
      };
    })
  );

  assert.deepEqual(
    modes.map((entry) => entry.mode),
    ["phosphor-green", "phosphor-amber", "phosphor-ice", "ansi-classic", "ansi-extended"]
  );
  assert.ok(modes.every((entry) => entry.mode === entry.dataMode), "Every card should render the expected display mode.");
  assert.deepEqual(
    modes.map((entry) => entry.accent),
    ["#97ff9b", "#ffc96b", "#b8f1ff", "#d7dde8", "#d7dde8"]
  );
  assert.ok(modes.every((entry) => entry.lineCount > 0), "Every display mode card should render visible text.");

  const ansiClassic = modes.find((entry) => entry.mode === "ansi-classic");
  assert.equal(ansiClassic?.firstCellColor, "rgb(209, 109, 104)");
  assert.equal(ansiClassic?.firstCellBackground, "rgb(120, 165, 245)");

  const ansiExtendedMetrics = await page()
    .locator('[data-display-mode-card="ansi-extended"] .retro-lcd')
    .evaluate((root) => {
      const rows = Array.from(root.querySelectorAll(".retro-lcd__line"));
      const firstLineCells = rows[0]?.querySelectorAll(".retro-lcd__cell") ?? [];
      const secondLineCells = rows[1]?.querySelectorAll(".retro-lcd__cell") ?? [];
      const indexedCell = firstLineCells[0];
      const truecolorCell = secondLineCells[0];

      return {
        indexedColor:
          indexedCell instanceof HTMLElement ? getComputedStyle(indexedCell).color : "missing",
        indexedBackground:
          indexedCell instanceof HTMLElement ? getComputedStyle(indexedCell).backgroundColor : "missing",
        truecolorColor:
          truecolorCell instanceof HTMLElement ? getComputedStyle(truecolorCell).color : "missing",
        truecolorBackground:
          truecolorCell instanceof HTMLElement ? getComputedStyle(truecolorCell).backgroundColor : "missing"
      };
    });

  assert.deepEqual(ansiExtendedMetrics, {
    indexedColor: "rgb(255, 0, 0)",
    indexedBackground: "rgb(0, 95, 175)",
    truecolorColor: "rgb(17, 34, 51)",
    truecolorBackground: "rgb(68, 85, 102)"
  });
});
