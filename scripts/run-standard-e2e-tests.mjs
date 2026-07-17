import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const e2eRoot = resolve("e2e");
const excludedOracleSuites = new Set([
  "ansilove-focused-parity.test.mjs",
  "ansilove-native-contract.test.mjs"
]);
const testFiles = (await readdir(e2eRoot))
  .filter((filename) => filename.endsWith(".test.mjs"))
  .filter((filename) => !excludedOracleSuites.has(filename))
  .sort()
  .map((filename) => resolve(e2eRoot, filename));

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  env: process.env,
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
