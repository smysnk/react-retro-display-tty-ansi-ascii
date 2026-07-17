import { resolve } from "node:path";

export const repositoryRoot = resolve(new URL("../..", import.meta.url).pathname);
export const oracleRoot = resolve(repositoryRoot, ".tmp/ansilove-native");
export const sourceRoot = resolve(oracleRoot, "source");
export const ansiloveSourceDir = resolve(sourceRoot, "ansilove");
export const libansiloveSourceDir = resolve(sourceRoot, "libansilove");
export const installDir = resolve(oracleRoot, "install");
export const buildManifestPath = resolve(oracleRoot, "oracle-build.json");
export const oracleLockPath = resolve(repositoryRoot, "scripts/ansilove/oracle-lock.json");
export const ansiloveJsVendorPath = resolve(
  repositoryRoot,
  "scripts/ansilove/vendor/ansilove.js"
);

export const nativeLibraryEnvironment = () => ({
  DYLD_LIBRARY_PATH: resolve(installDir, "lib"),
  LD_LIBRARY_PATH: resolve(installDir, "lib")
});
