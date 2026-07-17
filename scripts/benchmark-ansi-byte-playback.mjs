import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import {
  createRetroScreenAnsiBytePlaybackEngine,
  splitRetroScreenAnsiBytes,
  stripRetroScreenAnsiSauce
} from "../dist/index.js";

const fixturePath = resolve("src/stories/assets/bad-apple.ans");
const source = stripRetroScreenAnsiSauce(new Uint8Array(await readFile(fixturePath)));
const createLoadedEngine = (baud = 14_400) => {
  const engine = createRetroScreenAnsiBytePlaybackEngine({
    rows: 25,
    cols: 80,
    storageMode: "eager",
    scrollMode: "terminal",
    wrapMode: "dos-immediate",
    baud
  });

  for (const chunk of splitRetroScreenAnsiBytes(source, 16_384)) {
    engine.appendSource(chunk);
  }

  engine.closeSource();
  return engine;
};

const runDrainBenchmark = () => {
  const before = process.memoryUsage();
  const engine = createLoadedEngine();
  const startedAt = performance.now();
  const state = engine.drain();
  const durationMs = performance.now() - startedAt;
  const after = process.memoryUsage();

  if (state.status !== "complete" || state.processedBytes !== source.length) {
    throw new Error(
      `Bad Apple drain was incomplete (${state.processedBytes}/${source.length}, ${state.status}).`
    );
  }

  const heapDeltaMiB = (after.heapUsed - before.heapUsed) / 1024 / 1024;

  if (heapDeltaMiB > 64) {
    throw new Error(`Bad Apple retained heap exceeded 64 MiB (${heapDeltaMiB.toFixed(2)} MiB).`);
  }

  return {
    durationMs: Number(durationMs.toFixed(2)),
    throughputMiBPerSecond: Number(
      (source.length / 1024 / 1024 / (durationMs / 1000)).toFixed(2)
    ),
    heapDeltaMiB: Number(heapDeltaMiB.toFixed(2)),
    rssDeltaMiB: Number(((after.rss - before.rss) / 1024 / 1024).toFixed(2)),
    processedBytes: state.processedBytes,
    status: state.status
  };
};

const runBaudBenchmark = (baud) => {
  const engine = createLoadedEngine(baud);
  const startedAt = performance.now();
  let publications = 0;
  let state = engine.getPlaybackState();

  while (state.status !== "complete") {
    state = engine.advanceTime(1000 / 60);
    publications += 1;
  }

  const cpuDurationMs = performance.now() - startedAt;
  const expectedDurationMs = (source.length * 8 * 1000) / baud;

  return {
    baud,
    cpuDurationMs: Number(cpuDurationMs.toFixed(2)),
    simulatedDurationMs: Number(state.elapsedMs.toFixed(2)),
    expectedDurationMs: Number(expectedDurationMs.toFixed(2)),
    publicationCountAt60Hz: publications,
    maxPublicationsPerDisplayFrame: 1,
    processedBytes: state.processedBytes,
    status: state.status
  };
};

const drain = runDrainBenchmark();
const baudRuns = [14_400, 115_200].map(runBaudBenchmark);

console.log(
  JSON.stringify(
    {
      fixture: fixturePath,
      sourceBytes: source.length,
      drain,
      baudRuns
    },
    null,
    2
  )
);
