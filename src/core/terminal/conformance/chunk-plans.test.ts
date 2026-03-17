import { describe, expect, it } from "vitest";
import {
  formatChunkReproduction,
  resolveChunkRuns,
  shrinkFailingChunks
} from "./chunk-plans";
import type { RetroLcdTerminalFixture } from "./types";

const baseFixture: RetroLcdTerminalFixture = {
  name: "chunk-plan-spec",
  description: "Chunk planning spec fixture.",
  classification: "implemented",
  rows: 2,
  cols: 4,
  chunks: ["AB", "CD"],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [7]
};

describe("conformance chunk plans", () => {
  it("resolves deterministic standard and seeded random chunk runs", () => {
    const runs = resolveChunkRuns(baseFixture);

    expect(runs.map((run) => run.chunkLabel)).toEqual([
      "fixture",
      "joined",
      "byte",
      "random(seed=7)"
    ]);
    expect(runs.at(-1)?.chunks.join("")).toBe("ABCD");
  });

  it("shrinks a failing chunk plan by merging unnecessary chunk boundaries", async () => {
    const shrunk = await shrinkFailingChunks(["A", "B", "C", "D"], async (candidateChunks) => {
      return candidateChunks.length >= 2;
    });

    expect(shrunk.length).toBe(2);
    expect(shrunk.join("")).toBe("ABCD");
  });

  it("formats a copy-pasteable reproduction fixture", () => {
    const reproduction = formatChunkReproduction(baseFixture, ["AB", "CD"]);

    expect(reproduction).toContain("chunk-plan-spec-repro");
    expect(reproduction).toContain('"AB"');
    expect(reproduction).toContain('"CD"');
  });
});
