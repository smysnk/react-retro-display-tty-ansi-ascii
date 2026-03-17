import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/styles/retro-screen.css");
const destinationPath = path.resolve("dist/styles.css");

await mkdir(path.dirname(destinationPath), { recursive: true });
await copyFile(sourcePath, destinationPath);
