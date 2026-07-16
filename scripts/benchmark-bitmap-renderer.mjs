import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, normalize, resolve } from "node:path";
import { chromium } from "playwright-core";

const rootDir = resolve(new URL("..", import.meta.url).pathname);
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
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

const detectChromePath = async () => {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("No Chrome or Chromium executable found. Set CHROME_PATH to run perf:bitmap.");
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const stripped = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = normalize(stripped).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = resolve(staticDir, `.${safePath}`);
    const details = await stat(filePath);
    const finalPath = details.isDirectory() ? resolve(filePath, "index.html") : filePath;
    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(finalPath)) ?? "application/octet-stream"
    });
    createReadStream(finalPath).pipe(response);
  } catch (error) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Not found");
  }
});

await access(staticDir);
await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: await detectChromePath(), headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

try {
  const startedAt = performance.now();
  await page.goto(
    `http://127.0.0.1:${port}/iframe.html?id=retroscreen--canvas-backend-stress&viewMode=story`,
    { waitUntil: "networkidle" }
  );
  await page.waitForSelector('[data-retro-screen-canvas-ready="true"]');
  const mountDurationMs = Number((performance.now() - startedAt).toFixed(2));
  const metrics = await page.evaluate(() => ({
    backend: document.querySelector(".retro-screen")?.getAttribute("data-render-backend"),
    totalDomNodes: document.querySelectorAll("*").length,
    lineElements: document.querySelectorAll(".retro-screen__line").length,
    cellElements: document.querySelectorAll(".retro-screen__cell").length,
    canvasTiles: document.querySelectorAll("[data-retro-screen-bitmap-canvas='true']").length,
    maximumCanvasHeight: Math.max(
      ...Array.from(document.querySelectorAll("canvas")).map((canvas) => canvas.height)
    ),
    retainedPixelBytes: Array.from(document.querySelectorAll("canvas")).reduce(
      (total, canvas) => total + canvas.width * canvas.height * 4,
      0
    )
  }));

  console.log(JSON.stringify({
    scenario: "80x1000 explicit canvas backend",
    mountDurationMs,
    ...metrics
  }, null, 2));
} finally {
  await page.close();
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
