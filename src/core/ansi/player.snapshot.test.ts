import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";
import { Terminal } from "@xterm/headless";

import {
  createRetroScreenAnsiFrameStream,
  createRetroScreenAnsiSnapshotStream,
  decodeRetroScreenAnsiBytes,
  materializeRetroScreenAnsiFrames,
  materializeRetroScreenAnsiSnapshots,
  stripRetroScreenAnsiSauce,
} from "./player";
import { normalizeXtermSnapshot } from "../terminal/conformance/normalize-xterm";

const ansiDir =
  typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
const solidWaste87260FixturePath = resolve(ansiDir, "fixtures/solid-waste-87260.ans.gz");

const loadSolidWaste87260Fixture = async () =>
  new Uint8Array(gunzipSync(await readFile(solidWaste87260FixturePath)));

const normalizeCellsForComparison = (cells: Array<Array<{ char: string; style: Record<string, unknown> }>>) =>
  cells.map((row) =>
    row.map((cell) => ({
      char: cell.char,
      style: {
        intensity:
          typeof cell.style.intensity === "string"
            ? cell.style.intensity
            : cell.style.bold
              ? "bold"
              : cell.style.faint
                ? "faint"
                : "normal",
        bold: Boolean(cell.style.bold),
        faint: Boolean(cell.style.faint),
        inverse: Boolean(cell.style.inverse),
        conceal: Boolean(cell.style.conceal),
        blink: Boolean(cell.style.blink),
        foreground: cell.style.foreground,
        background: cell.style.background,
      },
    })),
  );

