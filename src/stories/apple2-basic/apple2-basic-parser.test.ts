import { describe, expect, it } from "vitest";
import {
  APPLE2_BASIC_MAX_LINE_NUMBER,
  normalizeApple2BasicInput,
  parseApple2BasicInput,
  parseApple2BasicStatement
} from "./apple2-basic-parser";

describe("normalizeApple2BasicInput", () => {
  it("trims, normalizes tabs, and uppercases shell input", () => {
    expect(normalizeApple2BasicInput('\t 10 print\t"hello"  ')).toBe('10 PRINT "HELLO"');
  });
});

describe("parseApple2BasicInput", () => {
  it("classifies empty input", () => {
    expect(parseApple2BasicInput("   ")).toEqual({
      type: "empty",
      normalizedInput: ""
    });
  });

  it("parses immediate commands", () => {
    expect(parseApple2BasicInput("list")).toEqual({
      type: "command",
      normalizedInput: "LIST",
      command: "LIST"
    });
  });

  it("parses program lines and preserves deletion semantics", () => {
    expect(parseApple2BasicInput('10 print "hello"')).toEqual({
      type: "program-line",
      normalizedInput: '10 PRINT "HELLO"',
      lineNumber: 10,
      source: 'PRINT "HELLO"',
      deletesLine: false
    });

    expect(parseApple2BasicInput("10")).toEqual({
      type: "program-line",
      normalizedInput: "10",
      lineNumber: 10,
      source: "",
      deletesLine: true
    });
  });

  it("rejects unsupported commands and out-of-range line numbers", () => {
    expect(parseApple2BasicInput("CATALOG")).toEqual({
      type: "invalid",
      normalizedInput: "CATALOG",
      message: "?SYNTAX ERROR"
    });

    expect(parseApple2BasicInput(String(APPLE2_BASIC_MAX_LINE_NUMBER + 1))).toEqual({
      type: "invalid",
      normalizedInput: String(APPLE2_BASIC_MAX_LINE_NUMBER + 1),
      message: "?SYNTAX ERROR"
    });
  });

  it("parses Phase 3 statements", () => {
    expect(parseApple2BasicStatement('PRINT "HELLO", 5')).toEqual({
      ok: true,
      statement: {
        type: "print",
        expressions: [
          {
            type: "string-literal",
            value: "HELLO"
          },
          {
            type: "number-literal",
            value: 5
          }
        ]
      }
    });

    expect(parseApple2BasicStatement("IF A = 1 THEN GOTO 40")).toEqual({
      ok: true,
      statement: {
        type: "if",
        condition: {
          type: "binary",
          operator: "=",
          left: {
            type: "variable",
            name: "A"
          },
          right: {
            type: "number-literal",
            value: 1
          }
        },
        thenBranch: {
          type: "statement",
          statement: {
            type: "goto",
            lineNumber: 40
          }
        }
      }
    });

    expect(parseApple2BasicStatement('INPUT "NAME"; A$')).toEqual({
      ok: true,
      statement: {
        type: "input",
        variable: "A$",
        prompt: "NAME"
      }
    });
  });
});
