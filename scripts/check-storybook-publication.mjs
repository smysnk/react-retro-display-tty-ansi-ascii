import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const basePath = "/projects/react-retro-screen/storybook/";
const outputDir = resolve(process.env.STORYBOOK_OUTPUT_DIR ?? "storybook-static");
const requireBadges = process.env.STORYBOOK_REQUIRE_BADGES !== "0";

const requiredFiles = [
  "index.html",
  "iframe.html",
  "index.json",
  "build-metadata.json",
  "ansi-gallery/manifest.json",
  ...(requireBadges ? ["badges/tests.json", "badges/coverage.json", "badges/health.json"] : [])
];

await Promise.all(requiredFiles.map((file) => access(resolve(outputDir, file))));

const metadata = JSON.parse(await readFile(resolve(outputDir, "build-metadata.json"), "utf8"));
if (
  metadata.project !== "react-retro-screen"
  || metadata.surface !== "storybook"
  || metadata.basePath !== basePath
  || !/^[0-9a-f]{40}$/.test(metadata.revision ?? "")
) {
  throw new Error("Storybook build metadata does not match the mounted publication contract.");
}

const iframeHtml = await readFile(resolve(outputDir, "iframe.html"), "utf8");
if (!iframeHtml.includes(`${basePath}assets/`)) {
  throw new Error("Storybook iframe assets do not use the mounted base path.");
}

const index = JSON.parse(await readFile(resolve(outputDir, "index.json"), "utf8"));
const storyIds = Object.keys(index.entries ?? {});
for (const expectedId of [
  "retroscreen--midjourney-vortex",
  "retroscreen-display-buffer--bad-apple-ansi",
  "readme-examples--getting-started"
]) {
  if (!storyIds.includes(expectedId)) {
    throw new Error(`Expected Storybook entry ${expectedId} is missing.`);
  }
}

const assetsDir = resolve(outputDir, "assets");
const assetFiles = await readdir(assetsDir);
for (const extension of [".js", ".css", ".woff", ".ttf", ".ans", ".gz"]) {
  if (!assetFiles.some((file) => file.endsWith(extension))) {
    throw new Error(`Storybook publication is missing an ${extension} asset.`);
  }
}

const searchableFiles = [
  resolve(outputDir, "iframe.html"),
  ...assetFiles
    .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
    .map((file) => resolve(assetsDir, file))
];
for (const file of searchableFiles) {
  const content = await readFile(file, "utf8");
  if (/(?:src|href)=["']\/assets\/|url\(\/?assets\/|["']\/ansi-gallery\//.test(content)) {
    throw new Error(`Root-escaping Storybook asset reference found in ${file}.`);
  }
}

console.log(`Validated mounted Storybook publication at ${basePath}.`);
