import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { after, before, test } from "node:test";

import { chromium } from "playwright-core";

import {
  createRetroScreenAnsiBytePlaybackEngine,
  rasterizeRetroScreenAnsiSnapshot
} from "../dist/index.js";
import { renderAnsiloveJsBytes } from "../scripts/ansilove/js-oracle.mjs";
import { runNativeAnsilove } from "../scripts/ansilove/native-oracle.mjs";
import { ansiloveJsVendorPath } from "../scripts/ansilove/oracle-paths.mjs";

const encoder = new TextEncoder();
const hashPixels = (pixels) =>
  createHash("sha256").update(Buffer.from(pixels)).digest("hex");

const renderOurFinalPixels = ({ bytes, rows, cols }) => {
  const engine = createRetroScreenAnsiBytePlaybackEngine({ rows, cols });
  engine.appendSource(bytes);
  engine.closeSource();
  engine.drain();

  return rasterizeRetroScreenAnsiSnapshot({
    snapshot: engine.getScreenSnapshot(),
    rows,
    cols
  });
};

test("focused final state agrees across AnsiLove/C, Ansilove.js, and drain()", async () => {
  const bytes = encoder.encode(
    "\u001b[2J\u001b[1;1H\u001b[31;44mAB\u001b[0m\u001b[2;1H\u001b[1;37mCD\u001b[0m"
  );
  const native = await runNativeAnsilove({
    bytes,
    args: ["-t", "ans", "-c", "80", "-f", "80x25", "-b", "8"]
  });
  const javascript = await renderAnsiloveJsBytes(bytes);
  const ours = renderOurFinalPixels({ bytes, rows: 2, cols: 80 });

  assert.deepEqual(
    { width: javascript.width, height: javascript.height },
    { width: native.rgba?.width, height: native.rgba?.height }
  );
  assert.deepEqual(
    { width: ours.width, height: ours.height },
    { width: native.rgba?.width, height: native.rgba?.height }
  );
  assert.equal(hashPixels(javascript.data), hashPixels(native.rgba?.data));
  assert.equal(hashPixels(ours.pixels), hashPixels(native.rgba?.data));
});

const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);

let browser;
let page;

before(async () => {
  let executablePath;

  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      executablePath = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!executablePath) {
    throw new Error("Chrome is required for focused Ansilove.js playback parity.");
  }

  browser = await chromium.launch({ executablePath, headless: true });
  page = await browser.newPage();
  await page.goto("about:blank");
  await page.evaluate(() => {
    let nextTimerId = 1;
    const timers = [];

    window.__ANSILOVE_TIMER_QUEUE__ = timers;
    window.setTimeout = (callback, delay = 0) => {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.push({ id, callback, delay });
      return id;
    };
    window.clearTimeout = (id) => {
      const index = timers.findIndex((timer) => timer.id === id);
      if (index >= 0) {
        timers.splice(index, 1);
      }
    };
    window.setInterval = () => nextTimerId++;
    window.clearInterval = () => undefined;
  });
  await page.addScriptTag({ path: ansiloveJsVendorPath });
});

after(async () => {
  await page?.close();
  await browser?.close();
});

test("focused playback agrees with Ansilove.js at each 10ms byte quantum", async () => {
  const bytes = encoder.encode(
    "\u001b[2J\u001b[1;1H\u001b[31mRED-ONE\u001b[2;1H\u001b[32mGREEN-TWO\u001b[3;1H\u001b[1;34mBLUE-THREE\u001b[0m"
  );
  const engine = createRetroScreenAnsiBytePlaybackEngine({
    rows: 25,
    cols: 80,
    baud: 14_400
  });
  engine.appendSource(bytes);
  engine.closeSource();

  await page.evaluate((sourceBytes) => {
    window.__ANSILOVE_DONE__ = false;
    window.__ANSILOVE_CONTROLLER__ = window.AnsiLove.animateBytes(
      new Uint8Array(sourceBytes),
      (canvas) => {
        window.__ANSILOVE_CANVAS__ = canvas;
      },
      {
        font: "80x25",
        bits: "8",
        icecolors: 0,
        columns: 80,
        rows: 25
      }
    );
  }, [...bytes]);

  await page.evaluate(() => {
    const timer = window.__ANSILOVE_TIMER_QUEUE__.shift();
    timer.callback();
    window.__ANSILOVE_CONTROLLER__.play(
      14_400,
      () => {
        window.__ANSILOVE_DONE__ = true;
      },
      true
    );
  });

  const captureOracle = () =>
    page.evaluate(() => {
      const canvas = window.__ANSILOVE_CANVAS__;
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let binary = "";

      for (let offset = 0; offset < pixels.length; offset += 32_768) {
        binary += String.fromCharCode(...pixels.subarray(offset, offset + 32_768));
      }

      return {
        width: canvas.width,
        height: canvas.height,
        rgbaBase64: btoa(binary),
        done: window.__ANSILOVE_DONE__,
        queuedTimers: window.__ANSILOVE_TIMER_QUEUE__.length
      };
    });

  let checkpoints = 0;

  while (engine.getPlaybackState().processedBytes < bytes.length) {
    engine.advanceTime(10);
    const ours = rasterizeRetroScreenAnsiSnapshot({
      snapshot: engine.getScreenSnapshot(),
      rows: 25,
      cols: 80
    });
    const oracle = await captureOracle();

    assert.equal(oracle.width, ours.width);
    assert.equal(oracle.height, ours.height);
    assert.equal(
      hashPixels(Buffer.from(oracle.rgbaBase64, "base64")),
      hashPixels(ours.pixels),
      `checkpoint ${checkpoints}`
    );
    checkpoints += 1;

    if (engine.getPlaybackState().processedBytes < bytes.length) {
      await page.evaluate(() => {
        const timer = window.__ANSILOVE_TIMER_QUEUE__.shift();
        timer.callback();
      });
    }
  }

  await page.evaluate(() => {
    const timer = window.__ANSILOVE_TIMER_QUEUE__.shift();
    timer.callback();
  });
  const completed = await captureOracle();

  assert.equal(completed.done, true);
  assert.equal(engine.getPlaybackState().status, "complete");
  assert.ok(checkpoints >= 3);
});
