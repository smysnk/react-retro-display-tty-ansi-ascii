import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const readmePath = resolve(rootDir, "README.md");
const checkOnly = process.argv.includes("--check");
const markerPattern =
  /<!-- readme-example:([a-z0-9-]+) source="([^"]+)" start -->\n```tsx\n[\s\S]*?\n```\n<!-- readme-example:\1 end -->/gu;

const original = await readFile(readmePath, "utf8");
const matches = Array.from(original.matchAll(markerPattern));

if (matches.length === 0) {
  throw new Error("README.md does not contain any synchronized example markers.");
}

const seenIds = new Set();
let synchronized = original;

for (const match of matches) {
  const [block, id, sourcePath] = match;

  if (seenIds.has(id)) {
    throw new Error(`README example marker is duplicated: ${id}`);
  }
  seenIds.add(id);

  if (sourcePath.startsWith("/") || sourcePath.includes("..")) {
    throw new Error(`README example source must be repository-relative: ${sourcePath}`);
  }

  const source = (await readFile(resolve(rootDir, sourcePath), "utf8")).trimEnd();
  const replacement = [
    `<!-- readme-example:${id} source="${sourcePath}" start -->`,
    "```tsx",
    source,
    "```",
    `<!-- readme-example:${id} end -->`
  ].join("\n");

  synchronized = synchronized.replace(block, replacement);
}

if (synchronized === original) {
  console.log(`README examples are synchronized (${matches.length} blocks).`);
  process.exit(0);
}

if (checkOnly) {
  console.error("README example blocks are stale. Run `yarn readme:examples:sync`.");
  process.exit(1);
}

await writeFile(readmePath, synchronized);
console.log(`Synchronized ${matches.length} README example blocks.`);
