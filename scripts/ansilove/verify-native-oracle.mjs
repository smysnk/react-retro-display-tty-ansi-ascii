import { readFile } from "node:fs/promises";

import {
  buildManifestPath,
  nativeLibraryEnvironment,
  oracleLockPath
} from "./oracle-paths.mjs";
import { run, sha256File } from "./oracle-process.mjs";

const [lock, manifest] = await Promise.all([
  readFile(oracleLockPath, "utf8").then(JSON.parse),
  readFile(buildManifestPath, "utf8").then(JSON.parse)
]);

if (manifest.source.ansiloveCli.commit !== lock.ansiloveCli.commit) {
  throw new Error("AnsiLove/C source commit does not match the oracle lock.");
}

if (manifest.source.libansilove.commit !== lock.libansilove.commit) {
  throw new Error("libansilove source commit does not match the oracle lock.");
}

const [executableHash, libraryHash] = await Promise.all([
  sha256File(manifest.executable.path),
  sha256File(manifest.library.path)
]);

if (executableHash !== manifest.executable.sha256) {
  throw new Error("AnsiLove/C executable hash changed after the controlled build.");
}

if (libraryHash !== manifest.library.sha256) {
  throw new Error("libansilove library hash changed after the controlled build.");
}

const version = await run(manifest.executable.path, ["-v"], {
  env: nativeLibraryEnvironment()
});

if (!version.stdout.includes(`AnsiLove/C ${lock.ansiloveCli.version}`)) {
  throw new Error(`Unexpected native oracle version: ${version.stdout.trim()}`);
}

console.log(
  JSON.stringify(
    {
      ansilove: lock.ansiloveCli.version,
      ansiloveCommit: lock.ansiloveCli.commit,
      libansilove: lock.libansilove.version,
      libansiloveCommit: lock.libansilove.commit,
      executableSha256: executableHash,
      librarySha256: libraryHash
    },
    null,
    2
  )
);
