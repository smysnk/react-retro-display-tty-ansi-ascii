import assert from "node:assert/strict";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";
import { getNodeTtySupportError } from "../scripts/tty-support.mjs";
import { startTtyWebSocketServer } from "../scripts/tty-websocket-server.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;
const scriptPath = fileURLToPath(new URL("../scripts/tty-test-terminal.mjs", import.meta.url));
const ttySupportError = getNodeTtySupportError();
const ciTtyBridgeUnsupported =
  process.env.GITHUB_ACTIONS === "true" && process.env.RUN_TTY_BRIDGE_E2E !== "true";

const waitForTerminalText = async (fragment) => {
  await page().waitForFunction(
    (expected) =>
      (document.querySelector(".retro-screen__body")?.textContent ?? "")
        .replace(/\u00a0/gu, " ")
        .includes(expected),
    fragment
  );
};

const waitForTerminalPattern = async (patternSource) => {
  await page().waitForFunction(
    (source) => {
      const text = (document.querySelector(".retro-screen__body")?.textContent ?? "").replace(/\u00a0/gu, " ");
      return new RegExp(source, "u").test(text);
    },
    patternSource
  );
};

const getTerminalText = async () =>
  page()
    .locator(".retro-screen__body")
    .evaluate((node) => (node.textContent ?? "").replace(/\u00a0/gu, " "));

const submitCommand = async (value) => {
  await page().keyboard.type(value);
  await page().keyboard.press("Enter");
};

test("live TTY bridge story can drive a real TTY session end to end", {
  skip: Boolean(ttySupportError) || ciTtyBridgeUnsupported
}, async (t) => {
  const server = await startTtyWebSocketServer({
    port: 0,
    defaultCommand: process.execPath,
    defaultArgs: [scriptPath],
    allowCommandOverride: false
  });
  t.after(async () => {
    await server.close();
  });

  await page().addInitScript((config) => {
    window.__RETRO_SCREEN_TTY_DEMO__ = config;
  }, {
    url: server.url,
    openPayload: {
      term: "xterm-256color"
    }
  });

  await harness.gotoStory("retroscreen--live-tty-terminal-bridge");
  await page().waitForSelector('.retro-screen[data-session-state="open"]');
  await waitForTerminalText("READY");

  const viewport = page().locator(".retro-screen__viewport");
  const root = page().locator(".retro-screen");
  await viewport.click();

  await submitCommand("PING");
  await waitForTerminalText("PONG");

  const beforeResize = await root.evaluate((node) => ({
    rows: Number(node.getAttribute("data-rows")),
    cols: Number(node.getAttribute("data-cols"))
  }));

  await page().getByRole("button", { name: "Wide" }).click();
  await page().waitForFunction(
    ([rows, cols]) => {
      const rootNode = document.querySelector(".retro-screen");
      return (
        Number(rootNode?.getAttribute("data-rows")) !== rows ||
        Number(rootNode?.getAttribute("data-cols")) !== cols
      );
    },
    [beforeResize.rows, beforeResize.cols]
  );

  await page().waitForTimeout(1200);
  const afterResize = await root.evaluate((node) => ({
    rows: Number(node.getAttribute("data-rows")),
    cols: Number(node.getAttribute("data-cols"))
  }));
  await viewport.focus();
  await submitCommand("SIZE?");
  await waitForTerminalPattern(`(?:^|\\s)SIZE ${afterResize.cols}x${afterResize.rows}(?:\\s|$)`);

  await viewport.focus();
  await submitCommand("TITLE Browser TTY Demo");
  await page().waitForSelector('.retro-screen[data-session-title="Browser TTY Demo"]');

  await viewport.focus();
  await submitCommand("BELL");
  await page().waitForSelector('.retro-screen[data-session-bell-count="1"]');

  await viewport.focus();
  await submitCommand("FOCUSON");
  await waitForTerminalText("FOCUS ON");
  await page().locator('[data-tty-size="compact"]').focus();
  await waitForTerminalText("FOCUS OUT");
  await viewport.focus();
  await waitForTerminalText("FOCUS IN");

  await viewport.focus();
  await submitCommand("PASTEON");
  await waitForTerminalText("PASTE ON");
  await viewport.evaluate((node, value) => {
    const event = new Event("paste", {
      bubbles: true,
      cancelable: true
    });

    Object.defineProperty(event, "clipboardData", {
      configurable: true,
      value: {
        getData(type) {
          return type === "text/plain" ? value : "";
        }
      }
    });

    node.dispatchEvent(event);
  }, "alpha\nbeta");
  await waitForTerminalText("PASTE alpha\\nbeta");

  await viewport.focus();
  await submitCommand("MOUSEON");
  await waitForTerminalText("MOUSE ON");
  await viewport.click({
    position: {
      x: 120,
      y: 48
    }
  });
  await waitForTerminalText("MOUSE <");

  await viewport.focus();
  await submitCommand("ALT");
  await waitForTerminalText("ALT-SCREEN");

  await viewport.focus();
  await submitCommand("MAIN");
  await waitForTerminalText("PRIMARY");

  const terminalText = await getTerminalText();
  await assert.doesNotReject(() =>
    root.waitFor({
      state: "attached"
    })
  );
  assert.equal(await root.getAttribute("data-session-title"), "Browser TTY Demo");
  assert.equal(await root.getAttribute("data-session-bell-count"), "1");
  assert.match(terminalText, /SIZE \d+x\d+/u);
  assert.match(terminalText, /PASTE alpha\\nbeta/u);
  assert.match(terminalText, /MOUSE </u);
  assert.match(terminalText, /PRIMARY/u);
});
