import { describe, expect, it } from "vitest";
import { RetroLcdScreenBuffer } from "./screen-buffer";

describe("RetroLcdScreenBuffer", () => {
  it("writes printable text and wraps to the next line", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4 });

    buffer.write("ABCDE");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABCD", "E"],
      cursor: {
        row: 1,
        col: 1
      }
    });
  });

  it("supports line feed without resetting the current column", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("AB\nZ");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["AB", "  Z", ""],
      cursor: {
        row: 1,
        col: 3
      }
    });
  });

  it("supports carriage return by returning to column zero", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("AB\rZ");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ZB", ""],
      cursor: {
        row: 0,
        col: 1
      }
    });
  });

  it("supports non-destructive backspace behavior", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("AB\b");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["AB", ""],
      cursor: {
        row: 0,
        col: 1
      },
      pendingWrap: false
    });
  });

  it("enters pending wrap after writing the final column", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4 });

    buffer.write("ABCD");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABCD", ""],
      cursor: {
        row: 0,
        col: 4
      },
      pendingWrap: true,
      modes: {
        wraparoundMode: true
      }
    });
  });

  it("wraps only when the next printable character arrives", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4 });

    buffer.write("ABCDE");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABCD", "E"],
      cursor: {
        row: 1,
        col: 1
      },
      pendingWrap: false
    });
  });

  it("expands tabs to the next tab stop", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 8, tabWidth: 4 });

    buffer.write("A\tB");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["A   B", ""],
      cursor: {
        row: 0,
        col: 5
      }
    });
  });

  it("scrolls upward when new content exceeds the visible rows", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4, scrollback: 4 });

    buffer.writeln("ONE");
    buffer.writeln("TWO");
    buffer.write("THREE");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["THRE", "E"],
      scrollback: ["ONE", "TWO"],
      cursor: {
        row: 1,
        col: 1
      }
    });
  });

  it("supports explicit cursor movement and cursor state updates", () => {
    const buffer = new RetroLcdScreenBuffer({
      rows: 2,
      cols: 5,
      cursorMode: "hollow"
    });

    buffer.moveCursorTo(1, 3);
    buffer.setCursorVisible(false);
    buffer.setCursorMode("solid");

    expect(buffer.getSnapshot().cursor).toEqual({
      row: 1,
      col: 3,
      visible: false,
      mode: "solid"
    });
  });

  it("supports CSI cursor movement and cursor positioning", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("ABCDEF");
    buffer.write("\u001b[1D");
    buffer.write("Z");
    buffer.write("\u001b[2;2H");
    buffer.write("Q");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABCDZF", " Q", ""],
      cursor: {
        row: 1,
        col: 2
      }
    });
  });

  it("supports insert and delete character operations", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 7 });

    buffer.write("ABCDE");
    buffer.write("\u001b[3D");
    buffer.write("\u001b[@Z");
    buffer.write("\u001b[P");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABZDE", ""],
      cursor: {
        row: 0,
        col: 3
      }
    });
  });

  it("supports insert mode printing", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("ABCD");
    buffer.write("\u001b[3D");
    buffer.write("\u001b[4h");
    buffer.write("Z");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["AZBCD", ""],
      modes: {
        insertMode: true
      }
    });
  });

  it("supports insert and delete line operations within the scroll region", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 5, cols: 6 });

    buffer.write("1\n2\n3\n4");
    buffer.write("\u001b[2;4r");
    buffer.write("\u001b[3;1H");
    buffer.write("\u001b[L");

    expect(buffer.getSnapshot()).toMatchObject({
      rawLines: ["1     ", " 2    ", "      ", "  3   ", "      "],
      cursor: {
        row: 2,
        col: 0
      }
    });

    buffer.write("\u001b[M");

    expect(buffer.getSnapshot()).toMatchObject({
      rawLines: ["1     ", " 2    ", "  3   ", "      ", "      "]
    });
  });

  it("supports scroll up and down within the active scroll region", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 5, cols: 6 });

    buffer.write("1\n2\n3\n4");
    buffer.write("\u001b[2;4r");
    buffer.write("\u001b[2;1H");
    buffer.write("\u001b[S");

    expect(buffer.getSnapshot()).toMatchObject({
      rawLines: ["1     ", "  3   ", "   4  ", "      ", "      "]
    });

    buffer.write("\u001b[T");

    expect(buffer.getSnapshot()).toMatchObject({
      rawLines: ["1     ", "      ", "  3   ", "   4  ", "      "]
    });
  });

  it("uses the scroll region as the home origin when DEC origin mode is enabled", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 5, cols: 6 });

    buffer.write("\u001b[2;4r");
    buffer.write("\u001b[?6h");
    buffer.write("X");

    expect(buffer.getSnapshot()).toMatchObject({
      rawLines: ["      ", "X     ", "      ", "      ", "      "],
      modes: {
        originMode: true
      },
      cursor: {
        row: 1,
        col: 1
      }
    });
  });

  it("supports erase line and erase display commands", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("HELLO");
    buffer.write("\u001b[1D");
    buffer.write("\u001b[K");
    buffer.write("\u001b[2;1H");
    buffer.write("WORLD");
    buffer.write("\u001b[1J");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["", "", ""]
    });
  });

  it("supports save and restore cursor", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("AB");
    buffer.write("\u001b[s");
    buffer.write("\u001b[3;3H");
    buffer.write("Z");
    buffer.write("\u001b[u");
    buffer.write("C");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABC", "", "  Z"]
    });
  });

  it("supports DEC save and restore cursor outside CSI", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("AB");
    buffer.write("\u001b7");
    buffer.write("\u001b[3;3H");
    buffer.write("Z");
    buffer.write("\u001b8");
    buffer.write("C");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABC", "", "  Z"]
    });
  });

  it("supports ESC D, ESC E, ESC M, and ESC c", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 4 });

    buffer.write("AB");
    buffer.write("\u001bE");
    buffer.write("Z");
    buffer.write("\u001bM");
    buffer.write("Y");
    buffer.write("\u001bD");
    buffer.write("X");
    buffer.write("\u001bc");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["", "", ""],
      cursor: {
        row: 0,
        col: 0,
        visible: true,
        mode: "solid"
      },
      pendingWrap: false,
      modes: {
        wraparoundMode: true
      }
    });
  });

  it("tracks basic monochrome sgr styles per cell", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("\u001b[1mA");
    buffer.write("\u001b[2mB");
    buffer.write("\u001b[7mC");
    buffer.write("\u001b[8mD");
    buffer.write("\u001b[0mE");

    const snapshot = buffer.getSnapshot();
    expect(snapshot.cells[0][0].style).toMatchObject({
      intensity: "bold",
      inverse: false,
      conceal: false
    });
    expect(snapshot.cells[0][1].style).toMatchObject({
      intensity: "faint"
    });
    expect(snapshot.cells[0][2].style).toMatchObject({
      inverse: true
    });
    expect(snapshot.cells[0][3].style).toMatchObject({
      conceal: true
    });
    expect(snapshot.cells[0][4].style).toMatchObject({
      intensity: "normal",
      inverse: false,
      conceal: false
    });
  });

  it("tracks ANSI 16 foreground and background colors semantically", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 8 });

    buffer.write("\u001b[31;44mA\u001b[39;49mB\u001b[91;102mC");

    const snapshot = buffer.getSnapshot();
    expect(snapshot.cells[0][0].style).toMatchObject({
      foreground: {
        mode: "palette",
        value: 1
      },
      background: {
        mode: "palette",
        value: 4
      }
    });
    expect(snapshot.cells[0][1].style).toMatchObject({
      foreground: {
        mode: "default",
        value: 0
      },
      background: {
        mode: "default",
        value: 0
      }
    });
    expect(snapshot.cells[0][2].style).toMatchObject({
      foreground: {
        mode: "palette",
        value: 9
      },
      background: {
        mode: "palette",
        value: 10
      }
    });
  });

  it("tracks indexed 256-color and truecolor semantics", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 8 });

    buffer.write("\u001b[38;5;196;48;5;25mA");
    buffer.write("\u001b[38;2;17;34;51;48;2;68;85;102mB");

    const snapshot = buffer.getSnapshot();
    expect(snapshot.cells[0][0].style).toMatchObject({
      foreground: {
        mode: "palette",
        value: 196
      },
      background: {
        mode: "palette",
        value: 25
      }
    });
    expect(snapshot.cells[0][1].style).toMatchObject({
      foreground: {
        mode: "rgb",
        value: (17 << 16) | (34 << 8) | 51
      },
      background: {
        mode: "rgb",
        value: (68 << 16) | (85 << 8) | 102
      }
    });
  });

  it("preserves partial escape sequences across writes", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("AB");
    buffer.write("\u001b[");
    buffer.write("2D");
    buffer.write("Z");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ZB", ""]
    });
  });

  it("supports DEC private wraparound mode toggles", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4 });

    buffer.write("\u001b[?7l");
    buffer.write("ABCDE");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABCE", ""],
      cursor: {
        row: 0,
        col: 4
      },
      pendingWrap: false,
      modes: {
        wraparoundMode: false
      }
    });
  });

  it("clears and resets independently", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4, cursorMode: "hollow" });

    buffer.write("ABCD");
    buffer.clear();

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["", ""],
      cursor: {
        row: 0,
        col: 0,
        mode: "hollow",
        visible: true
      }
    });

    buffer.write("ZZ");
    buffer.reset();

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["", ""],
      scrollback: [],
      cursor: {
        row: 0,
        col: 0,
        mode: "solid",
        visible: true
      }
    });
  });
});
