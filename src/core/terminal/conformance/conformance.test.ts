import { describe, expect, it } from "vitest";
import { ansiOracleFixtures } from "./ansi-sequence-matrix";
import { pendingWrapLastColumnFixture } from "./fixtures/pending-wrap-last-column.fixture";
import { progressRewriteTraceFixture } from "./fixtures/real-world/progress-rewrite.trace.fixture";
import { shellSessionTraceFixture } from "./fixtures/real-world/shell-session.trace.fixture";
import { statusPaneTraceFixture } from "./fixtures/real-world/status-pane.trace.fixture";
import { formatFixtureDiffReport } from "./diff-snapshots";
import { runTerminalFixture } from "./run-fixture";

const fixtures = [
  pendingWrapLastColumnFixture,
  ...ansiOracleFixtures,
  shellSessionTraceFixture,
  progressRewriteTraceFixture,
  statusPaneTraceFixture
];

describe("terminal conformance oracle", () => {
  for (const fixture of fixtures) {
    it(`matches xterm-headless for ${fixture.name}`, async () => {
      const results = await runTerminalFixture(fixture);

      for (const result of results) {
        expect(
          result.diffs,
          `${result.fixture.name} failed in ${result.chunkLabel} mode:\n${formatFixtureDiffReport(result.diffs)}\n\n${result.reproduction}`
        ).toEqual([]);
      }
    });
  }
});
