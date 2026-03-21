import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

const readHandles = async () =>
  page().locator(".retro-lcd").evaluate((root) => ({
    resizableMode: root.getAttribute("data-resizable-mode") ?? "",
    leadingEdges: root.getAttribute("data-resizable-leading-edges") ?? "",
    handles: Array.from(root.querySelectorAll("[data-resize-handle]")).map((handle) =>
      handle.getAttribute("data-resize-handle")
    )
  }));

test("storybook resize demos expose every resize handle by default", async () => {
  await harness.gotoStory("retroscreen-resize-responsive--resizable-panel");
  await page().waitForSelector(".retro-lcd");

  const summary = await readHandles();

  assert.equal(summary.resizableMode, "both");
  assert.equal(summary.leadingEdges, "true");
  assert.ok(summary.handles.includes("right"));
  assert.ok(summary.handles.includes("bottom"));
  assert.ok(summary.handles.includes("bottom-right"));
  assert.ok(summary.handles.includes("left"));
  assert.ok(summary.handles.includes("top"));
  assert.ok(summary.handles.includes("top-left"));
});

test("leading-edge resize handles can still grow the panel from left and top", async () => {
  await harness.gotoStory("retroscreen-resize-responsive--resizable-panel-leading-edges");
  await page().waitForSelector(".retro-lcd");

  const root = page().locator(".retro-lcd");
  const leftHandle = page().locator('[data-resize-handle="left"]');
  const topHandle = page().locator('[data-resize-handle="top"]');
  const topLeftHandle = page().locator('[data-resize-handle="top-left"]');

  const summary = await readHandles();
  assert.equal(summary.leadingEdges, "true");
  assert.ok(summary.handles.includes("left"));
  assert.ok(summary.handles.includes("top"));
  assert.ok(summary.handles.includes("top-left"));

  const initialBox = await root.boundingBox();
  assert.ok(initialBox, "The resizable panel should expose a measurable root box.");

  await page().mouse.move(initialBox.x + 120, initialBox.y + 120);
  await page().mouse.down();
  await page().mouse.up();
  await page().waitForFunction(
    () => document.querySelector(".sb-retro-resize-demo-stage")?.getAttribute("data-demo-resize-state") === "paused"
  );
  await page().waitForTimeout(420);

  const leftHandleBox = await leftHandle.boundingBox();
  assert.ok(leftHandleBox, "The explicit leading-edge story should expose a left resize handle.");

  await page().mouse.move(
    leftHandleBox.x + leftHandleBox.width / 2,
    leftHandleBox.y + leftHandleBox.height / 2
  );
  await page().mouse.down();
  await page().mouse.move(
    leftHandleBox.x + leftHandleBox.width / 2 - 140,
    leftHandleBox.y + leftHandleBox.height / 2,
    { steps: 12 }
  );
  await page().mouse.up();

  const afterLeftBox = await root.boundingBox();
  assert.ok(afterLeftBox, "The panel should still be measurable after left-edge dragging.");
  assert.ok(
    afterLeftBox.width > initialBox.width + 60,
    "Dragging the left resize handle outward should lengthen the panel width."
  );

  const topHandleBox = await topHandle.boundingBox();
  assert.ok(topHandleBox, "The explicit leading-edge story should expose a top resize handle.");

  await page().mouse.move(
    topHandleBox.x + topHandleBox.width / 2,
    topHandleBox.y + topHandleBox.height / 2
  );
  await page().mouse.down();
  await page().mouse.move(
    topHandleBox.x + topHandleBox.width / 2,
    topHandleBox.y + topHandleBox.height / 2 - 84,
    { steps: 8 }
  );
  await page().mouse.up();

  const afterTopBox = await root.boundingBox();
  assert.ok(afterTopBox, "The panel should still be measurable after top-edge dragging.");
  assert.ok(
    afterTopBox.height > afterLeftBox.height + 50,
    "Dragging the top resize handle upward should lengthen the panel height."
  );

  const topLeftHandleBox = await topLeftHandle.boundingBox();
  assert.ok(topLeftHandleBox, "Both-axis leading-edge mode should expose a top-left corner handle.");
});
