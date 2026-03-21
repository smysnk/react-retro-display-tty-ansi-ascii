import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

const readDisplayBufferState = async () =>
  page().locator(".retro-lcd").evaluate((root) => ({
    rows: Number(root.getAttribute("data-rows") ?? "0"),
    cols: Number(root.getAttribute("data-cols") ?? "0"),
    bufferOffset: Number(root.getAttribute("data-buffer-offset") ?? "0"),
    maxBufferOffset: Number(root.getAttribute("data-buffer-max-offset") ?? "0"),
    autoFollow: root.getAttribute("data-auto-follow") === "true",
    lines: Array.from(root.querySelectorAll(".retro-lcd__line")).map((line) =>
      (line.textContent ?? "").replace(/\u00a0/gu, " ")
    )
  }));

const waitForBufferOffset = async (
  expectedOffset,
  { timeoutMs = 10000, strict = true } = {}
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const state = await readDisplayBufferState();
    if (state.bufferOffset === expectedOffset) {
      return state;
    }

    await page().waitForTimeout(80);
  }

  const lastState = await readDisplayBufferState();
  if (strict) {
    assert.equal(
      lastState.bufferOffset,
      expectedOffset,
      `Expected buffer offset ${expectedOffset}, received ${lastState.bufferOffset}.`
    );
  }
  return lastState;
};

const moveMouseToViewportCenter = async (viewport) => {
  const box = await viewport.boundingBox();
  assert.ok(box, "The viewport should expose a measurable box.");
  await page().mouse.move(box.x + box.width / 2, box.y + box.height / 2);
};

test("display buffer story pages through history and preserves the visible window while follow mode is off", async () => {
  await harness.gotoStory("retroscreen-ansi-display-buffer--display-buffer");

  await page().waitForFunction(() => {
    const root = document.querySelector(".retro-lcd");
    const maxOffset = Number(root?.getAttribute("data-buffer-max-offset") ?? "0");
    const text = (root?.querySelector(".retro-lcd__body")?.textContent ?? "").replace(/\u00a0/gu, " ");
    return maxOffset > 0 && text.includes("line-18");
  });

  const viewport = page().locator(".retro-lcd__viewport");
  await viewport.click();

  const liveState = await readDisplayBufferState();
  assert.ok(liveState.rows > 0, "The story should expose measured rows.");
  assert.ok(liveState.cols > 0, "The story should expose measured cols.");
  assert.equal(liveState.bufferOffset, 0, "The display buffer should start at the live tail.");
  assert.equal(liveState.autoFollow, true, "Auto-follow should start enabled.");
  assert.ok(liveState.maxBufferOffset > 0, "The buffer should contain scrollback.");
  assert.ok(
    liveState.lines.join("").includes("line-18"),
    "The live tail should show the newest seeded line."
  );

  await page().keyboard.press("PageUp");
  await page().waitForFunction(() => {
    const root = document.querySelector(".retro-lcd");
    return Number(root?.getAttribute("data-buffer-offset") ?? "0") > 0;
  });

  const scrolledState = await readDisplayBufferState();
  assert.ok(scrolledState.bufferOffset > 0, "PageUp should move into scrollback.");
  assert.equal(scrolledState.autoFollow, false, "Paging upward should disable auto-follow.");
  assert.notDeepEqual(
    scrolledState.lines,
    liveState.lines,
    "Paging upward should change the visible lines."
  );

  const previousMaxBufferOffset = scrolledState.maxBufferOffset;
  await page().getByRole("button", { name: "Append live line" }).click();
  await page().waitForFunction((expectedMaxOffset) => {
    const root = document.querySelector(".retro-lcd");
    return Number(root?.getAttribute("data-buffer-max-offset") ?? "0") > expectedMaxOffset;
  }, previousMaxBufferOffset);

  const anchoredState = await readDisplayBufferState();
  assert.equal(
    anchoredState.autoFollow,
    false,
    "Appending output while scrolled back should keep auto-follow disabled."
  );
  assert.deepEqual(
    anchoredState.lines,
    scrolledState.lines,
    "Appending output while scrolled back should keep the visible window anchored."
  );
  assert.ok(
    anchoredState.bufferOffset >= scrolledState.bufferOffset,
    "The scroll offset should stay anchored relative to new output."
  );

  await viewport.click();
  await page().keyboard.press("End");
  await page().waitForFunction(() => {
    const root = document.querySelector(".retro-lcd");
    return Number(root?.getAttribute("data-buffer-offset") ?? "0") === 0;
  });

  const refollowedState = await readDisplayBufferState();
  assert.equal(refollowedState.bufferOffset, 0, "End should return the viewport to the live tail.");
  assert.equal(refollowedState.autoFollow, true, "Returning to the bottom should re-enable auto-follow.");
  assert.ok(
    refollowedState.lines.join("").includes("line-19"),
    "The live tail should include the appended line once follow mode is restored."
  );
});

test("display buffer story supports mouse-wheel scrolling and wheel-based recovery to the live tail", async () => {
  await harness.gotoStory("retroscreen-ansi-display-buffer--display-buffer");

  await page().waitForFunction(() => {
    const root = document.querySelector(".retro-lcd");
    return Number(root?.getAttribute("data-buffer-max-offset") ?? "0") > 0;
  });

  const viewport = page().locator(".retro-lcd__viewport");
  await moveMouseToViewportCenter(viewport);
  await page().mouse.wheel(0, -480);

  await page().waitForFunction(() => {
    const root = document.querySelector(".retro-lcd");
    return Number(root?.getAttribute("data-buffer-offset") ?? "0") > 0;
  });

  const scrolledState = await readDisplayBufferState();
  assert.ok(scrolledState.bufferOffset > 0, "Wheel-up should move into scrollback.");
  assert.equal(scrolledState.autoFollow, false, "Wheel-up should disable auto-follow.");

  let recoveredState = scrolledState;
  const recoveryDeadline = Date.now() + 12000;

  while (recoveredState.bufferOffset > 0 && Date.now() <= recoveryDeadline) {
    await moveMouseToViewportCenter(viewport);
    await page().mouse.wheel(0, Math.max(960, recoveredState.bufferOffset * 96));
    recoveredState = await waitForBufferOffset(0, { timeoutMs: 500, strict: false });
  }

  const liveState = recoveredState.bufferOffset === 0 ? recoveredState : await readDisplayBufferState();
  assert.equal(liveState.bufferOffset, 0, "Wheel-down should be able to reach the live tail again.");
  assert.equal(liveState.autoFollow, true, "Reaching the bottom should restore auto-follow.");
  assert.ok(
    liveState.lines.join("").includes("line-18"),
    "The live tail should still show the newest visible line after wheel recovery."
  );
});
