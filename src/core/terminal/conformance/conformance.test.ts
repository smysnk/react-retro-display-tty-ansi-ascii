import { describe, expect, it } from "vitest";
import { ansi16ColorsFixture } from "./fixtures/ansi-16-colors.fixture";
import { backspaceWithoutOverwriteFixture } from "./fixtures/backspace-without-overwrite.fixture";
import { decSaveRestoreFixture } from "./fixtures/dec-save-restore.fixture";
import { decWraparoundToggleFixture } from "./fixtures/dec-wraparound-toggle.fixture";
import { deleteCharsFixture } from "./fixtures/delete-chars.fixture";
import { deleteLinesFixture } from "./fixtures/delete-lines.fixture";
import { escIndexFixture } from "./fixtures/esc-index.fixture";
import { escNextLineFixture } from "./fixtures/esc-next-line.fixture";
import { escReverseIndexFixture } from "./fixtures/esc-reverse-index.fixture";
import { indexed256ColorsFixture } from "./fixtures/indexed-256-colors.fixture";
import { insertCharsFixture } from "./fixtures/insert-chars.fixture";
import { insertLinesFixture } from "./fixtures/insert-lines.fixture";
import { insertModePrintFixture } from "./fixtures/insert-mode-print.fixture";
import { originModeHomeFixture } from "./fixtures/origin-mode-home.fixture";
import { pendingWrapLastColumnFixture } from "./fixtures/pending-wrap-last-column.fixture";
import { partialCsiCursorBackwardFixture } from "./fixtures/partial-csi-cursor-backward.fixture";
import { progressRewriteTraceFixture } from "./fixtures/real-world/progress-rewrite.trace.fixture";
import { shellSessionTraceFixture } from "./fixtures/real-world/shell-session.trace.fixture";
import { statusPaneTraceFixture } from "./fixtures/real-world/status-pane.trace.fixture";
import { scrollRegionShiftFixture } from "./fixtures/scroll-region-shift.fixture";
import { truecolorFixture } from "./fixtures/truecolor.fixture";
import { formatFixtureDiffReport } from "./diff-snapshots";
import { runTerminalFixture } from "./run-fixture";

const fixtures = [
  partialCsiCursorBackwardFixture,
  backspaceWithoutOverwriteFixture,
  pendingWrapLastColumnFixture,
  decSaveRestoreFixture,
  decWraparoundToggleFixture,
  escIndexFixture,
  escNextLineFixture,
  escReverseIndexFixture,
  insertCharsFixture,
  deleteCharsFixture,
  insertLinesFixture,
  deleteLinesFixture,
  scrollRegionShiftFixture,
  originModeHomeFixture,
  insertModePrintFixture,
  ansi16ColorsFixture,
  indexed256ColorsFixture,
  truecolorFixture,
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
