import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1600,
    height: 1800
  }
});

const page = () => harness.page;

const docsUrl = (baseUrl) => {
  const url = new URL("/iframe.html", baseUrl);
  url.searchParams.set("id", "retroscreen--docs");
  url.searchParams.set("viewMode", "docs");
  return url;
};

const readDisplayScreenshot = async (selector) =>
  page()
    .locator(selector)
    .screenshot({
      animations: "disabled",
      caret: "hide"
    });

const compareScreenshots = async (leftBuffer, rightBuffer) =>
  page().evaluate(
    async ({ leftBase64, rightBase64 }) => {
      const loadBitmap = async (base64) => {
        const response = await fetch(`data:image/png;base64,${base64}`);
        const blob = await response.blob();
        return createImageBitmap(blob);
      };

      const [leftBitmap, rightBitmap] = await Promise.all([
        loadBitmap(leftBase64),
        loadBitmap(rightBase64)
      ]);

      const width = 360;
      const height = 220;
      const createCanvas = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
      };

      const leftCanvas = createCanvas();
      const rightCanvas = createCanvas();
      const leftContext = leftCanvas.getContext("2d");
      const rightContext = rightCanvas.getContext("2d");

      if (!leftContext || !rightContext) {
        throw new Error("Unable to create canvas contexts for docs visual parity.");
      }

      const detectLitBounds = (bitmap) => {
        const scanCanvas = document.createElement("canvas");
        scanCanvas.width = bitmap.width;
        scanCanvas.height = bitmap.height;
        const scanContext = scanCanvas.getContext("2d");

        if (!scanContext) {
          throw new Error("Unable to create scan context for docs visual parity.");
        }

        scanContext.drawImage(bitmap, 0, 0);
        const data = scanContext.getImageData(0, 0, bitmap.width, bitmap.height).data;
        let minX = bitmap.width;
        let minY = bitmap.height;
        let maxX = 0;
        let maxY = 0;
        let litPixels = 0;

        for (let index = 0; index < data.length; index += 4) {
          const pixelIndex = index / 4;
          const x = pixelIndex % bitmap.width;
          const y = Math.floor(pixelIndex / bitmap.width);
          const luma =
            (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;

          if (luma <= 0.08) {
            continue;
          }

          litPixels += 1;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }

        if (litPixels === 0) {
          return {
            x: 0,
            y: 0,
            width: bitmap.width,
            height: bitmap.height
          };
        }

        return {
          x: Math.max(0, minX - 6),
          y: Math.max(0, minY - 6),
          width: Math.min(bitmap.width - Math.max(0, minX - 6), maxX - minX + 13),
          height: Math.min(bitmap.height - Math.max(0, minY - 6), maxY - minY + 13)
        };
      };

      const leftBounds = detectLitBounds(leftBitmap);
      const rightBounds = detectLitBounds(rightBitmap);

      leftContext.drawImage(
        leftBitmap,
        leftBounds.x,
        leftBounds.y,
        leftBounds.width,
        leftBounds.height,
        0,
        0,
        width,
        height
      );
      rightContext.drawImage(
        rightBitmap,
        rightBounds.x,
        rightBounds.y,
        rightBounds.width,
        rightBounds.height,
        0,
        0,
        width,
        height
      );

      const leftData = leftContext.getImageData(0, 0, width, height).data;
      const rightData = rightContext.getImageData(0, 0, width, height).data;
      const rowLeft = new Float64Array(height);
      const rowRight = new Float64Array(height);
      const colLeft = new Float64Array(width);
      const colRight = new Float64Array(width);

      let meanAbsoluteDifference = 0;
      let litLeft = 0;
      let litRight = 0;
      let litIntersection = 0;

      for (let index = 0; index < leftData.length; index += 4) {
        const pixelIndex = index / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const leftLuma =
          (0.2126 * leftData[index] + 0.7152 * leftData[index + 1] + 0.0722 * leftData[index + 2]) / 255;
        const rightLuma =
          (0.2126 * rightData[index] + 0.7152 * rightData[index + 1] + 0.0722 * rightData[index + 2]) / 255;

        meanAbsoluteDifference += Math.abs(leftLuma - rightLuma);
        rowLeft[y] += leftLuma;
        rowRight[y] += rightLuma;
        colLeft[x] += leftLuma;
        colRight[x] += rightLuma;

        const leftLit = leftLuma > 0.08;
        const rightLit = rightLuma > 0.08;

        if (leftLit) {
          litLeft += 1;
        }

        if (rightLit) {
          litRight += 1;
        }

        if (leftLit && rightLit) {
          litIntersection += 1;
        }
      }

      const correlate = (leftValues, rightValues) => {
        let leftSum = 0;
        let rightSum = 0;

        for (let index = 0; index < leftValues.length; index += 1) {
          leftSum += leftValues[index];
          rightSum += rightValues[index];
        }

        const leftMean = leftSum / leftValues.length;
        const rightMean = rightSum / rightValues.length;
        let numerator = 0;
        let leftVariance = 0;
        let rightVariance = 0;

        for (let index = 0; index < leftValues.length; index += 1) {
          const leftDelta = leftValues[index] - leftMean;
          const rightDelta = rightValues[index] - rightMean;

          numerator += leftDelta * rightDelta;
          leftVariance += leftDelta * leftDelta;
          rightVariance += rightDelta * rightDelta;
        }

        if (leftVariance === 0 || rightVariance === 0) {
          return 0;
        }

        return numerator / Math.sqrt(leftVariance * rightVariance);
      };

      const litUnion = litLeft + litRight - litIntersection;

      return {
        meanAbsoluteDifference: meanAbsoluteDifference / (width * height),
        litIntersectionOverUnion: litUnion === 0 ? 1 : litIntersection / litUnion,
        rowCorrelation: correlate(rowLeft, rowRight),
        columnCorrelation: correlate(colLeft, colRight)
      };
    },
    {
      leftBase64: leftBuffer.toString("base64"),
      rightBase64: rightBuffer.toString("base64")
    }
  );

