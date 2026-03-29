import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1500,
    height: 1100
  }
});

const page = () => harness.page;

const gotoManagerPath = async (path) => {
  const storyUrl = new URL("/", harness.baseUrl);
  storyUrl.searchParams.set("path", path);

  await page().goto(String(storyUrl), {
    waitUntil: "networkidle"
  });
};

const readRetroScreenSidebarItems = async () =>
  page().evaluate(() => {
    const root = document.querySelector('[data-item-id="retroscreen"]');
    const group = root?.parentElement;

    if (!(root instanceof HTMLElement) || !(group instanceof HTMLElement)) {
      return null;
    }

    return Array.from(group.children)
      .map((node) => {
        if (!(node instanceof HTMLElement)) {
          return null;
        }

        return {
          itemId: node.getAttribute("data-item-id"),
          text: node.innerText.replace(/\s+/gu, " ").trim()
        };
      })
      .filter((entry) => entry?.itemId && entry.itemId !== "retroscreen");
  });

test("storybook sidebar keeps top-level RetroScreen stories ahead of grouped sections", async () => {
  await gotoManagerPath("/story/retroscreen--calm-readout");
  await page().waitForSelector('[data-item-id="retroscreen"]', { timeout: 60_000 });

  const entries = await readRetroScreenSidebarItems();

  assert.ok(entries, "The Storybook manager should render the RetroScreen sidebar section.");

  const orderedItemIds = entries.map((entry) => entry.itemId);
  const groupedSections = [
    "retroscreen-display-buffer",
    "retroscreen-editor",
    "retroscreen-responsive",
    "retroscreen-capture"
  ];
  const lastLeafIndex = orderedItemIds.findIndex((itemId) => groupedSections.includes(itemId));

  assert.notEqual(lastLeafIndex, -1, "The RetroScreen sidebar should include the grouped sections.");

  const trailingGroupSlice = orderedItemIds.slice(lastLeafIndex);

  for (const itemId of groupedSections) {
    assert.ok(
      trailingGroupSlice.includes(itemId),
      `${itemId} should appear after the single-story entries in the RetroScreen sidebar.`
    );
  }

  assert.deepEqual(
    trailingGroupSlice,
    groupedSections,
    `Unexpected trailing RetroScreen sidebar order: ${orderedItemIds.join(" -> ")}`
  );
});
