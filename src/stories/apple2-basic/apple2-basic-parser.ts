import type {
  Apple2BasicExpression,
  Apple2BasicStatement,
  Apple2BasicThenBranch
} from "./apple2-basic-ast";

export const APPLE2_BASIC_MAX_LINE_NUMBER = 63999;

export type Apple2BasicImmediateCommand = "LIST" | "NEW" | "RUN";

export type Apple2BasicParsedInput =
  | {
      type: "empty";
      normalizedInput: "";
    }
  | {
      type: "command";
      normalizedInput: Apple2BasicImmediateCommand;
      command: Apple2BasicImmediateCommand;
    }
  | {
      type: "program-line";
      normalizedInput: string;
      lineNumber: number;
      source: string;
      deletesLine: boolean;
    }
  | {
      type: "invalid";
      normalizedInput: string;
      message: "?SYNTAX ERROR";
    };

const IMMEDIATE_COMMANDS = new Set<Apple2BasicImmediateCommand>(["LIST", "NEW", "RUN"]);

type Apple2BasicToken =
  | {
      type: "number";
      text: string;
      value: number;
    }
  | {
      type: "string";
      value: string;
    }
  | {
      type: "identifier";
      value: string;
    }
  | {
      type: "operator";
      value: "+" | "-" | "*" | "/" | "=" | "<>" | "<" | "<=" | ">" | ">=";
    }
  | {
      type: "comma";
    }
  | {
      type: "semicolon";
    }
  | {
      type: "lparen";
    }
  | {
      type: "rparen";
    }
  | {
      type: "eof";
    };

export type Apple2BasicParsedStatement =
  | {
      ok: true;
      statement: Apple2BasicStatement;
    }
  | {
      ok: false;
      message: "?SYNTAX ERROR";
    };

export const normalizeApple2BasicInput = (value: string) =>
  value.replace(/\t/gu, " ").trim().toUpperCase();

export const parseApple2BasicInput = (value: string): Apple2BasicParsedInput => {
  const normalizedInput = normalizeApple2BasicInput(value);

  if (normalizedInput.length === 0) {
    return {
      type: "empty",
      normalizedInput: ""
    };
  }

  const lineMatch = normalizedInput.match(/^(\d+)(?:\s+(.*))?$/u);
  if (lineMatch) {
    const lineNumber = Number.parseInt(lineMatch[1] ?? "", 10);

    if (
      !Number.isFinite(lineNumber) ||
      lineNumber < 0 ||
      lineNumber > APPLE2_BASIC_MAX_LINE_NUMBER
    ) {
      return {
        type: "invalid",
        normalizedInput,
        message: "?SYNTAX ERROR"
      };
    }

    const source = (lineMatch[2] ?? "").trim();

    return {
      type: "program-line",
      normalizedInput,
      lineNumber,
      source,
      deletesLine: source.length === 0
    };
  }

  if (IMMEDIATE_COMMANDS.has(normalizedInput as Apple2BasicImmediateCommand)) {
    return {
      type: "command",
      normalizedInput: normalizedInput as Apple2BasicImmediateCommand,
      command: normalizedInput as Apple2BasicImmediateCommand
    };
  }

  return {
    type: "invalid",
    normalizedInput,
    message: "?SYNTAX ERROR"
  };
};

const isIdentifierBoundary = (value: string, offset: number) => {
  const next = value[offset];
  return !next || !/[A-Z0-9$]/u.test(next);
};

