import { Terminal } from "@xterm/headless";
import { describe, expect, it } from "vitest";
import { createRetroLcdController } from "../controller";
import { diffNormalizedSnapshots, formatFixtureDiffReport } from "./diff-snapshots";
import { normalizeRetroLcdSnapshot } from "./normalize-retro-lcd";
import { normalizeXtermSnapshot } from "./normalize-xterm";

const writeToXterm = async (terminal: Terminal, writes: string[]) => {
  for (const chunk of writes) {
    await new Promise<void>((resolve) => {
      terminal.write(chunk, () => resolve());
    });
  }
};

describe("terminal resize replay oracle", () => {
  it("matches xterm replay for a wrapped colored shell trace after resize", async () => {
    const writes = [
      "\u001b[1;32moperator@retro\u001b[0m \u001b[34m~/play/react-retro-display\u001b[0m\r\n",
      "$ yarn test:conformance\r\n",
      "\u001b[38;5;45mPASS\u001b[0m replay parity\r\n"
    ];
    const controller = createRetroLcdController({ rows: 4, cols: 40 });

    for (const write of writes) {
      controller.write(write);
    }
    controller.resize(6, 28);

    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 6,
      cols: 28
    });
    await writeToXterm(terminal, writes);

    const diffs = diffNormalizedSnapshots(
      normalizeRetroLcdSnapshot(controller.getSnapshot()),
      normalizeXtermSnapshot(terminal)
    );

    expect(diffs, formatFixtureDiffReport(diffs)).toEqual([]);
  });

  it("matches xterm replay for scroll-region traces after resize", async () => {
    const writes = [
      "\u001b[2;6r",
      "\u001b[1;1H\u001b[44;37m SESSION conformance        \u001b[0m",
      "\u001b[2;1Horacle ready\r\nchunk fuzzer ready\r\npalette mapper ready",
      "\u001b[6;1H\u001b[L\u001b[38;2;255;180;120mrecorded regression fixture\u001b[0m"
    ];
    const controller = createRetroLcdController({ rows: 8, cols: 40 });

    for (const write of writes) {
      controller.write(write);
    }
    controller.resize(6, 28);

    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 6,
      cols: 28
    });
    await writeToXterm(terminal, writes);

    const diffs = diffNormalizedSnapshots(
      normalizeRetroLcdSnapshot(controller.getSnapshot()),
      normalizeXtermSnapshot(terminal)
    );

    expect(diffs, formatFixtureDiffReport(diffs)).toEqual([]);
  });
});
