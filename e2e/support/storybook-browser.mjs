import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, normalize, resolve } from "node:path";
import { after, before } from "node:test";
import { chromium } from "playwright-core";

const rootDir = resolve(new URL("../..", import.meta.url).pathname);
const staticDir = resolve(rootDir, "storybook-static");
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

export const createStorybookBrowserHarness = ({
  viewport = {
    width: 1440,
    height: 1100
  }
} = {}) => {
  let browser;
  let page;
  let server;
  let port;

  before(async () => {
    await access(staticDir);
    server = createStaticServer();

    await new Promise((resolvePromise) => {
      server.listen(0, "127.0.0.1", () => {
        port = server.address().port;
        resolvePromise(undefined);
      });
    });

    browser = await chromium.launch({
      executablePath: await detectChromePath(),
      headless: true
    });

    page = await browser.newPage({ viewport });
  });

  after(async () => {
    await page?.close();
    await browser?.close();

    await new Promise((resolvePromise) => {
      server?.close(() => resolvePromise(undefined));
    });
  });

  return {
    get page() {
      return page;
    },
    gotoStory: async (storyId) => {
      await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${storyId}&viewMode=story`, {
        waitUntil: "networkidle"
      });
    }
  };
};