const tokenizeApple2BasicSource = (source: string): Apple2BasicToken[] | null => {
  const tokens: Apple2BasicToken[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (!char) {
      break;
    }

    if (char === " ") {
      index += 1;
      continue;
    }

    if (char >= "0" && char <= "9") {
      let end = index + 1;
      let seenDot = false;

      while (end < source.length) {
        const nextChar = source[end];
        if (nextChar >= "0" && nextChar <= "9") {
          end += 1;
          continue;
        }

        if (nextChar === "." && !seenDot) {
          seenDot = true;
          end += 1;
          continue;
        }

        break;
      }

      const text = source.slice(index, end);
      const value = Number.parseFloat(text);
      if (!Number.isFinite(value)) {
        return null;
      }

      tokens.push({
        type: "number",
        text,
        value
      });
      index = end;
      continue;
    }

    if (char === '"') {
      let end = index + 1;

      while (end < source.length && source[end] !== '"') {
        end += 1;
      }

      if (end >= source.length) {
        return null;
      }

      tokens.push({
        type: "string",
        value: source.slice(index + 1, end)
      });
      index = end + 1;
      continue;
    }

    if (/[A-Z]/u.test(char)) {
      let end = index + 1;

      while (end < source.length && /[A-Z0-9$]/u.test(source[end] ?? "")) {
        end += 1;
      }

      tokens.push({
        type: "identifier",
        value: source.slice(index, end)
      });
      index = end;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma" });
      index += 1;
      continue;
    }

    if (char === ";") {
      tokens.push({ type: "semicolon" });
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "lparen" });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rparen" });
      index += 1;
      continue;
    }

    if (char === "<" || char === ">") {
      const nextPair = source.slice(index, index + 2);
      if (nextPair === "<=" || nextPair === ">=" || nextPair === "<>") {
        tokens.push({
          type: "operator",
          value: nextPair
        });
        index += 2;
        continue;
      }
    }

    if (char === "+" || char === "-" || char === "*" || char === "/" || char === "=" || char === "<" || char === ">") {
      tokens.push({
        type: "operator",
        value: char
      });
      index += 1;
      continue;
    }

    return null;
  }

  tokens.push({ type: "eof" });
  return tokens;
};

class Apple2BasicStatementParser {
  private index = 0;

  constructor(private readonly tokens: Apple2BasicToken[]) {}

  parseStatement(): Apple2BasicStatement | null {
    const token = this.peek();

    if (token.type === "identifier") {
      switch (token.value) {
        case "PRINT":
          this.consume();
          return this.parsePrintStatement();
        case "LET":
          this.consume();
          return this.parseAssignmentStatement();
        case "INPUT":
          this.consume();
          return this.parseInputStatement();
        case "GOTO":
          this.consume();
          return this.parseGotoStatement();
        case "IF":
          this.consume();
          return this.parseIfStatement();
        case "END":
          this.consume();
          return {
            type: "end"
          };
        default:
          if (this.peekNext().type === "operator" && this.peekNext().value === "=") {
            return this.parseAssignmentStatement();
          }
          return null;
      }
    }

    return null;
  }

  atEnd() {
    return this.peek().type === "eof";
  }

  private parsePrintStatement(): Apple2BasicStatement | null {
    if (this.atEnd()) {
      return {
        type: "print",
        expressions: []
      };
    }

    const expressions: Apple2BasicExpression[] = [];

    while (!this.atEnd()) {
      const expression = this.parseExpression();
      if (!expression) {
        return null;
      }

      expressions.push(expression);

      if (this.peek().type !== "comma") {
        break;
      }

      this.consume();
    }

    return {
      type: "print",
      expressions
    };
  }

  private parseAssignmentStatement(): Apple2BasicStatement | null {
    const variableToken = this.peek();
    if (variableToken.type !== "identifier") {
      return null;
    }

    this.consume();

    const equalsToken = this.peek();
    if (equalsToken.type !== "operator" || equalsToken.value !== "=") {
      return null;
    }

    this.consume();

    const expression = this.parseExpression();
    if (!expression) {
      return null;
    }

    return {
      type: "assignment",
      variable: variableToken.value,
      expression
    };
  }

  private parseInputStatement(): Apple2BasicStatement | null {
    let prompt: string | null = null;

    if (this.peek().type === "string") {
      prompt = this.peek().value;
      this.consume();

      const separator = this.peek();
      if (separator.type !== "semicolon" && separator.type !== "comma") {
        return null;
      }

      this.consume();
    }

    const variableToken = this.peek();
    if (variableToken.type !== "identifier") {
      return null;
    }

    this.consume();

    return {
      type: "input",
      variable: variableToken.value,
      prompt
    };
  }

  private parseGotoStatement(): Apple2BasicStatement | null {
    const lineToken = this.peek();
    if (lineToken.type !== "number" || !Number.isInteger(lineToken.value)) {
      return null;
    }

    this.consume();

    return {
      type: "goto",
      lineNumber: lineToken.value
    };
  }

  private parseIfStatement(): Apple2BasicStatement | null {
    const condition = this.parseExpression();
    if (!condition) {
      return null;
    }

    const thenToken = this.peek();
    if (thenToken.type !== "identifier" || thenToken.value !== "THEN") {
      return null;
    }

    this.consume();

    const thenBranch = this.parseThenBranch();
    if (!thenBranch) {
      return null;
    }

    return {
      type: "if",
      condition,
      thenBranch
    };
  }

