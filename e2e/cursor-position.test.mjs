import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const wrapTextToColumns = (text, cols, tabWidth = 4) => {
  const lines = [""];
  let col = 0;

  const pushLine = () => {
    lines.push("");
    col = 0;
  };

  const appendChar = (character) => {
    if (col >= cols) {
      pushLine();
    }

    lines[lines.length - 1] += character;
    col += 1;
  };

  for (const character of text) {
    if (character === "\n") {
      pushLine();
      continue;
    }

    if (character === "\r") {
      lines[lines.length - 1] = "";
      col = 0;
      continue;
    }

    if (character === "\t") {
      const spaces = tabWidth - (col % tabWidth || 0);

      for (let index = 0; index < spaces; index += 1) {
        appendChar(" ");
      }

      continue;
    }

    appendChar(character);
  }

  return lines;
};

const getExpectedCursor = ({ value, selectionStart, cols }) => {
  const cursorLines = wrapTextToColumns(value.slice(0, selectionStart), cols);
  let row = cursorLines.length - 1;
  let col = cursorLines[row]?.length ?? 0;

  if (col >= cols) {
    row += 1;
    col = 0;
  }

  return { row, col };
};

const getPreviousCursorCharacter = ({ value, selectionStart, cols }) => {
  if (selectionStart <= 0) {
    return null;
  }

  const lines = wrapTextToColumns(value.slice(0, selectionStart), cols);
  const previous = value[selectionStart - 1];

  if (previous === "\n" || previous === "\r" || previous === "\t") {
    return null;
  }

  return {
    previous,
    lines
  };
};

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

const readCursorState = async () =>
  page().locator(".retro-lcd").evaluate((root) => {
    const input = root.querySelector(".retro-lcd__input");
    const cursor = root.querySelector(".retro-lcd__cursor");

    return {
      cols: Number(root.getAttribute("data-cols")),
      rows: Number(root.getAttribute("data-rows")),
      value: input?.value ?? "",
      selectionStart: input?.selectionStart ?? 0,
      cursorRow: Number(cursor?.style.getPropertyValue("--retro-lcd-cursor-row") ?? -1),
      cursorCol: Number(cursor?.style.getPropertyValue("--retro-lcd-cursor-col") ?? -1),
      lineTexts: Array.from(root.querySelectorAll(".retro-lcd__line")).map((line) =>
        (line.textContent ?? "").replace(/\u00a0/gu, " ")
      )
    };
  });

const assertCursorTracksTypedText = async () => {
  const state = await readCursorState();
  const expected = getExpectedCursor(state);

  assert.ok(state.cols > 0, "The story should report a measured column count.");
  assert.ok(state.rows > 0, "The story should report a measured row count.");
  assert.equal(state.cursorRow, expected.row, "Cursor row should follow typed text.");
  assert.equal(state.cursorCol, expected.col, "Cursor column should follow typed text.");

  const previousCursorCharacter = getPreviousCursorCharacter(state);

  if (!previousCursorCharacter) {
    return;
  }

  const wrappedPrefix = previousCursorCharacter.lines;
  const rowIndex = expected.col === 0 ? expected.row - 1 : expected.row;
  const colIndex = expected.col === 0 ? state.cols - 1 : expected.col - 1;
  const line = wrappedPrefix[rowIndex] ?? "";
  assert.equal(
    line[colIndex],
    previousCursorCharacter.previous,
    "The cursor should render immediately after the most recently typed character."
  );
};

const readDescenderMetrics = async () =>
  page().locator(".retro-lcd").evaluate((root) => {
    const grid = root.querySelector(".retro-lcd__grid");
    const descenderLine = Array.from(root.querySelectorAll(".retro-lcd__line")).find((line) =>
      /[gjpqy]/iu.test(line.textContent ?? "")
    );

    if (!(grid instanceof HTMLElement) || !(descenderLine instanceof HTMLElement)) {
      return null;
    }

    const gridStyle = getComputedStyle(grid);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.font = gridStyle.font;
    const text = (descenderLine.textContent ?? "").replace(/\u00a0/gu, " ");
    const sample = text.match(/[gjpqy]/giu)?.join("") ?? "gjpqy";
    const metrics = context.measureText(sample);

    return {
      text,
      sample,
      font: gridStyle.font,
      fontSize: Number.parseFloat(gridStyle.fontSize),
      renderedLineHeight: descenderLine.getBoundingClientRect().height,
      inkHeight: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      descent: metrics.actualBoundingBoxDescent
    };
  });

test("editable story keeps the visible cursor after the latest typed character", async () => {
  await harness.gotoStory("retroscreen-editor--editable-notebook");
  await page().locator(".retro-lcd__input").click();

  const initialCols = Number(await page().locator(".retro-lcd").getAttribute("data-cols"));
  const initialSequence = "calm";
  const wrapSequence = "x".repeat(Math.max(1, initialCols + 3 - initialSequence.length));

  for (const character of initialSequence) {
    await page().keyboard.type(character);
    await assertCursorTracksTypedText();
  }

  for (const character of wrapSequence) {
    await page().keyboard.type(character);
    await assertCursorTracksTypedText();
  }

  await page().keyboard.press("Shift+Enter");
  await assertCursorTracksTypedText();

  for (const character of "end") {
    await page().keyboard.type(character);
    await assertCursorTracksTypedText();
  }
});

test("quiet output story leaves enough room for descender glyphs", async () => {
  await harness.gotoStory("retroscreen--calm-readout");

  await page().waitForFunction(() => {
    const lines = Array.from(document.querySelectorAll(".retro-lcd__line")).map((line) =>
      (line.textContent ?? "").replace(/\u00a0/gu, " ")
    );
    return lines.some((line) => /[gjpqy]/iu.test(line));
  });

  const metrics = await readDescenderMetrics();

  assert.ok(metrics, "The quiet output story should expose a descender-bearing text line.");
  assert.ok(metrics.descent > 0, "The sampled glyph metrics should include a descender.");
  assert.ok(
    metrics.renderedLineHeight >= metrics.inkHeight - 0.5,
    `Rendered line height ${metrics.renderedLineHeight}px should fit descender text "${metrics.text}" (ink ${metrics.inkHeight}px, sample ${metrics.sample}, font ${metrics.font}).`
  );
});
