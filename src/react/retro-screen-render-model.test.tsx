import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RetroScreenDisplay } from "./RetroScreenDisplay";
import { buildTextRenderModel } from "./retro-screen-render-model";

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
});