test("docs previews stay visually close to standalone RetroScreen surfaces", async () => {
  const cases = [
    {
      docsStoryId: "calm-readout",
      storyId: "retroscreen--calm-readout"
    }
  ];

  for (const entry of cases) {
    await harness.gotoStory(entry.storyId);
    await page().waitForSelector(".sb-retro-page .sb-retro-shell", { timeout: 60_000 });
    const standaloneScreenshot = await readDisplayScreenshot(".sb-retro-page .retro-screen__screen");

    await page().goto(String(docsUrl(harness.baseUrl)), {
      waitUntil: "networkidle"
    });

    const docsStory = page().locator(`[data-docs-story="${entry.docsStoryId}"]`);
    await docsStory.scrollIntoViewIfNeeded();
    await docsStory.locator(".sb-retro-page .sb-retro-shell").waitFor({ timeout: 60_000 });
    const docsScreenshot = await readDisplayScreenshot(
      `[data-docs-story="${entry.docsStoryId}"] .sb-retro-page .retro-screen__screen`
    );

    const comparison = await compareScreenshots(standaloneScreenshot, docsScreenshot);

    assert.ok(
      comparison.meanAbsoluteDifference <= 0.05,
      `${entry.docsStoryId} should stay visually close in docs. Mean difference: ${comparison.meanAbsoluteDifference}`
    );
    assert.ok(
      comparison.litIntersectionOverUnion >= 0.72,
      `${entry.docsStoryId} should keep a strong lit-pixel overlap in docs. IOU: ${comparison.litIntersectionOverUnion}`
    );
    assert.ok(
      comparison.rowCorrelation >= 0.74,
      `${entry.docsStoryId} should preserve row structure in docs. Correlation: ${comparison.rowCorrelation}`
    );
    assert.ok(
      comparison.columnCorrelation >= 0.4,
      `${entry.docsStoryId} should preserve column structure in docs. Correlation: ${comparison.columnCorrelation}`
    );
  }
});
