import { Terminal } from "@xterm/headless";
import { RetroLcdScreenBuffer } from "../screen-buffer";
import {
  formatChunkReproduction,
  resolveChunkRuns,
  shrinkFailingChunks
} from "./chunk-plans";
import { normalizeRetroLcdSnapshot } from "./normalize-retro-lcd";
import { normalizeXtermSnapshot } from "./normalize-xterm";
import { diffNormalizedSnapshots } from "./diff-snapshots";
import type {
  RetroLcdFixtureRunResult,
  RetroLcdTerminalFixture
} from "./types";

const writeToXterm = async (terminal: Terminal, chunks: string[]) => {
  for (const chunk of chunks) {
    await new Promise<void>((resolve) => {
      terminal.write(chunk, () => resolve());
    });
  }
};

const runChunks = async (fixture: RetroLcdTerminalFixture, chunks: string[]) => {
  const buffer = new RetroLcdScreenBuffer({
    rows: fixture.rows,
    cols: fixture.cols,
    scrollback: fixture.scrollback
  });
  const terminal = new Terminal({
    allowProposedApi: true,
    cols: fixture.cols,
    rows: fixture.rows,
    scrollback: fixture.scrollback ?? 200
  });

  for (const chunk of chunks) {
    buffer.write(chunk);
  }

  await writeToXterm(terminal, chunks);

  const retroLcd = normalizeRetroLcdSnapshot(buffer.getSnapshot());
  const xterm = normalizeXtermSnapshot(terminal);

  return {
    retroLcd,
    xterm,
    diffs: diffNormalizedSnapshots(retroLcd, xterm)
  };
};

export const runTerminalFixture = async (
  fixture: RetroLcdTerminalFixture
): Promise<RetroLcdFixtureRunResult[]> => {
  const results: RetroLcdFixtureRunResult[] = [];

  for (const run of resolveChunkRuns(fixture)) {
    let resolvedChunks = run.chunks;
    let outcome = await runChunks(fixture, resolvedChunks);

    if (run.chunkMode === "random" && outcome.diffs.length > 0) {
      resolvedChunks = await shrinkFailingChunks(resolvedChunks, async (candidateChunks) => {
        const candidateResult = await runChunks(fixture, candidateChunks);
        return candidateResult.diffs.length > 0;
      });
      outcome = await runChunks(fixture, resolvedChunks);
    }

    results.push({
      chunkMode: run.chunkMode,
      chunkLabel: run.chunkLabel,
      randomSeed: run.randomSeed,
      resolvedChunks,
      reproduction: formatChunkReproduction(fixture, resolvedChunks),
      fixture,
      retroLcd: outcome.retroLcd,
      xterm: outcome.xterm,
      diffs: outcome.diffs
    });
  }

  return results;
};
