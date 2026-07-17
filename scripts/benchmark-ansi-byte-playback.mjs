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
const before = process.memoryUsage();
const engine = createRetroScreenAnsiBytePlaybackEngine({
  rows: 25,
  cols: 80,
  storageMode: "eager",
  scrollMode: "terminal",
  wrapMode: "dos-immediate"
});

for (const chunk of splitRetroScreenAnsiBytes(source, 16_384)) {
  engine.appendSource(chunk);
}

engine.closeSource();
const startedAt = performance.now();
const state = engine.drain();
const durationMs = performance.now() - startedAt;
const after = process.memoryUsage();

if (state.status !== "complete" || state.processedBytes !== source.length) {
  throw new Error(
    `Bad Apple drain was incomplete (${state.processedBytes}/${source.length}, ${state.status}).`
  );
}

console.log(
  JSON.stringify(
    {
      fixture: fixturePath,
      sourceBytes: source.length,
      durationMs: Number(durationMs.toFixed(2)),
      throughputMiBPerSecond: Number(
        (source.length / 1024 / 1024 / (durationMs / 1000)).toFixed(2)
      ),
      heapDeltaMiB: Number(((after.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(2)),
      rssDeltaMiB: Number(((after.rss - before.rss) / 1024 / 1024).toFixed(2)),
      processedBytes: state.processedBytes,
      status: state.status
    },
    null,
    2
  )
);
