import type { RetroLcdTerminalFixture } from "../../types";

export const statusPaneTraceFixture: RetroLcdTerminalFixture = {
  name: "status-pane-trace",
  description:
    "A fixed-header status pane with a scroll region, insert-line update, and truecolor footer should remain oracle-clean.",
  classification: "implemented",
  rows: 6,
  cols: 28,
  chunks: [
    "\u001b[2;6r",
    "\u001b[1;1H\u001b[44;37m SESSION conformance        \u001b[0m",
    "\u001b[2;1Horacle ready\r\nchunk fuzzer ready\r\npalette mapper ready",
    "\u001b[6;1H\u001b[L\u001b[38;2;255;180;120mrecorded regression fixture\u001b[0m"
  ],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [5, 19, 211]
};