  private parseThenBranch(): Apple2BasicThenBranch | null {
    const token = this.peek();

    if (token.type === "number" && this.peekNext().type === "eof") {
      this.consume();
      return {
        type: "line-number",
        lineNumber: token.value
      };
    }

    const statement = this.parseStatement();
    if (!statement) {
      return null;
    }

    return {
      type: "statement",
      statement
    };
  }

  private parseExpression() {
    return this.parseComparisonExpression();
  }

  private parseComparisonExpression(): Apple2BasicExpression | null {
    let expression = this.parseAdditiveExpression();
    if (!expression) {
      return null;
    }

    while (true) {
      const token = this.peek();
      if (
        token.type !== "operator" ||
        !["=", "<>", "<", "<=", ">", ">="].includes(token.value)
      ) {
        return expression;
      }

      this.consume();

      const right = this.parseAdditiveExpression();
      if (!right) {
        return null;
      }

      expression = {
        type: "binary",
        operator: token.value,
        left: expression,
        right
      };
    }
  }

  private parseAdditiveExpression(): Apple2BasicExpression | null {
    let expression = this.parseMultiplicativeExpression();
    if (!expression) {
      return null;
    }

    while (true) {
      const token = this.peek();
      if (
        token.type !== "operator" ||
        (token.value !== "+" && token.value !== "-")
      ) {
        return expression;
      }

      this.consume();

      const right = this.parseMultiplicativeExpression();
      if (!right) {
        return null;
      }

      expression = {
        type: "binary",
        operator: token.value,
        left: expression,
        right
      };
    }
  }

  private parseMultiplicativeExpression(): Apple2BasicExpression | null {
    let expression = this.parseUnaryExpression();
    if (!expression) {
      return null;
    }

    while (true) {
      const token = this.peek();
      if (
        token.type !== "operator" ||
        (token.value !== "*" && token.value !== "/")
      ) {
        return expression;
      }

      this.consume();

      const right = this.parseUnaryExpression();
      if (!right) {
        return null;
      }

      expression = {
        type: "binary",
        operator: token.value,
        left: expression,
        right
      };
    }
  }

  private parseUnaryExpression(): Apple2BasicExpression | null {
    const token = this.peek();
    if (token.type === "operator" && token.value === "-") {
      this.consume();
      const operand = this.parseUnaryExpression();
      if (!operand) {
        return null;
      }

      return {
        type: "unary",
        operator: "-",
        operand
      };
    }

    return this.parsePrimaryExpression();
  }

  private parsePrimaryExpression(): Apple2BasicExpression | null {
    const token = this.peek();

    if (token.type === "number") {
      this.consume();
      return {
        type: "number-literal",
        value: token.value
      };
    }

    if (token.type === "string") {
      this.consume();
      return {
        type: "string-literal",
        value: token.value
      };
    }

    if (token.type === "identifier") {
      this.consume();
      return {
        type: "variable",
        name: token.value
      };
    }

    if (token.type === "lparen") {
      this.consume();
      const expression = this.parseExpression();
      if (!expression || this.peek().type !== "rparen") {
        return null;
      }

      this.consume();
      return expression;
    }

    return null;
  }

  private peek() {
    return this.tokens[this.index] ?? { type: "eof" as const };
  }

  private peekNext() {
    return this.tokens[this.index + 1] ?? { type: "eof" as const };
  }

  private consume() {
    const token = this.peek();
    this.index += 1;
    return token;
  }
}

export const parseApple2BasicStatement = (source: string): Apple2BasicParsedStatement => {
  const normalizedSource = normalizeApple2BasicInput(source);

  if (normalizedSource.length === 0) {
    return {
      ok: false,
      message: "?SYNTAX ERROR"
    };
  }

  if (
    normalizedSource.startsWith("REM") &&
    isIdentifierBoundary(normalizedSource, 3)
  ) {
    return {
      ok: true,
      statement: {
        type: "rem",
        comment: normalizedSource.slice(3).trimStart()
      }
    };
  }

  const tokens = tokenizeApple2BasicSource(normalizedSource);
  if (!tokens) {
    return {
      ok: false,
      message: "?SYNTAX ERROR"
    };
  }

  const parser = new Apple2BasicStatementParser(tokens);
  const statement = parser.parseStatement();

  if (!statement || !parser.atEnd()) {
    return {
      ok: false,
      message: "?SYNTAX ERROR"
    };
  }

  return {
    ok: true,
    statement
  };
};
