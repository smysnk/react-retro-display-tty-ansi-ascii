import type { RetroLcdTerminalCommand } from "./commands";

export type RetroLcdAnsiParserHandlers = {
  command: (command: RetroLcdTerminalCommand) => void;
};

type ParserState = "text" | "escape" | "csi";

const isCsiPrefixCharacter = (character: string) => /[<=>?]/u.test(character);

const isCsiParamCharacter = (character: string) => /[0-9;]/u.test(character);

const isCsiIntermediateCharacter = (character: string) =>
  character >= "\u0020" && character <= "\u002f";

const isEscIntermediateCharacter = (character: string) =>
  character >= "\u0020" && character <= "\u002f";

const isEscFinalCharacter = (character: string) =>
  character >= "\u0030" && character <= "\u007e";

const parseParams = (value: string) => {
  if (!value) {
    return [];
  }

  return value
    .split(";")
    .map((segment) => {
      const parsed = Number.parseInt(segment, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
};

const firstParam = (params: number[], fallback = 1) => {
  const value = params[0];
  return value && value > 0 ? value : fallback;
};

export class RetroLcdAnsiParser {
  private state: ParserState = "text";
  private escIntermediateBuffer = "";
  private csiPrefixBuffer = "";
  private csiParamBuffer = "";
  private csiIntermediateBuffer = "";

  constructor(private readonly handlers: RetroLcdAnsiParserHandlers) {}

  feed(data: string) {
    for (const character of data) {
      this.feedCharacter(character);
    }
  }

  reset() {
    this.state = "text";
    this.escIntermediateBuffer = "";
    this.csiPrefixBuffer = "";
    this.csiParamBuffer = "";
    this.csiIntermediateBuffer = "";
  }

  private feedCharacter(character: string) {
    switch (this.state) {
      case "text":
        this.feedTextCharacter(character);
        return;
      case "escape":
        this.feedEscapeCharacter(character);
        return;
      case "csi":
        this.feedCsiCharacter(character);
        return;
    }
  }

  private feedTextCharacter(character: string) {
    switch (character) {
      case "\u001b":
        this.state = "escape";
        this.escIntermediateBuffer = "";
        return;
      case "\n":
        this.handlers.command({ type: "lineFeed" });
        return;
      case "\r":
        this.handlers.command({ type: "carriageReturn" });
        return;
      case "\b":
        this.handlers.command({ type: "backspace" });
        return;
      case "\t":
        this.handlers.command({ type: "tab" });
        return;
      case "\f":
        this.handlers.command({ type: "formFeed" });
        return;
      case "\u0007":
        this.handlers.command({ type: "bell" });
        return;
      default:
        this.handlers.command({ type: "print", char: character });
    }
  }

  private feedEscapeCharacter(character: string) {
    if (character === "[") {
      this.state = "csi";
      this.csiPrefixBuffer = "";
      this.csiParamBuffer = "";
      this.csiIntermediateBuffer = "";
      return;
    }

    if (isEscIntermediateCharacter(character)) {
      this.escIntermediateBuffer += character;
      return;
    }

    if (isEscFinalCharacter(character)) {
      this.dispatchEscape({
        final: character,
        intermediates: this.escIntermediateBuffer || undefined
      });
      this.state = "text";
      this.escIntermediateBuffer = "";
      return;
    }

    this.state = "text";
    this.escIntermediateBuffer = "";
  }

  private feedCsiCharacter(character: string) {
    if (!this.csiPrefixBuffer && !this.csiParamBuffer && isCsiPrefixCharacter(character)) {
      this.csiPrefixBuffer = character;
      return;
    }

    if (isCsiParamCharacter(character)) {
      this.csiParamBuffer += character;
      return;
    }

    if (isCsiIntermediateCharacter(character)) {
      this.csiIntermediateBuffer += character;
      return;
    }

    this.dispatchCsi(
      {
        prefix: this.csiPrefixBuffer || undefined,
        intermediates: this.csiIntermediateBuffer || undefined,
        final: character
      },
      parseParams(this.csiParamBuffer)
    );
    this.state = "text";
    this.csiPrefixBuffer = "";
    this.csiParamBuffer = "";
    this.csiIntermediateBuffer = "";
  }

  private dispatchEscape(identifier: { final: string; intermediates?: string }) {
    switch (identifier.final) {
      case "7":
        this.handlers.command({ type: "saveCursor", source: "dec" });
        return;
      case "8":
        this.handlers.command({ type: "restoreCursor", source: "dec" });
        return;
      case "D":
        this.handlers.command({ type: "index" });
        return;
      case "E":
        this.handlers.command({ type: "nextLine" });
        return;
      case "M":
        this.handlers.command({ type: "reverseIndex" });
        return;
      case "c":
        this.handlers.command({ type: "resetToInitialState" });
        return;
      default:
        this.handlers.command({
          type: "unknownEscape",
          identifier
        });
    }
  }

  private dispatchCsi(
    identifier: {
      prefix?: string;
      intermediates?: string;
      final: string;
    },
    params: number[]
  ) {
    switch (identifier.final) {
      case "@":
        this.handlers.command({ type: "insertChars", count: firstParam(params) });
        return;
      case "A":
        this.handlers.command({ type: "cursorUp", count: firstParam(params) });
        return;
      case "B":
        this.handlers.command({ type: "cursorDown", count: firstParam(params) });
        return;
      case "C":
        this.handlers.command({ type: "cursorForward", count: firstParam(params) });
        return;
      case "D":
        this.handlers.command({ type: "cursorBackward", count: firstParam(params) });
        return;
      case "L":
        this.handlers.command({ type: "insertLines", count: firstParam(params) });
        return;
      case "M":
        this.handlers.command({ type: "deleteLines", count: firstParam(params) });
        return;
      case "P":
        this.handlers.command({ type: "deleteChars", count: firstParam(params) });
        return;
      case "S":
        this.handlers.command({ type: "scrollUp", count: firstParam(params) });
        return;
      case "T":
        this.handlers.command({ type: "scrollDown", count: firstParam(params) });
        return;
      case "H":
      case "f":
        this.handlers.command({
          type: "cursorPosition",
          row: params[0] || 1,
          col: params[1] || 1
        });
        return;
      case "r":
        this.handlers.command({
          type: "setScrollRegion",
          top: params[0] || undefined,
          bottom: params[1] || undefined
        });
        return;
      case "J":
        this.handlers.command({ type: "eraseInDisplay", mode: params[0] ?? 0 });
        return;
      case "K":
        this.handlers.command({ type: "eraseInLine", mode: params[0] ?? 0 });
        return;
      case "s":
        this.handlers.command({ type: "saveCursor", source: "ansi" });
        return;
      case "u":
        this.handlers.command({ type: "restoreCursor", source: "ansi" });
        return;
      case "m":
        this.handlers.command({ type: "setGraphicRendition", params });
        return;
      case "h":
        this.handlers.command({
          type: "setMode",
          identifier,
          params
        });
        return;
      case "l":
        this.handlers.command({
          type: "resetMode",
          identifier,
          params
        });
        return;
      default:
        this.handlers.command({
          type: "unknownCsi",
          identifier,
          params
        });
    }
  }
}
