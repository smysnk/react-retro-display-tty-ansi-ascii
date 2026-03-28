import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/styles/retro-screen.css");
const destinationPath = path.resolve("dist/styles.css");
const sourceFontsDir = path.resolve("src/styles/fonts");
const destinationFontsDir = path.resolve("dist/fonts");

await mkdir(path.dirname(destinationPath), { recursive: true });
await copyFile(sourcePath, destinationPath);

await mkdir(destinationFontsDir, { recursive: true });

for (const entry of await readdir(sourceFontsDir)) {
  await copyFile(path.join(sourceFontsDir, entry), path.join(destinationFontsDir, entry));
}
