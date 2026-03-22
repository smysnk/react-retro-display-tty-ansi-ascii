import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

test("screen selection keeps keyboard input inside RetroScreen instead of Storybook hex controls", async () => {
  const storyUrl = new URL("/", harness.baseUrl);
  storyUrl.searchParams.set("path", "/story/retroscreen--prompt-loop");

  await page().goto(String(storyUrl), {
    waitUntil: "networkidle"
  });

  await page().waitForSelector("main iframe", { timeout: 60_000 });
  const previewFrame = page().frameLocator("main iframe");
  await previewFrame
    .locator('.retro-screen__input[aria-label="RetroScreen prompt"]')
    .waitFor({ timeout: 60_000 });

  const previewInput = previewFrame.locator(".retro-screen__input");
  await previewInput.evaluate((input) => {
    if (input instanceof HTMLTextAreaElement) {
      input.blur();
    }
  });

  await previewFrame.locator(".retro-screen__viewport").click();
  await page().keyboard.type("status");

  const typedState = await previewFrame.locator(".retro-screen").evaluate((root) => {
    const input = root.querySelector(".retro-screen__input");

    return {
      activeTag:
        document.activeElement instanceof HTMLElement ? document.activeElement.tagName : "",
      activeClassName:
        document.activeElement instanceof HTMLElement ? document.activeElement.className : "",
      value: input instanceof HTMLTextAreaElement ? input.value : ""
    };
  });

  assert.equal(typedState.activeTag, "TEXTAREA");
  assert.match(typedState.activeClassName, /retro-screen__input/u);
  assert.equal(
    typedState.value,
    "status",
    "Typing after selecting the screen should go to the prompt input."
  );

  await page().keyboard.press("Enter");

  await previewFrame.locator(".retro-screen").evaluate(async (root) => {
    const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const transcript = Array.from(root.querySelectorAll(".retro-screen__line")).map((line) =>
        (line.textContent ?? "").replace(/\u00a0/gu, " ")
      );

      if (transcript.some((line) => /READY/u.test(line))) {
        return;
      }

      await wait(100);
    }

    throw new Error("Timed out waiting for the prompt response to render.");
  });

  await page().waitForFunction(() => {
    const iframe = document.querySelector("main iframe");
    return iframe instanceof HTMLIFrameElement && document.activeElement === iframe;
  });

  const promptState = await previewFrame.locator(".retro-screen").evaluate((root) => {
    const input = root.querySelector(".retro-screen__input");

    return {
      activeTag:
        document.activeElement instanceof HTMLElement ? document.activeElement.tagName : "",
      activeClassName:
        document.activeElement instanceof HTMLElement ? document.activeElement.className : "",
      value: input instanceof HTMLTextAreaElement ? input.value : "",
      transcript: Array.from(root.querySelectorAll(".retro-screen__line")).map((line) =>
        (line.textContent ?? "").replace(/\u00a0/gu, " ")
      )
    };
  });

  assert.equal(promptState.activeTag, "TEXTAREA");
  assert.match(promptState.activeClassName, /retro-screen__input/u);
  assert.equal(promptState.value, "");
  assert.ok(
    promptState.transcript.some((line) => /READY/u.test(line)),
    "Submitting the prompt command should produce the story response."
  );

  const hasHexInputInManager = await page().evaluate(() =>
    Boolean(
      document.querySelector('input[placeholder="#000000"], input[aria-label*="hex" i], input[data-testid*="hex" i]')
    )
  );

  assert.equal(
    hasHexInputInManager,
    false,
    "The main RetroScreen stories should not expose Storybook hex controls that can steal keyboard focus."
  );
});
