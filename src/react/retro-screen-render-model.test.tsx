import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RetroScreenAnsiFrameSnapshot } from "../core/ansi/snapshot-contract";
import { RetroScreenDisplay } from "./RetroScreenDisplay";
import { ansiSnapshotToRenderModelWindow, buildTextRenderModel } from "./retro-screen-render-model";

const geometry = {
  rows: 3,
  cols: 4,
  cellWidth: 12,
  cellHeight: 24,
  innerWidth: 48,
  innerHeight: 72,
  fontSize: 24
} as const;

describe("retro screen render model", () => {
  it("retains source offsets and selection flags across wrapped text rows", () => {
    const model = buildTextRenderModel({
      text: "ABCDEFG",
      geometry,
      cursorMode: "solid",
      selection: {
        start: 2,
        end: 6
      },
      includeSourceOffsets: true
    });

    expect(model.lines).toEqual(["ABCD", "EFG", ""]);
    expect(model.cells?.map((line) => line.map((cell) => cell.sourceOffset))).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6],
      []
    ]);
    expect(model.cells?.map((line) => line.map((cell) => cell.isSelected))).toEqual([
      [false, false, true, true],
      [true, true, false],
      []
    ]);
  });

  it("renders selected wrapped cells with a selection class and source offsets", () => {
    const model = buildTextRenderModel({
      text: "ABCDEFG",
      geometry,
      cursorMode: "solid",
      selection: {
        start: 2,
        end: 6
      },
      includeSourceOffsets: true
    });

    const { container } = render(
      <RetroScreenDisplay
        mode="value"
        renderModel={model}
        displayColorMode="phosphor-green"
        displaySurfaceMode="dark"
        screenRef={createRef()}
        probeRef={createRef()}
        onViewportClick={() => {}}
      />
    );

    const selectedCells = Array.from(container.querySelectorAll(".retro-screen__cell--selected"));

    expect(selectedCells).toHaveLength(4);
    expect(selectedCells.map((cell) => cell.getAttribute("data-source-offset"))).toEqual([
      "2",
      "3",
      "4",
      "5"
    ]);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("G")).toBeInTheDocument();
  });

  it("slices ANSI snapshots by row and column into a fixed viewport window", () => {
    const snapshot: RetroScreenAnsiFrameSnapshot = {
      sourceRows: 4,
      sourceCols: 8,
      frameIndex: 0,
      frameCount: 1,
      isComplete: true,
      isStreaming: false,
      lines: [
        "ABCDEFGH",
        "IJKLMNOP",
        "QRSTUVWX",
        "YZ012345"
      ]
    };

    const model = ansiSnapshotToRenderModelWindow(snapshot, {
      rowOffset: 1,
      colOffset: 2,
      rows: 2,
      cols: 4
    });

    expect(model.lines).toEqual([
      "KLMN",
      "STUV"
    ]);
    expect(model.cursor).toBeNull();
  });

  it("pads ANSI viewport windows when the source buffer is smaller than the fixed screen", () => {
    const snapshot: RetroScreenAnsiFrameSnapshot = {
      sourceRows: 2,
      sourceCols: 3,
      frameIndex: 0,
      frameCount: 1,
      isComplete: true,
      isStreaming: false,
      lines: [
        "ABC",
        "DEF"
      ]
    };

    const model = ansiSnapshotToRenderModelWindow(snapshot, {
      rowOffset: 9,
      colOffset: 9,
      rows: 4,
      cols: 5
    });

    expect(model.lines).toEqual([
      "ABC  ",
      "DEF  ",
      "     ",
      "     "
    ]);
  });

  it("clamps ANSI viewport windows to the bottom-right edge of the source buffer", () => {
    const snapshot: RetroScreenAnsiFrameSnapshot = {
      sourceRows: 4,
      sourceCols: 8,
      frameIndex: 0,
      frameCount: 1,
      isComplete: true,
      isStreaming: false,
      lines: [
        "ABCDEFGH",
        "IJKLMNOP",
        "QRSTUVWX",
        "YZ012345"
      ]
    };

    const model = ansiSnapshotToRenderModelWindow(snapshot, {
      rowOffset: 999,
      colOffset: 999,
      rows: 2,
      cols: 4
    });

    expect(model.lines).toEqual([
      "UVWX",
      "2345"
    ]);
  });

  it("preserves styled ANSI cells when slicing a viewport window", () => {
    const snapshot: RetroScreenAnsiFrameSnapshot = {
      sourceRows: 2,
      sourceCols: 4,
      frameIndex: 0,
      frameCount: 1,
      isComplete: true,
      isStreaming: false,
      lines: [
        "ABCD",
        "EFGH"
      ],
      cells: [
        [
          {
            char: "A",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "default", value: 0 },
              background: { mode: "default", value: 0 }
            }
          },
          {
            char: "B",
            style: {
              intensity: "bold",
              bold: true,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "palette", value: 14 },
              background: { mode: "palette", value: 1 }
            }
          },
          {
            char: "C",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "default", value: 0 },
              background: { mode: "default", value: 0 }
            }
          },
          {
            char: "D",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "default", value: 0 },
              background: { mode: "default", value: 0 }
            }
          }
        ],
        [
          {
            char: "E",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "default", value: 0 },
              background: { mode: "default", value: 0 }
            }
          },
          {
            char: "F",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "default", value: 0 },
              background: { mode: "default", value: 0 }
            }
          },
          {
            char: "G",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "default", value: 0 },
              background: { mode: "default", value: 0 }
            }
          },
          {
            char: "H",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "default", value: 0 },
              background: { mode: "default", value: 0 }
            }
          }
        ]
      ]
    };

    const model = ansiSnapshotToRenderModelWindow(snapshot, {
      rowOffset: 0,
      colOffset: 1,
      rows: 2,
      cols: 3
    });

    expect(model.lines).toEqual([
      "BCD",
      "FGH"
    ]);
    expect(model.cells?.[0]?.[0]?.char).toBe("B");
    expect(model.cells?.[0]?.[0]?.style.foreground).toEqual({
      mode: "palette",
      value: 14
    });
    expect(model.cells?.[0]?.[0]?.style.background).toEqual({
      mode: "palette",
      value: 1
    });
  });

  it("can slice sparse ANSI snapshots for malformed huge-width geometries", () => {
    const snapshot: RetroScreenAnsiFrameSnapshot = {
      sourceRows: 25,
      sourceCols: 20_480,
      frameIndex: 0,
      frameCount: 1,
      isComplete: true,
      isStreaming: false,
      storageMode: "sparse",
      lines: [],
      getCellSlice(rowIndex, startCol, endCol) {
        const length = endCol - startCol;

        if (rowIndex !== 0) {
          return Array.from({ length }, () => ({
            char: " ",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "default", value: 0 },
              background: { mode: "default", value: 0 }
            }
          }));
        }

        const slice = Array.from({ length }, () => ({
          char: " ",
          style: {
            intensity: "normal",
            bold: false,
            faint: false,
            inverse: false,
            conceal: false,
            blink: false,
            foreground: { mode: "default", value: 0 },
            background: { mode: "default", value: 0 }
          }
        }));

        if (startCol <= 20_478 && endCol >= 20_480) {
          slice[20_478 - startCol] = {
            char: "X",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "palette", value: 14 },
              background: { mode: "palette", value: 1 }
            }
          };
          slice[20_479 - startCol] = {
            char: "Y",
            style: {
              intensity: "normal",
              bold: false,
              faint: false,
              inverse: false,
              conceal: false,
              blink: false,
              foreground: { mode: "palette", value: 10 },
              background: { mode: "palette", value: 4 }
            }
          };
        }

        return slice;
      },
      getLineSlice(rowIndex, startCol, endCol) {
        if (rowIndex !== 0) {
          return " ".repeat(endCol - startCol);
        }

        if (startCol <= 20_478 && endCol >= 20_480) {
          const slice = Array.from({ length: endCol - startCol }, () => " ");
          slice[20_478 - startCol] = "X";
          slice[20_479 - startCol] = "Y";
          return slice.join("");
        }

        return " ".repeat(endCol - startCol);
      }
    };

    const model = ansiSnapshotToRenderModelWindow(snapshot, {
      rowOffset: 0,
      colOffset: 20_400,
      rows: 2,
      cols: 80
    });

    expect(model.lines[0]).toHaveLength(80);
    expect(model.lines[0]?.slice(78, 80)).toBe("XY");
    expect(model.lines[1]).toBe(" ".repeat(80));
    expect(model.cells?.[0]?.[78]?.style.foreground).toEqual({
      mode: "palette",
      value: 14
    });
    expect(model.cells?.[0]?.[79]?.style.background).toEqual({
      mode: "palette",
      value: 4
    });
  });
});
