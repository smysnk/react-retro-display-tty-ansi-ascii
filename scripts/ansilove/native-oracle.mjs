import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { decodePngToRgba } from "./png-rgba.mjs";
import {
  buildManifestPath,
  nativeLibraryEnvironment
} from "./oracle-paths.mjs";
import { run } from "./oracle-process.mjs";

export const readNativeOracleManifest = () =>
  readFile(buildManifestPath, "utf8").then(JSON.parse);

export const runNativeAnsilove = async ({
  bytes,
  extension = "ans",
  args = [],
  allowFailure = false
}) => {
  const manifest = await readNativeOracleManifest();
  const directory = await mkdtemp(resolve(tmpdir(), "react-retro-ansilove-"));
  const inputPath = resolve(directory, `fixture.${extension}`);
  const outputPath = resolve(directory, "fixture.png");

  try {
    await writeFile(inputPath, bytes);
    const result = await run(
      manifest.executable.path,
      [...args, "-o", outputPath, inputPath],
      {
        allowFailure,
        env: nativeLibraryEnvironment()
      }
    );
    const png =
      result.code === 0 ? await readFile(outputPath).catch(() => null) : null;

    return {
      ...result,
      png,
      rgba: png ? decodePngToRgba(png) : null
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
