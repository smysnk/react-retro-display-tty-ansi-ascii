import { describe, expect, it } from "vitest";
import { measureGrid, measureStaticGrid } from "./measure-grid";

describe("measureGrid", () => {
  it("derives rows and columns using floor division", () => {
    expect(
      measureGrid({
        innerWidth: 103,
        innerHeight: 49,
        cellWidth: 10,
        cellHeight: 12
      })
    ).toMatchObject({
      cols: 10,
      rows: 4
    });
  });

  it("never returns less than one row or column", () => {
    expect(
      measureGrid({
        innerWidth: 0,
        innerHeight: 0,
        cellWidth: 12,
        cellHeight: 16
      })
    ).toMatchObject({
      cols: 1,
      rows: 1
    });
  });

  it("supports a static grid that derives cell metrics from requested rows and columns", () => {
    expect(
      measureStaticGrid({
        innerWidth: 400,
        innerHeight: 200,
        rows: 5,
        cols: 20,
        fontWidthRatio: 0.5,
        fontHeightRatio: 1
      })
    ).toMatchObject({
      rows: 5,
      cols: 20,
      cellWidth: 20,
      cellHeight: 40,
      fontSize: 40
    });
  });

  it("snaps static grid cell metrics down to whole pixels", () => {
    expect(
      measureStaticGrid({
        innerWidth: 443,
        innerHeight: 117,
        rows: 5,
        cols: 24,
        fontWidthRatio: 0.5,
        fontHeightRatio: 1
      })
    ).toMatchObject({
      rows: 5,
      cols: 24,
      cellWidth: 11,
      cellHeight: 23,
      fontSize: 23
    });
  });

  it("can maximize horizontal space in width-fit mode", () => {
    expect(
      measureStaticGrid({
        innerWidth: 443,
        innerHeight: 117,
        rows: 5,
        cols: 24,
        fontWidthRatio: 0.5,
        fontHeightRatio: 1,
        fitStrategy: "width"
      })
    ).toMatchObject({
      rows: 5,
      cols: 24,
      cellWidth: 18,
      cellHeight: 36,
      fontSize: 36
    });
  });
});
