import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

test("render smoke stories stay stable in the browser", async (t) => {
  await t.test("core rendering stories paint stable retro surfaces in the browser", async () => {
    const stories = [
      { id: "retroscreen--calm-readout", mode: "value" },
      { id: "retroscreen-editor--editor-selection-lab", mode: "editor" },
      { id: "retroscreen--terminal-stream", mode: "terminal" },
      { id: "retroscreen--prompt-loop", mode: "prompt" }
    ];

    for (const story of stories) {
      await harness.gotoStory(story.id);
      await page().waitForSelector(".retro-screen");

      const summary = await page().locator(".retro-screen").evaluate((root) => ({
        mode: root.getAttribute("data-mode"),
        rows: Number(root.getAttribute("data-rows")),
        cols: Number(root.getAttribute("data-cols")),
        lineCount: root.querySelectorAll(".retro-screen__line").length,
        hasCursor: Boolean(root.querySelector(".retro-screen__cursor")),
        text: (root.querySelector(".retro-screen__body")?.textContent ?? "")
          .replace(/\u00a0/gu, " ")
          .trim()
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

  await t.test("matrix code rain story loads the Matrix font and animates visible columns", async () => {
    await harness.gotoStory("retroscreen--matrix-code-rain");
    await page().waitForSelector(".retro-screen");
    await page().waitForTimeout(240);

    const initial = await page().locator(".retro-screen").evaluate((root) => {
      const body = root.querySelector(".retro-screen__body");
      const grid = root.querySelector(".retro-screen__grid");

      return {
        text: (body?.textContent ?? "").replace(/\u00a0/gu, " "),
        rows: Number(root.getAttribute("data-rows") ?? "0"),
        cols: Number(root.getAttribute("data-cols") ?? "0"),
        fontFamily:
          grid instanceof HTMLElement ? getComputedStyle(grid).fontFamily : "",
        lineCount: root.querySelectorAll(".retro-screen__line").length
      };
    });

    await page().waitForTimeout(420);

    const nextText = await page()
      .locator(".retro-screen .retro-screen__body")
      .evaluate((body) => (body.textContent ?? "").replace(/\u00a0/gu, " "));

    assert.equal(initial.rows, 24);
    assert.equal(initial.cols, 58);
    assert.equal(initial.lineCount, 24);
    assert.match(initial.fontFamily, /Matrix/u);
    assert.ok(initial.text.replace(/\s/gu, "").length > 300);
    assert.notEqual(
      nextText,
      initial.text,
      "The matrix rain story should continue animating after mount."
    );
  });

  await t.test(
    "display color modes story covers every supported display palette and ANSI projection path",
    async () => {
      await harness.gotoStory("retroscreen--display-color-modes");

      const modes = await page().locator("[data-display-mode-card]").evaluateAll((cards) =>
        cards.map((card) => {
          const mode = card.getAttribute("data-display-mode-card") ?? "";
          const root = card.querySelector(".retro-screen");
          const firstCell = root?.querySelector(".retro-screen__cell");
          const lines = Array.from(root?.querySelectorAll(".retro-screen__line") ?? []).map((line) =>
            (line.textContent ?? "").replace(/\u00a0/gu, " ").trim()
          );

          return {
            mode,
            dataMode: root?.getAttribute("data-display-color-mode") ?? "",
            accent:
              root instanceof HTMLElement ? root.style.getPropertyValue("--retro-screen-color") : "",
            firstCellColor:
              firstCell instanceof HTMLElement ? getComputedStyle(firstCell).color : "missing",
            firstCellBackground:
              firstCell instanceof HTMLElement
                ? getComputedStyle(firstCell).backgroundColor
                : "missing",
            lineCount: lines.filter(Boolean).length
          };
        })
      );

      assert.deepEqual(
        modes.map((entry) => entry.mode),
        ["phosphor-green", "phosphor-amber", "phosphor-ice", "ansi-classic", "ansi-extended"]
      );
      assert.ok(
        modes.every((entry) => entry.mode === entry.dataMode),
        "Every card should render the expected display mode."
      );
      assert.deepEqual(
        modes.map((entry) => entry.accent),
        ["#97ff9b", "#ffc96b", "#b8f1ff", "#d7dde8", "#d7dde8"]
      );
      assert.ok(
        modes.every((entry) => entry.lineCount > 0),
        "Every display mode card should render visible text."
      );

      const ansiClassic = modes.find((entry) => entry.mode === "ansi-classic");
      assert.equal(ansiClassic?.firstCellColor, "rgb(209, 109, 104)");
      assert.equal(ansiClassic?.firstCellBackground, "rgb(120, 165, 245)");

      const ansiExtendedMetrics = await page()
        .locator('[data-display-mode-card="ansi-extended"] .retro-screen')
        .evaluate((root) => {
          const rows = Array.from(root.querySelectorAll(".retro-screen__line"));
          const firstLineCells = rows[0]?.querySelectorAll(".retro-screen__cell") ?? [];
          const secondLineCells = rows[1]?.querySelectorAll(".retro-screen__cell") ?? [];
          const indexedCell = firstLineCells[0];
          const truecolorCell = secondLineCells[0];

          return {
            indexedColor:
              indexedCell instanceof HTMLElement ? getComputedStyle(indexedCell).color : "missing",
            indexedBackground:
              indexedCell instanceof HTMLElement
                ? getComputedStyle(indexedCell).backgroundColor
                : "missing",
            truecolorColor:
              truecolorCell instanceof HTMLElement
                ? getComputedStyle(truecolorCell).color
                : "missing",
            truecolorBackground:
              truecolorCell instanceof HTMLElement
                ? getComputedStyle(truecolorCell).backgroundColor
                : "missing"
          };
        });

      assert.deepEqual(ansiExtendedMetrics, {
        indexedColor: "rgb(255, 0, 0)",
        indexedBackground: "rgb(0, 95, 175)",
        truecolorColor: "rgb(17, 34, 51)",
        truecolorBackground: "rgb(68, 85, 102)"
      });
    }
  );

  await t.test("bad apple ansi story loads the Mistigris asset at native 80x25 geometry", async () => {
    await harness.gotoStory("retroscreen-display-buffer--bad-apple-ansi");

    await page().waitForFunction(
      () => {
        const root = document.querySelector(".retro-screen");
        const text = (root?.querySelector(".retro-screen__body")?.textContent ?? "").replace(
          /\u00a0/gu,
          " "
        );
        return (
          Number(root?.getAttribute("data-rows") ?? "0") === 25 &&
          Number(root?.getAttribute("data-cols") ?? "0") === 80 &&
          text.replace(/\s/gu, "").length > 0
        );
      },
      undefined,
      { timeout: 30000 }
    );

    const summary = await page().evaluate(() => {
      const root = document.querySelector(".retro-screen");
      const shell = document.querySelector(".sb-retro-shell");
      const creditLink = shell?.querySelector('a[href="https://mistigris.org/"]');
      const text = (root?.querySelector(".retro-screen__body")?.textContent ?? "").replace(
        /\u00a0/gu,
        " "
      );

      return {
        rows: Number(root?.getAttribute("data-rows") ?? "0"),
        cols: Number(root?.getAttribute("data-cols") ?? "0"),
        hasVisibleArt: text.replace(/\s/gu, "").length > 0,
        creditText: creditLink?.textContent ?? "",
        frameLabel: shell?.textContent ?? ""
      };
    });

    assert.equal(summary.rows, 25);
    assert.equal(summary.cols, 80);
    assert.ok(summary.hasVisibleArt, "The Bad Apple story should paint visible ANSI art.");
    assert.equal(summary.creditText, "Mistigris");
    assert.match(summary.frameLabel, /Frame\s+\d+\s+\/\s+3061/u);
  });

  await t.test("capture demos keep interactive surfaces expanded to the full frame", async () => {
    const stories = [
      {
        id: "retroscreen-capture--editable-mode-demo"
      },
      {
        id: "retroscreen-capture--prompt-mode-demo"
      }
    ];

    for (const story of stories) {
      await harness.gotoStory(story.id);
      await page().waitForTimeout(1400);

      const summary = await page().locator("[data-demo-capture]").evaluate((root) => {
        const frameRect = root.getBoundingClientRect();
        const lcd = root.querySelector(".retro-screen");
        const lcdRect = lcd?.getBoundingClientRect();
        const text = (lcd?.querySelector(".retro-screen__body")?.textContent ?? "").replace(
          /\u00a0/gu,
          " "
        );

        return {
          frameWidth: frameRect.width,
          lcdWidth: lcdRect?.width ?? 0,
          text
        };
      });

      assert.ok(summary.frameWidth > 700, `${story.id} should expose the full capture width.`);
      assert.ok(
        summary.lcdWidth > 700,
        `${story.id} should keep the RetroScreen expanded inside the capture frame.`
      );
      assert.ok(
        summary.text.trim().length > 0,
        `${story.id} should render visible interactive content.`
      );
    }
  });

  await t.test("resize-focused demos show a live cursor overlay and real panel motion", async () => {
    const stories = [
      {
        id: "retroscreen-responsive--auto-resize-probe-capture"
      },
      {
        id: "retroscreen-responsive--resizable-panel-capture"
      }
    ];

    for (const story of stories) {
      await harness.gotoStory(story.id);
      await page().waitForSelector('[data-demo-cursor="true"]');
      await page().waitForFunction(() => {
        const cursor = document.querySelector('[data-demo-cursor="true"]');
        return cursor instanceof HTMLElement && Number(getComputedStyle(cursor).opacity) > 0.9;
      });
      await page().waitForFunction(() => {
        const cursor = document.querySelector('[data-demo-cursor="true"]');
        return cursor?.getAttribute("data-demo-cursor-role") !== "pointer";
      });

      const initial = await page().locator("[data-demo-capture]").evaluate((root) => {
        const cursor = root.querySelector('[data-demo-cursor="true"]');
        const host = root.querySelector(".sb-retro-auto-resize-host, .sb-retro-resize-demo-host");
        const panel = root.querySelector(".retro-screen");
        const hostRect = host?.getBoundingClientRect();
        const panelRect = panel?.getBoundingClientRect();

        return {
          cursorVisible:
            cursor instanceof HTMLElement ? Number(getComputedStyle(cursor).opacity) > 0.9 : false,
          cursorRole: cursor?.getAttribute("data-demo-cursor-role") ?? "",
          hostWidth: hostRect?.width ?? 0,
          hostHeight: hostRect?.height ?? 0,
          panelWidth: panelRect?.width ?? 0,
          panelHeight: panelRect?.height ?? 0
        };
      });

      let minHostWidth = initial.hostWidth;
      let maxHostWidth = initial.hostWidth;
      let minHostHeight = initial.hostHeight;
      let maxHostHeight = initial.hostHeight;

      await page().waitForFunction(
        () => {
          const root = document.querySelector("[data-demo-capture]");
          const cursor = root?.querySelector('[data-demo-cursor="true"]');
          return cursor?.getAttribute("data-demo-cursor-dragging") === "true";
        },
        { timeout: 12000 }
      );

      for (let index = 0; index < 16; index += 1) {
        const sample = await page().locator("[data-demo-capture]").evaluate((root) => {
          const host = root.querySelector(".sb-retro-auto-resize-host, .sb-retro-resize-demo-host");
          const hostRect = host?.getBoundingClientRect();
          return {
            hostWidth: hostRect?.width ?? 0,
            hostHeight: hostRect?.height ?? 0
          };
        });

        minHostWidth = Math.min(minHostWidth, sample.hostWidth);
        maxHostWidth = Math.max(maxHostWidth, sample.hostWidth);
        minHostHeight = Math.min(minHostHeight, sample.hostHeight);
        maxHostHeight = Math.max(maxHostHeight, sample.hostHeight);
        await page().waitForTimeout(120);
      }

      assert.ok(initial.cursorVisible, `${story.id} should show the scripted cursor overlay.`);
      assert.ok(
        maxHostWidth - minHostWidth > 20 || maxHostHeight - minHostHeight > 20,
        `${story.id} should visibly resize the panel during the demo.`
      );
    }
  });
});
