import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, normalize, resolve } from "node:path";
import { chromium } from "playwright-core";

const rootDir = resolve(new URL("..", import.meta.url).pathname);
const staticDir = resolve(rootDir, "storybook-static");
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);
const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);

const getRange = (values) => {
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    min,
    max,
    delta: max - min
  };
};

const detectChromePath = async () => {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "No Chrome or Chromium executable was found. Set CHROME_PATH to run the browser smoke tests."
  );
};

const createStaticServer = () =>
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const stripped = url.pathname === "/" ? "/index.html" : url.pathname;
      const safePath = normalize(stripped).replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = resolve(staticDir, `.${safePath}`);

      if (!filePath.startsWith(staticDir)) {
        throw new Error("Blocked path traversal attempt.");
      }

      const details = await stat(filePath);
      const finalPath = details.isDirectory() ? resolve(filePath, "index.html") : filePath;
      const contentType = mimeTypes.get(extname(finalPath)) ?? "application/octet-stream";

      response.writeHead(200, { "content-type": contentType });
      createReadStream(finalPath).pipe(response);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : "Not found");
    }
  });

const run = async () => {
  await access(staticDir);

  const server = createStaticServer();
  await new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => resolvePromise(undefined));
  });

  const port = server.address().port;
  const browser = await chromium.launch({
    executablePath: await detectChromePath(),
    headless: true
  });
  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1100
    }
  });

  try {
    await page.goto(
      `http://127.0.0.1:${port}/iframe.html?id=retroscreen--fit-width-locked-frame&viewMode=story`,
      {
        waitUntil: "networkidle"
      }
    );
    await page.waitForSelector('.retro-screen[data-display-layout-mode="fit-width"]');
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });
    await page.waitForTimeout(700);

    const snapshot = await page.evaluate(async () => {
      const root = document.querySelector('.retro-screen[data-display-layout-mode="fit-width"]');
      const stage = document.querySelector('[data-fit-width-jitter-stage="true"]');
      const firstLine = root?.querySelector(".retro-screen__line");

      if (
        !(root instanceof HTMLElement) ||
        !(stage instanceof HTMLElement) ||
        !(firstLine instanceof HTMLElement)
      ) {
        throw new Error("Missing fit-width stability story elements.");
      }

      const sampleRect = (node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        };
      };

      const waitFrame = () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
          });
        });

      const samples = [];

      for (let index = 0; index < 24; index += 1) {
        await waitFrame();
        samples.push({
          root: sampleRect(root),
          stage: sampleRect(stage),
          firstLine: sampleRect(firstLine),
          fontVariable: root.style.getPropertyValue("--retro-screen-font-size"),
          cellHeightVariable: root.style.getPropertyValue("--retro-screen-cell-height")
        });
      }

      return {
        dataDisplayLayoutMode: root.getAttribute("data-display-layout-mode"),
        devicePixelRatio: window.devicePixelRatio,
        samples
      };
    });

    assert.equal(snapshot.dataDisplayLayoutMode, "fit-width");
    assert.equal(snapshot.samples.length, 24);

    const rootWidthRange = getRange(snapshot.samples.map((entry) => entry.root.width));
    const rootHeightRange = getRange(snapshot.samples.map((entry) => entry.root.height));
    const rootLeftRange = getRange(snapshot.samples.map((entry) => entry.root.left));
    const rootTopRange = getRange(snapshot.samples.map((entry) => entry.root.top));
    const firstLineTopRange = getRange(snapshot.samples.map((entry) => entry.firstLine.top));
    const stageWidthRange = getRange(snapshot.samples.map((entry) => entry.stage.width));
    const stageHeightRange = getRange(snapshot.samples.map((entry) => entry.stage.height));
    const fontVariableRange = getRange(
      snapshot.samples.map((entry) => Number.parseFloat(entry.fontVariable))
    );
    const cellHeightVariableRange = getRange(
      snapshot.samples.map((entry) => Number.parseFloat(entry.cellHeightVariable))
    );

    assert.ok(
      rootWidthRange.delta <= 0.5,
      `fit-width root width should not jitter (delta ${rootWidthRange.delta}px at dpr ${snapshot.devicePixelRatio}).`
    );
    assert.ok(
      rootHeightRange.delta <= 0.5,
      `fit-width root height should not jitter (delta ${rootHeightRange.delta}px at dpr ${snapshot.devicePixelRatio}).`
    );
    assert.ok(
      rootLeftRange.delta <= 0.5,
      `fit-width root horizontal position should stay stable (delta ${rootLeftRange.delta}px).`
    );
    assert.ok(
      rootTopRange.delta <= 0.5,
      `fit-width root vertical position should stay stable (delta ${rootTopRange.delta}px).`
    );
    assert.ok(
      firstLineTopRange.delta <= 0.5,
      `first rendered line should not jump vertically (delta ${firstLineTopRange.delta}px).`
    );
    assert.ok(
      stageWidthRange.delta <= 0.5,
      `fit-width stage width should stay stable (delta ${stageWidthRange.delta}px).`
    );
    assert.ok(
      stageHeightRange.delta <= 0.5,
      `fit-width stage height should stay stable (delta ${stageHeightRange.delta}px).`
    );
    assert.ok(
      fontVariableRange.delta <= 0.5,
      `fit-width font variable should stay stable (delta ${fontVariableRange.delta}px).`
    );
    assert.ok(
      cellHeightVariableRange.delta <= 0.5,
      `fit-width cell-height variable should stay stable (delta ${cellHeightVariableRange.delta}px).`
    );

    console.log("fit-width layout stability check passed");
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolvePromise) => {
      server.close(() => resolvePromise(undefined));
    });
  }
};

await run();
