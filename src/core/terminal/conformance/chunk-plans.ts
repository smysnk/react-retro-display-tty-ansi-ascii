import type { RetroLcdConformanceChunkMode, RetroLcdTerminalFixture } from "./types";

type RetroLcdResolvedChunkRun = {
  chunkMode: RetroLcdConformanceChunkMode;
  chunkLabel: string;
  randomSeed?: number;
  chunks: string[];
};

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const escapeChunk = (chunk: string) => JSON.stringify(chunk);

const splitRandomly = (text: string, seed: number) => {
  const random = createSeededRandom(seed || 1);
  const chunks: string[] = [];

  for (let index = 0; index < text.length; ) {
    const remaining = text.length - index;
    const nextLength = Math.max(1, Math.min(remaining, 1 + Math.floor(random() * 8)));
    chunks.push(text.slice(index, index + nextLength));
    index += nextLength;
  }

  return chunks.length > 0 ? chunks : [text];
};

export const formatChunkReproduction = (fixture: RetroLcdTerminalFixture, chunks: string[]) => {
  const chunkList =
    chunks.length === 0 ? "[]" : `[\n${chunks.map((chunk) => `    ${escapeChunk(chunk)}`).join(",\n")}\n  ]`;

  return [
    `const reproduction = {`,
    `  name: ${JSON.stringify(`${fixture.name}-repro`)},`,
    `  rows: ${fixture.rows},`,
    `  cols: ${fixture.cols},`,
    `  scrollback: ${fixture.scrollback ?? "undefined"},`,
    `  chunks: ${chunkList}`,
    `};`
  ].join("\n");
};

export const resolveChunkRuns = (fixture: RetroLcdTerminalFixture): RetroLcdResolvedChunkRun[] => {
  const chunkModes = fixture.chunkModes ?? ["fixture"];
  const joined = fixture.chunks.join("");
  const runs: RetroLcdResolvedChunkRun[] = chunkModes.map((chunkMode) => {
    switch (chunkMode) {
      case "joined":
        return {
          chunkMode,
          chunkLabel: "joined",
          chunks: [joined]
        };
      case "byte":
        return {
          chunkMode,
          chunkLabel: "byte",
          chunks: Array.from(joined)
        };
      default:
        return {
          chunkMode,
          chunkLabel: "fixture",
          chunks: fixture.chunks
        };
    }
  });

  for (const seed of fixture.randomChunkSeeds ?? []) {
    runs.push({
      chunkMode: "random",
      chunkLabel: `random(seed=${seed})`,
      randomSeed: seed,
      chunks: splitRandomly(joined, seed)
    });
  }

  return runs;
};

export const shrinkFailingChunks = async (
  chunks: string[],
  isStillFailing: (candidateChunks: string[]) => Promise<boolean>
) => {
  let nextChunks = [...chunks];
  let mutated = true;

  while (mutated && nextChunks.length > 1) {
    mutated = false;

    for (let index = 0; index < nextChunks.length - 1; index += 1) {
      const candidate = [...nextChunks];
      candidate.splice(index, 2, `${candidate[index]}${candidate[index + 1]}`);

      if (await isStillFailing(candidate)) {
        nextChunks = candidate;
        mutated = true;
        break;
      }
    }
  }

  return nextChunks;
};
