import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = resolve(import.meta.dirname, "..");
const readmePath = resolve(rootDir, "README.md");
const examplesDir = resolve(rootDir, "examples/readme");
const failures = [];

const syncResult = spawnSync(process.execPath, ["./scripts/sync-readme-examples.mjs", "--check"], {
  cwd: rootDir,
  encoding: "utf8"
});

if (syncResult.status !== 0) {
  failures.push((syncResult.stderr || syncResult.stdout).trim());
}

const readme = await readFile(readmePath, "utf8");

if (/\/Users\/|file:\/\//u.test(readme)) {
  failures.push("README.md contains a developer-local absolute path.");
}

const requiredMarkers = [
  "getting-started",
  "touch-input",
  "resizable-panel",
  "quiet-output",
  "signal-intercept",
  "editable-drafting",
  "terminal-output",
  "live-tty-websocket-bridge",
  "prompt-interaction",
  "display-color-modes",
  "control-character-replay"
];

for (const id of requiredMarkers) {
  if (!readme.includes(`<!-- readme-example:${id} `)) {
    failures.push(`README.md is missing the synchronized ${id} example.`);
  }
}

const requiredSourceLinks = [
  "examples/readme/light-dark-surfaces/",
  "examples/readme/matrix-code-rain/",
  "examples/readme/midjourney-vortex/",
  "examples/readme/auto-resize-probe/",
  "examples/readme/ansi-art-playback/",
  "examples/readme/live-tty-websocket-bridge/",
  "examples/readme/apple2-basic/"
];

for (const sourceLink of requiredSourceLinks) {
  if (!readme.includes(sourceLink)) {
    failures.push(`README.md is missing the complete source link: ${sourceLink}`);
  }
}

const requiredLabels = ["Complete example", "Complete multi-file example", "API fragment"];
for (const label of requiredLabels) {
  if (!readme.includes(label)) {
    failures.push(`README.md never declares the documentation label: ${label}`);
  }
}

const markdownLinkPattern = /\[[^\]]*\]\(([^)]+)\)/gu;
for (const match of readme.matchAll(markdownLinkPattern)) {
  const target = match[1].split("#", 1)[0];
  if (!target || /^(?:https?:|mailto:|#)/u.test(target)) continue;

  const normalized = target.startsWith("/") ? target.slice(1) : target.replace(/^\.\//u, "");
  try {
    await stat(resolve(rootDir, normalized));
  } catch {
    failures.push(`README.md links to a missing local path: ${target}`);
  }
}

const sourceFiles = [];
const collectSources = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectSources(path);
    else if (/\.tsx?$/u.test(entry.name) && !entry.name.endsWith(".d.ts")) sourceFiles.push(path);
  }
};
await collectSources(examplesDir);

for (const sourcePath of sourceFiles) {
  const source = await readFile(sourcePath, "utf8");
  if (!source.includes('from "react-retro-display-tty-ansi-ascii"')) {
    failures.push(`${sourcePath} does not import the public package entry point.`);
  }
  if (!source.includes('import "react-retro-display-tty-ansi-ascii/styles.css"')) {
    failures.push(`${sourcePath} does not import the public package stylesheet.`);
  }
  if (/from ["'][^"']*(?:src\/|\.storybook|stories\/)/u.test(source)) {
    failures.push(`${sourcePath} imports a private repository module.`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`README example checks passed (${sourceFiles.length} source files).`);
