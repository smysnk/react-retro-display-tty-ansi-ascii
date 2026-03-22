import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { request } from "node:http";
import { createServer } from "node:net";
import { test } from "node:test";
import { chromium } from "playwright-core";

const STORYBOOK_STATIC_DIR = "/Users/josh/play/react-retro-display/storybook-static";
const CHROME_PATH =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const getAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a local port for the docs-fonts test."));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });

    server.once("error", reject);
  });

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

const pingServer = (port) =>
  new Promise((resolve) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path: "/iframe.html",
        method: "GET"
      },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      }
    );

    req.on("error", () => resolve(false));
    req.end();
  });

const waitForServer = async (serverProcess, port) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await pingServer(port)) === true) {
      return;
    }

    if (serverProcess.exitCode !== null) {
      throw new Error(`Static server exited early with code ${serverProcess.exitCode}.`);
    }

    await wait(250);
  }

  throw new Error("Timed out waiting for static server startup.");
};

const readTypography = async (page, selector) =>
  page.locator(selector).evaluate((node) => ({
    fontFamily: getComputedStyle(node).fontFamily
  }));

const readStoryTypography = async (page, port, storyId) => {
  await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${storyId}&viewMode=story`, {
    waitUntil: "networkidle"
  });
  await page.waitForSelector(".sb-retro-page .sb-retro-title", { timeout: 30_000 });

  return {
    kicker: await readTypography(page, ".sb-retro-page .sb-retro-kicker"),
    title: await readTypography(page, ".sb-retro-page .sb-retro-title"),
    copy: await readTypography(page, ".sb-retro-page .sb-retro-copy"),
    grid: await readTypography(page, ".sb-retro-page .retro-screen__grid")
  };
};

const readDocsStoryTypography = async (page, port, docsStoryId) => {
  await page.goto(`http://127.0.0.1:${port}/iframe.html?id=retroscreen--docs&viewMode=docs`, {
    waitUntil: "networkidle"
  });
  await page.waitForSelector(`[data-docs-story="${docsStoryId}"] .sb-retro-title`, {
    timeout: 30_000
  });

  return {
    kicker: await readTypography(page, `[data-docs-story="${docsStoryId}"] .sb-retro-kicker`),
    title: await readTypography(page, `[data-docs-story="${docsStoryId}"] .sb-retro-title`),
    copy: await readTypography(page, `[data-docs-story="${docsStoryId}"] .sb-retro-copy`),
    grid: await readTypography(page, `[data-docs-story="${docsStoryId}"] .retro-screen__grid`)
  };
};

test("docs page uses the same story typography as standalone RetroScreen demos", async () => {
  const port = await getAvailablePort();
  const serverProcess = spawn("python3", ["-m", "http.server", String(port), "-d", STORYBOOK_STATIC_DIR], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  await waitForServer(serverProcess, port);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  try {
    const page = await browser.newPage();
    const cases = [
      {
        docsStoryId: "calm-readout",
        storyId: "retroscreen--calm-readout"
      },
      {
        docsStoryId: "prompt-loop",
        storyId: "retroscreen--prompt-loop"
      }
    ];

    for (const entry of cases) {
      const docsTypography = await readDocsStoryTypography(page, port, entry.docsStoryId);
      const storyTypography = await readStoryTypography(page, port, entry.storyId);

      assert.deepEqual(
        docsTypography,
        storyTypography,
        `${entry.docsStoryId} should use the same font families in docs and standalone story views.`
      );
    }

    await page.close();
  } finally {
    await browser.close();
    serverProcess.kill("SIGINT");
    await once(serverProcess, "exit");
  }
});
