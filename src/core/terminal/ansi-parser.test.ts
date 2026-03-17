import { describe, expect, it, vi } from "vitest";
import { RetroLcdAnsiParser } from "./ansi-parser";

const createHandlers = () => ({
  command: vi.fn()
});

describe("RetroLcdAnsiParser", () => {
  it("routes essential control characters", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\n\r\b\t\f\u0007");

    expect(handlers.command.mock.calls.map(([command]) => command.type)).toEqual([
      "lineFeed",
      "carriageReturn",
      "backspace",
      "tab",
      "formFeed",
      "bell"
    ]);
  });

  it("dispatches cursor movement CSI sequences", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b[3A\u001b[4B\u001b[5C\u001b[6D\u001b[7;8H");

    expect(handlers.command.mock.calls.map(([command]) => command)).toEqual([
      { type: "cursorUp", count: 3 },
      { type: "cursorDown", count: 4 },
      { type: "cursorForward", count: 5 },
      { type: "cursorBackward", count: 6 },
      { type: "cursorPosition", row: 7, col: 8 }
    ]);
  });

  it("dispatches erase, save/restore, and sgr sequences", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b[2J\u001b[1K\u001b[s\u001b[u\u001b[1;7;8m");

    expect(handlers.command.mock.calls.map(([command]) => command)).toEqual([
      { type: "eraseInDisplay", mode: 2 },
      { type: "eraseInLine", mode: 1 },
      { type: "saveCursor", source: "ansi" },
      { type: "restoreCursor", source: "ansi" },
      { type: "setGraphicRendition", params: [1, 7, 8] }
    ]);
  });

  it("dispatches phase 3 mutation and scrolling CSI sequences", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b[@\u001b[P\u001b[L\u001b[M\u001b[S\u001b[T\u001b[2;4r");

    expect(handlers.command.mock.calls.map(([command]) => command)).toEqual([
      { type: "insertChars", count: 1 },
      { type: "deleteChars", count: 1 },
      { type: "insertLines", count: 1 },
      { type: "deleteLines", count: 1 },
      { type: "scrollUp", count: 1 },
      { type: "scrollDown", count: 1 },
      { type: "setScrollRegion", top: 2, bottom: 4 }
    ]);
  });

  it("keeps partial escape sequences across multiple writes", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b[");
    parser.feed("2J");

    expect(handlers.command).toHaveBeenCalledWith({ type: "eraseInDisplay", mode: 2 });
  });

  it("preserves DEC private CSI prefixes for later mode handling", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b[?7l");

    expect(handlers.command).toHaveBeenCalledWith({
      type: "resetMode",
      identifier: {
        prefix: "?",
        final: "l",
        intermediates: undefined
      },
      params: [7]
    });
  });

  it("dispatches ESC final-byte commands outside CSI", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b7\u001b8\u001bD\u001bE\u001bM\u001bc");

    expect(handlers.command.mock.calls.map(([command]) => command.type)).toEqual([
      "saveCursor",
      "restoreCursor",
      "index",
      "nextLine",
      "reverseIndex",
      "resetToInitialState"
    ]);
  });
});