describe("ANSI snapshot stream", () => {
  it("preserves true source rows and cols while exposing line arrays", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 3,
      cols: 6,
      metadata: {
        title: "demo",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 6,
        height: 3,
      },
    });
    const snapshot = stream.appendText("\u001b[1;1HAB\u001b[2;3HCD");

    expect(snapshot.sourceRows).toBe(3);
    expect(snapshot.sourceCols).toBe(6);
    expect(snapshot.storageMode).toBe("eager");
    expect(snapshot.currentFrame.lines).toEqual([
      "AB    ",
      "  CD  ",
      "      ",
    ]);
    expect(snapshot.currentFrame.text).toBe("AB    \n  CD  \n      ");
    expect(snapshot.metadata?.title).toBe("demo");
  });

  it("parses ANSI SGR colors into styled cells", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
      metadata: {
        title: "color",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 4,
        height: 2,
      },
    });
    const snapshot = stream.appendText("\u001b[31;44mA \u001b[93;102mB");
    const firstSlice = snapshot.currentFrame.getCellSlice(0, 0, 4);

    expect(firstSlice[0]).toMatchObject({
      char: "A",
      style: {
        foreground: {
          mode: "palette",
          value: 1,
        },
        background: {
          mode: "palette",
          value: 4,
        },
      },
    });
    expect(firstSlice[1]).toMatchObject({
      char: " ",
      style: {
        foreground: {
          mode: "palette",
          value: 1,
        },
        background: {
          mode: "palette",
          value: 4,
        },
      },
    });
    expect(firstSlice[2]).toMatchObject({
      char: "B",
      style: {
        foreground: {
          mode: "palette",
          value: 11,
        },
        background: {
          mode: "palette",
          value: 10,
        },
      },
    });
  });

  it("keeps completed frames in snapshot form and stays compatible with the string player", () => {
    const payload = "\u001b[24;1Htail\u001b[1;1Hhead";
    const snapshotFrames = materializeRetroScreenAnsiSnapshots(payload, 25, 8);
    const stringFrames = materializeRetroScreenAnsiFrames(payload, 25, 8);
    const stringStreamSnapshot = createRetroScreenAnsiFrameStream({ rows: 25, cols: 8 }).appendText(payload);

    expect(snapshotFrames).toHaveLength(2);
    expect(snapshotFrames.map((frame) => frame.text)).toEqual(stringFrames);
    expect(stringStreamSnapshot.completedFrames).toEqual([snapshotFrames[0]?.text]);
    expect(stringStreamSnapshot.currentFrame).toBe(snapshotFrames[1]?.text);
  });

  it("supports sparse snapshots for huge geometries without flattening the full buffer", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 25,
      cols: 20_480,
      storageMode: "sparse",
      metadata: {
        title: "huge",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 20_480,
        height: 25,
      },
    });
    const snapshot = stream.appendText("\u001b[1;20479HXY");

    expect(snapshot.storageMode).toBe("sparse");
    expect(snapshot.sourceCols).toBe(20_480);
    expect(snapshot.currentFrame.lines).toHaveLength(25);
    expect(snapshot.currentFrame.getLineSlice(0, 20_478, 20_480)).toBe("XY");
    expect(snapshot.currentFrame.text.length).toBeLessThanOrEqual(25 * 80 + 24);
  });

  it("freezes completed sparse frames when later cursor jumps create a new frame", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 25,
      cols: 20_480,
      storageMode: "sparse",
    });
    const snapshot = stream.appendText("\u001b[1;20479HAB\u001b[1;1HCD");

    expect(snapshot.completedFrames).toHaveLength(1);
    expect(snapshot.completedFrames[0]?.storageMode).toBe("sparse");
    expect(snapshot.completedFrames[0]?.getLineSlice(0, 20_478, 20_480)).toBe("AB");
    expect(snapshot.currentFrame.getLineSlice(0, 0, 2)).toBe("CD");
  });

  it("preserves styled spaces in sparse snapshots", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 20_480,
      storageMode: "sparse",
    });
    const snapshot = stream.appendText("\u001b[1;20479H\u001b[31;44m ");
    const coloredSpace = snapshot.currentFrame.getCellSlice(0, 20_478, 20_479)[0];

    expect(coloredSpace).toMatchObject({
      char: " ",
      style: {
        foreground: {
          mode: "palette",
          value: 1,
        },
        background: {
          mode: "palette",
          value: 4,
        },
      },
    });
  });

  it("preserves delayed-wrap semantics when carriage return clears a full-width pending wrap", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
    });
    const snapshot = stream.appendText("ABCD\rEF");

    expect(snapshot.currentFrame.lines).toEqual([
      "EFCD",
      "    ",
    ]);
  });

  it("normalizes pending wrap before CSI cursor movement commands", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
    });
    const snapshot = stream.appendText("ABCD\u001b[DZ");

    expect(snapshot.currentFrame.lines).toEqual([
      "ABZD",
      "    ",
    ]);
  });

  it("restores ANSI-saved cursor positions before later writes", async () => {
    const payload = "ABCD\u001b[s\u001b[2;1HZZZZ\u001b[uXY";
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 2,
      cols: 6,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(payload, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 6,
    }).appendText(payload);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    terminal.dispose();
  });

  it("keeps ANSI-saved cursor positions attached to scrolled content", async () => {
    const payload = "A\r\nB\r\nC\u001b[s\r\n\u001b[uX";
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 3,
      cols: 4,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(payload, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 3,
      cols: 4,
    }).appendText(payload);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    terminal.dispose();
  });

  it("treats vertical tab as a vertical line feed the same way xterm does", async () => {
    const payload = "ABCD\u001b[D\u000bXY";
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 2,
      cols: 6,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(payload, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 6,
    }).appendText(payload);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    terminal.dispose();
  });

  it("scrolls the visible viewport upward when line feed lands on the bottom row", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
    });
    const snapshot = stream.appendText("AAAA\r\nBBBB\r\nCCCC");

    expect(snapshot.currentFrame.lines).toEqual([
      "BBBB",
      "CCCC",
    ]);
  });

  it("ignores unsupported C0 control bytes the same way xterm does", async () => {
    const payloadBytes = new Uint8Array([0x15, 0x41, 0x16, 0x42, 0x1a, 0x43]);
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 1,
      cols: 6,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(decodeRetroScreenAnsiBytes(payloadBytes), () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 1,
      cols: 6,
    }).appendChunk(payloadBytes);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    expect(snapshot.currentFrame.cells?.map((row) => row.map((cell) => cell.char))).toEqual(
      referenceSnapshot.cells.map((row) => row.map((cell) => cell.char))
    );
    terminal.dispose();
  });

  it("treats tabs as cursor movement instead of painting styled spaces", async () => {
    const payload = "\u001b[5;30;47m\tX";
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 1,
      cols: 10,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(payload, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 1,
      cols: 10,
    }).appendText(payload);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    expect(normalizeCellsForComparison(snapshot.currentFrame.cells ?? [])).toEqual(
      normalizeCellsForComparison(referenceSnapshot.cells),
    );
    terminal.dispose();
  });

  it("restarts malformed CSI parsing when a fresh escape arrives", async () => {
    const payload = "\u001b[   \u001b[40m\u001b[2JS";
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 1,
      cols: 4,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(payload, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 1,
      cols: 4,
    }).appendText(payload);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    expect(normalizeCellsForComparison(snapshot.currentFrame.cells ?? [])).toEqual(
      normalizeCellsForComparison(referenceSnapshot.cells),
    );
    terminal.dispose();
  });

  it("cancels malformed CSI parsing on SUB before visible text resumes", async () => {
    const payload = "\u001b[255\u001aSAUCE";
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 1,
      cols: 8,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(payload, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 1,
      cols: 8,
    }).appendText(payload);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    expect(normalizeCellsForComparison(snapshot.currentFrame.cells ?? [])).toEqual(
      normalizeCellsForComparison(referenceSnapshot.cells),
    );
    terminal.dispose();
  });

  it("preserves explicit black erase backgrounds the same way xterm does", async () => {
    const payload = "\u001b[40m\u001b[2J";
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 2,
      cols: 4,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(payload, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
    }).appendText(payload);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    expect(snapshot.currentFrame.cells?.[0]?.[0]?.style.background).toEqual(
      referenceSnapshot.cells[0]?.[0]?.style.background
    );
    expect(snapshot.currentFrame.cells?.[1]?.[3]?.style.background).toEqual(
      referenceSnapshot.cells[1]?.[3]?.style.background
    );
    terminal.dispose();
  });

  it("preserves erase background styles on rows scrolled into view", async () => {
    const payload = "\u001b[40m\u001b[2J12\r\n34\r\n";
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 2,
      cols: 4,
      scrollback: 16,
    });

    await new Promise<void>((resolveWrite) => {
      terminal.write(payload, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
    }).appendText(payload);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    expect(snapshot.currentFrame.cells?.[0]?.[2]?.style.background).toEqual(
      referenceSnapshot.cells[0]?.[2]?.style.background
    );
    expect(snapshot.currentFrame.cells?.[1]?.[3]?.style.background).toEqual(
      referenceSnapshot.cells[1]?.[3]?.style.background
    );
    terminal.dispose();
  });

  it("matches the terminal reference for the Solid Waste 87260 artifact", async () => {
    const rawBytes = await loadSolidWaste87260Fixture();
    const payloadBytes = stripRetroScreenAnsiSauce(rawBytes);
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 25,
      cols: 80,
      scrollback: 200,
    });
    const decodedText = decodeRetroScreenAnsiBytes(payloadBytes);

    await new Promise<void>((resolveWrite) => {
      terminal.write(decodedText, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 25,
      cols: 80,
    }).appendChunk(payloadBytes);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    terminal.dispose();
  });
});
