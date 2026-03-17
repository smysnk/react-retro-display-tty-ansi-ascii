import type { RetroLcdTerminalFixture } from "../../types";

export const progressRewriteTraceFixture: RetroLcdTerminalFixture = {
  name: "progress-rewrite-trace",
  description:
    "A progress line that rewrites itself with carriage return and erase-in-line should settle into the same final output as xterm.",
  classification: "implemented",
  rows: 4,
  cols: 34,
  chunks: [
    "Downloading fixtures... 12%",
    "\rDownloading fixtures... 73%",
    "\rDownloading fixtures... 100%",
    "\r\u001b[32mDownloaded fixtures.\u001b[0m\u001b[K\r\n",
    "Ready.\r\n"
  ],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [11, 29, 101]
};
