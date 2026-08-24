import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const project = "react-retro-screen";
const surface = "storybook";
const repository = "smysnk/react-retro-display-tty-ansi-ascii";
const basePath = "/projects/react-retro-screen/storybook/";
const publicUrl = `https://smysnk.com${basePath}`;
const outputDir = resolve(process.env.STORYBOOK_OUTPUT_DIR ?? "storybook-static");

const resolveRevision = () => {
  const configuredRevision = process.env.STORYBOOK_SOURCE_REVISION ?? process.env.GITHUB_SHA;
  if (configuredRevision) return configuredRevision;
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
};

const revision = resolveRevision();
if (!/^[0-9a-f]{40}$/.test(revision)) {
  throw new Error("Storybook source revision must be a full lowercase 40-character Git SHA.");
}

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const metadata = {
  schemaVersion: 1,
  project,
  surface,
  repository,
  revision,
  storybookVersion: packageJson.devDependencies?.storybook ?? null,
  basePath,
  publicUrl,
  builtAt: new Date().toISOString()
};

await writeFile(
  resolve(outputDir, "build-metadata.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
  "utf8"
);

console.log(`Wrote ${surface} metadata for ${project} at ${revision}.`);
