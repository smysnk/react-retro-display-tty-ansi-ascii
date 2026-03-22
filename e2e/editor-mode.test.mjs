import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

const readEditorState = async () =>
  page().locator(".retro-screen").evaluate((root) => {
    const input = root.querySelector(".retro-screen__input");

    return {
      mode: root.getAttribute("data-mode"),
      rows: Number(root.getAttribute("data-rows") ?? "0"),
      cols: Number(root.getAttribute("data-cols") ?? "0"),
      value: input?.value ?? "",
      selectionStart: input?.selectionStart ?? 0,
      selectionEnd: input?.selectionEnd ?? 0,
      selectedOffsets: Array.from(root.querySelectorAll(".retro-screen__cell--selected")).map((cell) =>
        Number((cell instanceof HTMLElement ? cell.dataset.sourceOffset : "") ?? "-1")
      ),
      lines: Array.from(root.querySelectorAll(".retro-screen__line")).map((line) =>
        (line.textContent ?? "").replace(/\u00a0/gu, " ")
      ),
      activeElementClassName:
        document.activeElement instanceof HTMLElement ? document.activeElement.className : ""
    };
  });

const getGridPoint = async ({
  row,
  col,
  ratioX = 0.5,
  ratioY = 0.5
}) => {
  const root = page().locator(".retro-screen");
  const grid = page().locator(".retro-screen__grid");
  const [attrs, box] = await Promise.all([
    root.evaluate((node) => ({
      rows: Number(node.getAttribute("data-rows") ?? "0"),
      cols: Number(node.getAttribute("data-cols") ?? "0")
    })),
    grid.boundingBox()
  ]);

  assert.ok(box, "The retro grid should expose a bounding box.");
  const cellWidth = box.width / Math.max(1, attrs.cols);
  const cellHeight = box.height / Math.max(1, attrs.rows);

  return {
    x: box.x + (col - 1 + ratioX) * cellWidth,
    y: box.y + (row - 1 + ratioY) * cellHeight
  };
};

const dragSelection = async (startCell, endCell) => {
  const start = await getGridPoint(startCell);
  const end = await getGridPoint(endCell);

  await page().mouse.move(start.x, start.y);
  await page().mouse.down();
  await page().mouse.move(end.x, end.y, {
    steps: 8
  });
  await page().mouse.up();
};

test("editor story selects text with the mouse and deletes it with Backspace", async () => {
  await harness.gotoStory("retroscreen-editor--editor-selection-lab");
  await page().waitForSelector('.retro-screen[data-mode="editor"]');

  await dragSelection(
    { row: 1, col: 2, ratioX: 0.1 },
    { row: 1, col: 3, ratioX: 0.95 }
  );

  const selectedState = await readEditorState();
  assert.deepEqual(selectedState.selectedOffsets, [1, 2]);
  assert.match(selectedState.activeElementClassName, /retro-screen__input/u);

  await page().keyboard.press("Backspace");

  const finalState = await readEditorState();
  assert.equal(finalState.value, "AD");
  assert.deepEqual(finalState.selectedOffsets, []);
  assert.equal(finalState.selectionStart, 1);
  assert.equal(finalState.selectionEnd, 1);
});

test("editor story supports reverse drag selection and Delete removal", async () => {
  await harness.gotoStory("retroscreen-editor--editor-selection-lab");
  await page().waitForSelector('.retro-screen[data-mode="editor"]');

  await dragSelection(
    { row: 1, col: 3, ratioX: 0.95 },
    { row: 1, col: 2, ratioX: 0.1 }
  );

  const selectedState = await readEditorState();
  assert.deepEqual(selectedState.selectedOffsets, [1, 2]);

  await page().keyboard.press("Delete");

  const finalState = await readEditorState();
  assert.equal(finalState.value, "AD");
  assert.deepEqual(finalState.selectedOffsets, []);
  assert.equal(finalState.selectionStart, 1);
  assert.equal(finalState.selectionEnd, 1);
});

test("wrapped editor selections delete cleanly without overflowing the measured grid", async () => {
  await harness.gotoStory("retroscreen-editor--editor-selection-wrapped");
  await page().waitForSelector('.retro-screen[data-mode="editor"]');

  await dragSelection(
    { row: 1, col: 3, ratioX: 0.1 },
    { row: 2, col: 2, ratioX: 0.95 }
  );

  const selectedState = await readEditorState();
  assert.deepEqual(selectedState.selectedOffsets, [2, 3, 4, 5]);

  await page().keyboard.press("Backspace");

  const finalState = await readEditorState();
  assert.equal(finalState.value, "ABGHIJKL");
  assert.deepEqual(finalState.selectedOffsets, []);
  assert.ok(
    finalState.lines.every((line) => line.length <= finalState.cols),
    "Wrapped editor lines should stay inside the measured column count after deletion."
  );
});

test("double-click selects a whole word in editor mode", async () => {
  await harness.gotoStory("retroscreen-editor--editor-word-selection-lab");
  await page().waitForSelector('.retro-screen[data-mode="editor"]');

  const point = await getGridPoint({
    row: 1,
    col: 9,
    ratioX: 0.5
  });

  await page().mouse.dblclick(point.x, point.y);

  const selectedState = await readEditorState();
  assert.deepEqual(selectedState.selectedOffsets, [6, 7, 8, 9, 10, 11, 12]);
  assert.equal(selectedState.selectionStart, 6);
  assert.equal(selectedState.selectionEnd, 13);
});

test("keyboard word-selection shortcuts delete the selected word cleanly", async () => {
  await harness.gotoStory("retroscreen-editor--editor-word-selection-lab");
  await page().waitForSelector('.retro-screen[data-mode="editor"]');

  await page().locator(".retro-screen__input").evaluate((input) => {
    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }

    input.focus();
    input.setSelectionRange(0, 0);
    input.dispatchEvent(new Event("select", { bubbles: true }));
  });

  await page().keyboard.down("Control");
  await page().keyboard.down("Shift");
  await page().keyboard.press("ArrowRight");
  await page().keyboard.up("Shift");
  await page().keyboard.up("Control");

  const selectedState = await readEditorState();
  assert.deepEqual(selectedState.selectedOffsets, [0, 1, 2, 3, 4]);
  assert.equal(selectedState.selectionStart, 0);
  assert.equal(selectedState.selectionEnd, 5);

  await page().keyboard.press("Backspace");

  const finalState = await readEditorState();
  assert.equal(finalState.value, " display tty");
  assert.deepEqual(finalState.selectedOffsets, []);
  assert.ok(
    finalState.lines.every((line) => line.length <= finalState.cols),
    "Editor lines should stay within the measured column count after keyboard word deletion."
  );
});

test("read-only editor story preserves its content when delete keys are pressed", async () => {
  await harness.gotoStory("retroscreen-editor--editor-selection-read-only");
  await page().waitForSelector('.retro-screen[data-mode="editor"]');

  await dragSelection(
    { row: 1, col: 2, ratioX: 0.1 },
    { row: 1, col: 3, ratioX: 0.95 }
  );

  const selectedState = await readEditorState();
  assert.deepEqual(selectedState.selectedOffsets, [1, 2]);

  await page().keyboard.press("Backspace");
  await page().keyboard.press("Delete");

  const finalState = await readEditorState();
  assert.equal(finalState.value, "ABCD");
  assert.deepEqual(finalState.selectedOffsets, [1, 2]);
});
