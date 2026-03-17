import type {
  RetroLcdNormalizedCell,
  RetroLcdNormalizedTerminalSnapshot
} from "./types";

const sameValue = <T>(left: T, right: T) => JSON.stringify(left) === JSON.stringify(right);

const formatCell = (cell: RetroLcdNormalizedCell) =>
  JSON.stringify({
    char: cell.char,
    width: cell.width,
    style: cell.style
  });

export const diffNormalizedSnapshots = (
  actual: RetroLcdNormalizedTerminalSnapshot,
  expected: RetroLcdNormalizedTerminalSnapshot
) => {
  const diffs: string[] = [];

  if (actual.rows !== expected.rows || actual.cols !== expected.cols) {
    diffs.push(
      `geometry mismatch: retro-lcd=${actual.rows}x${actual.cols} xterm=${expected.rows}x${expected.cols}`
    );
  }

  if (actual.cursor.row !== expected.cursor.row || actual.cursor.col !== expected.cursor.col) {
    diffs.push(
      `cursor mismatch: retro-lcd=(${actual.cursor.row},${actual.cursor.col}) xterm=(${expected.cursor.row},${expected.cursor.col})`
    );
  }

  if (
    actual.cursor.visible !== null &&
    expected.cursor.visible !== null &&
    actual.cursor.visible !== expected.cursor.visible
  ) {
    diffs.push(
      `cursor visibility mismatch: retro-lcd=${String(actual.cursor.visible)} xterm=${String(expected.cursor.visible)}`
    );
  }

  if (!sameValue(actual.scrollback, expected.scrollback)) {
    diffs.push(
      `scrollback mismatch: retro-lcd=${JSON.stringify(actual.scrollback)} xterm=${JSON.stringify(expected.scrollback)}`
    );
  }

  if (actual.pendingWrap !== null && expected.pendingWrap !== null && actual.pendingWrap !== expected.pendingWrap) {
    diffs.push(
      `pending wrap mismatch: retro-lcd=${String(actual.pendingWrap)} xterm=${String(expected.pendingWrap)}`
    );
  }

  if (!sameValue(actual.modes, expected.modes)) {
    diffs.push(
      `mode mismatch: retro-lcd=${JSON.stringify(actual.modes)} xterm=${JSON.stringify(expected.modes)}`
    );
  }

  for (let rowIndex = 0; rowIndex < Math.max(actual.rawLines.length, expected.rawLines.length); rowIndex += 1) {
    const actualLine = actual.rawLines[rowIndex] ?? "";
    const expectedLine = expected.rawLines[rowIndex] ?? "";

    if (actualLine !== expectedLine) {
      diffs.push(
        `line ${rowIndex} mismatch: retro-lcd=${JSON.stringify(actualLine)} xterm=${JSON.stringify(expectedLine)}`
      );
    }

    const actualCells = actual.cells[rowIndex] ?? [];
    const expectedCells = expected.cells[rowIndex] ?? [];

    for (let colIndex = 0; colIndex < Math.max(actualCells.length, expectedCells.length); colIndex += 1) {
      const actualCell = actualCells[colIndex];
      const expectedCell = expectedCells[colIndex];

      if (!actualCell || !expectedCell) {
        diffs.push(
          `cell ${rowIndex},${colIndex} missing: retro-lcd=${formatCell(actualCell ?? expectedCells[colIndex])} xterm=${formatCell(expectedCell ?? actualCells[colIndex])}`
        );
        continue;
      }

      if (!sameValue(actualCell, expectedCell)) {
        diffs.push(
          `cell ${rowIndex},${colIndex} mismatch: retro-lcd=${formatCell(actualCell)} xterm=${formatCell(expectedCell)}`
        );
      }
    }
  }

  return diffs;
};

export const formatFixtureDiffReport = (
  diffs: string[],
  limit = 20
) => diffs.slice(0, limit).join("\n");
