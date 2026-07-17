import { mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ansiloveSourceDir,
  buildManifestPath,
  installDir,
  libansiloveSourceDir,
  nativeLibraryEnvironment,
  oracleLockPath,
  oracleRoot,
  sourceRoot
} from "./oracle-paths.mjs";
import { run, sha256File } from "./oracle-process.mjs";

const lock = JSON.parse(await readFile(oracleLockPath, "utf8"));
const clean = process.argv.includes("--clean");

const checkout = async (entry, directory) => {
  await rm(directory, { recursive: true, force: true });
  await run("git", ["clone", "--filter=blob:none", "--no-checkout", entry.repository, directory]);
  await run("git", ["checkout", "--detach", entry.commit], { cwd: directory });
  const revision = (await run("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();

  if (revision !== entry.commit) {
    throw new Error(`Expected ${entry.commit} for ${entry.repository}, received ${revision}.`);
  }
};

if (clean) {
  await rm(oracleRoot, { recursive: true, force: true });
}

await mkdir(sourceRoot, { recursive: true });
const existingManifest = await readFile(buildManifestPath, "utf8")
  .then(JSON.parse)
  .catch(() => null);
const sourceLockChanged =
  existingManifest?.source?.ansiloveCli?.commit !== lock.ansiloveCli.commit ||
  existingManifest?.source?.libansilove?.commit !== lock.libansilove.commit;

if (!existingManifest || sourceLockChanged) {
  await checkout(lock.libansilove, libansiloveSourceDir);
  await checkout(lock.ansiloveCli, ansiloveSourceDir);
  await rm(installDir, { recursive: true, force: true });

  const libBuildDir = resolve(oracleRoot, "build-libansilove");
  const cliBuildDir = resolve(oracleRoot, "build-ansilove");
  await rm(libBuildDir, { recursive: true, force: true });
  await rm(cliBuildDir, { recursive: true, force: true });

  await run("cmake", [
    "-S",
    libansiloveSourceDir,
    "-B",
    libBuildDir,
    "-DCMAKE_BUILD_TYPE=Release",
    `-DCMAKE_INSTALL_PREFIX=${installDir}`,
    "-DCMAKE_INSTALL_LIBDIR=lib"
  ]);
  await run("cmake", ["--build", libBuildDir, "--parallel"]);
  await run("cmake", ["--install", libBuildDir]);

  const libraryFiles = (await readdir(resolve(installDir, "lib")))
    .filter((name) => /^libansilove\.(dylib|so)(\.|$)/.test(name))
    .sort();
  const libraryFile = libraryFiles[0];

  if (!libraryFile) {
    throw new Error("The controlled libansilove build did not produce a shared library.");
  }

  await run("cmake", [
    "-S",
    ansiloveSourceDir,
    "-B",
    cliBuildDir,
    "-DCMAKE_BUILD_TYPE=Release",
    `-DCMAKE_INSTALL_PREFIX=${installDir}`,
    `-DANSILOVE_INCLUDE_DIRS=${resolve(installDir, "include")}`,
    `-DANSILOVE_LIBRARIES=${resolve(installDir, "lib", libraryFile)}`
  ]);
  await run("cmake", ["--build", cliBuildDir, "--parallel"]);
  await run("cmake", ["--install", cliBuildDir]);

  const executablePath = resolve(installDir, "bin/ansilove");
  const libraryPath = resolve(installDir, "lib", libraryFile);
  const version = await run(executablePath, ["-v"], {
    env: nativeLibraryEnvironment()
  });
  const manifest = {
    schemaVersion: 1,
    source: {
      ansiloveCli: lock.ansiloveCli,
      libansilove: lock.libansilove
    },
    executable: {
      path: executablePath,
      sha256: await sha256File(executablePath),
      versionOutput: version.stdout.trim()
    },
    library: {
      path: libraryPath,
      sha256: await sha256File(libraryPath),
      version: lock.libansilove.version
    }
  };

  await writeFile(buildManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(buildManifestPath);
