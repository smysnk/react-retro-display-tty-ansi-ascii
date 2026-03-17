import type { RetroLcdTerminalFixture } from "../../types";

export const shellSessionTraceFixture: RetroLcdTerminalFixture = {
  name: "shell-session-trace",
  description:
    "A shell-style trace with prompt colors, wrapped path output, and a colored PASS line should match xterm end state.",
  classification: "implemented",
  rows: 6,
  cols: 32,
  chunks: [
    "\u001b[1;32moperator@retro\u001b[0m \u001b[34m~/play/react-retro-display\u001b[0m\r\n",
    "$ yarn test:conformance\r\n",
    "\u001b[2mcollecting oracle fixtures...\u001b[0m\r\n",
    "\u001b[38;5;45mPASS\u001b[0m random chunk parity\r\n"
  ],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [7, 73, 737]
};
