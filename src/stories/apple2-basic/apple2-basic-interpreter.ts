import type {
  Apple2BasicExpression,
  Apple2BasicStatement,
  Apple2BasicValue
} from "./apple2-basic-ast";
import { parseApple2BasicStatement } from "./apple2-basic-parser";

export type Apple2BasicProgramLine = {
  lineNumber: number;
  source: string;
};

export type Apple2BasicInterpreterOptions = {
  maxSteps?: number;
};

export type Apple2BasicInputRequest = {
  variable: string;
  prompt: string;
  lineNumber: number;
};

export type Apple2BasicRunnerUpdate =
  | {
      status: "running";
      outputLines: string[];
    }
  | {
      status: "awaiting-input";
      outputLines: string[];
      inputRequest: Apple2BasicInputRequest;
    }
  | {
      status: "completed";
      outputLines: string[];
    }
  | {
      status: "error";
      outputLines: string[];
      error: string;
      lineNumber?: number;
    }
  | {
      status: "broken";
      outputLines: string[];
      error: string;
      lineNumber?: number;
    };

export type Apple2BasicProgramRunner = {
  advance: (stepBudget?: number) => Apple2BasicRunnerUpdate;
  resumeInput: (value: string, stepBudget?: number) => Apple2BasicRunnerUpdate;
  breakExecution: () => Apple2BasicRunnerUpdate;
  getStatus: () => Apple2BasicRunnerUpdate["status"];
  getInputRequest: () => Apple2BasicInputRequest | null;
};

export type Apple2BasicRunResult =
  | {
      status: "completed";
      outputLines: string[];
    }
  | {
      status: "error";
      outputLines: string[];
      error: string;
      lineNumber?: number;
    };

type Apple2BasicCompiledLine = {
  lineNumber: number;
  statement: Apple2BasicStatement;
};

type Apple2BasicExecutionSignal =
  | {
      type: "next";
    }
  | {
      type: "jump";
      lineNumber: number;
    }
  | {
      type: "end";
    }
  | {
      type: "input";
      variable: string;
      prompt: string | null;
    };

class Apple2BasicRuntimeError extends Error {
  readonly lineNumber?: number;

  constructor(message: string, lineNumber?: number) {
    super(message);
    this.lineNumber = lineNumber;
  }
}

const DEFAULT_MAX_STEPS = 5000;
const DEFAULT_STEP_BUDGET = 64;

const getDefaultVariableValue = (name: string): Apple2BasicValue =>
  name.endsWith("$") ? "" : 0;

const isTruthy = (value: Apple2BasicValue) =>
  typeof value === "number" ? value !== 0 : value.length > 0;

const formatValue = (value: Apple2BasicValue) =>
  typeof value === "number" ? String(value) : value;

const assertNumber = (value: Apple2BasicValue, lineNumber: number) => {
  if (typeof value !== "number") {
    throw new Apple2BasicRuntimeError("?TYPE MISMATCH ERROR", lineNumber);
  }

  return value;
};

const compareValues = (
  left: Apple2BasicValue,
  right: Apple2BasicValue,
  operator: "=" | "<>" | "<" | "<=" | ">" | ">=",
  lineNumber: number
) => {
  if (typeof left !== typeof right) {
    throw new Apple2BasicRuntimeError("?TYPE MISMATCH ERROR", lineNumber);
  }

  switch (operator) {
    case "=":
      return left === right ? 1 : 0;
    case "<>":
      return left !== right ? 1 : 0;
    case "<":
      return left < right ? 1 : 0;
    case "<=":
      return left <= right ? 1 : 0;
    case ">":
      return left > right ? 1 : 0;
    case ">=":
      return left >= right ? 1 : 0;
  }
};

const formatInputPrompt = (prompt: string | null) => (prompt ? `${prompt}? ` : "? ");

const compileProgram = (programLines: readonly Apple2BasicProgramLine[]) => {
  const compiledLines: Apple2BasicCompiledLine[] = [];

  for (const line of [...programLines].sort((left, right) => left.lineNumber - right.lineNumber)) {
    const parsedStatement = parseApple2BasicStatement(line.source);

    if (!parsedStatement.ok) {
      return {
        ok: false as const,
        error: `${parsedStatement.message} IN ${line.lineNumber}`
      };
    }

    compiledLines.push({
      lineNumber: line.lineNumber,
      statement: parsedStatement.statement
    });
  }

  return {
    ok: true as const,
    compiledLines
  };
};

class Apple2BasicProgramRunnerStore implements Apple2BasicProgramRunner {
  private readonly compiledLines: Apple2BasicCompiledLine[];
  private readonly lineIndexByNumber: Map<number, number>;
  private readonly variables = new Map<string, Apple2BasicValue>();
  private readonly maxSteps: number;
  private status: Apple2BasicRunnerUpdate["status"] = "running";
  private currentIndex = 0;
  private steps = 0;
  private inputRequest: Apple2BasicInputRequest | null = null;

  constructor(compiledLines: Apple2BasicCompiledLine[], options: Apple2BasicInterpreterOptions = {}) {
    this.compiledLines = compiledLines;
    this.lineIndexByNumber = new Map(
      compiledLines.map((line, index) => [line.lineNumber, index])
    );
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;

    if (compiledLines.length === 0) {
      this.status = "completed";
    }
  }

  advance(stepBudget = DEFAULT_STEP_BUDGET): Apple2BasicRunnerUpdate {
    if (this.status !== "running") {
      return this.buildTerminalUpdate(this.status);
    }

    const outputLines: string[] = [];
    let remaining = Math.max(1, stepBudget);

    try {
      while (remaining > 0 && this.status === "running") {
        if (this.currentIndex < 0 || this.currentIndex >= this.compiledLines.length) {
          this.status = "completed";
          return {
            status: "completed",
            outputLines
          };
        }

        this.steps += 1;
        if (this.steps > this.maxSteps) {
          throw new Apple2BasicRuntimeError("?TOO MANY STEPS");
        }

        const currentLine = this.compiledLines[this.currentIndex];
        const signal = this.executeStatement(currentLine.statement, currentLine.lineNumber, outputLines);
        remaining -= 1;

        switch (signal.type) {
          case "next":
            this.currentIndex += 1;
            break;
          case "jump": {
            const nextIndex = this.lineIndexByNumber.get(signal.lineNumber);
            if (nextIndex === undefined) {
              throw new Apple2BasicRuntimeError("?UNDEFINED STATEMENT ERROR", currentLine.lineNumber);
            }

            this.currentIndex = nextIndex;
            break;
          }
          case "end":
            this.status = "completed";
            return {
              status: "completed",
              outputLines
            };
          case "input":
            this.currentIndex += 1;
            this.inputRequest = {
              variable: signal.variable,
              prompt: formatInputPrompt(signal.prompt),
              lineNumber: currentLine.lineNumber
            };
            this.status = "awaiting-input";
            return {
              status: "awaiting-input",
              outputLines,
              inputRequest: this.inputRequest
            };
        }
      }

      return {
        status: "running",
        outputLines
      };
    } catch (error) {
      return this.fail(error, outputLines);
    }
  }

  resumeInput(value: string, stepBudget = DEFAULT_STEP_BUDGET): Apple2BasicRunnerUpdate {
    if (this.status !== "awaiting-input" || !this.inputRequest) {
      return {
        status: "error",
        outputLines: [],
        error: "?INTERNAL ERROR"
      };
    }

    const request = this.inputRequest;
    const normalizedValue = value.trim();

    if (!request.variable.endsWith("$")) {
      if (normalizedValue.length === 0 || !Number.isFinite(Number.parseFloat(normalizedValue))) {
        return {
          status: "awaiting-input",
          outputLines: ["?REENTER"],
          inputRequest: request
        };
      }

      this.variables.set(request.variable, Number.parseFloat(normalizedValue));
    } else {
      this.variables.set(request.variable, value);
    }

    this.inputRequest = null;
    this.status = "running";
    return this.advance(stepBudget);
  }

  breakExecution(): Apple2BasicRunnerUpdate {
    const lineNumber =
      this.inputRequest?.lineNumber ??
      this.compiledLines[this.currentIndex]?.lineNumber;
    this.status = "broken";
    this.inputRequest = null;

    return {
      status: "broken",
      outputLines: [],
      error: lineNumber ? `BREAK IN ${lineNumber}` : "BREAK",
      lineNumber
    };
  }

  getStatus() {
    return this.status;
  }

  getInputRequest() {
    return this.inputRequest;
  }

  private buildTerminalUpdate(status: Apple2BasicRunnerUpdate["status"]): Apple2BasicRunnerUpdate {
    if (status === "awaiting-input" && this.inputRequest) {
      return {
        status,
        outputLines: [],
        inputRequest: this.inputRequest
      };
    }

    if (status === "completed") {
      return {
        status,
        outputLines: []
      };
    }

    if (status === "broken") {
      return {
        status,
        outputLines: [],
        error: "BREAK"
      };
    }

    return {
      status: "error",
      outputLines: [],
      error: "?INTERNAL ERROR"
    };
  }

  private evaluateExpression(
    expression: Apple2BasicExpression,
    lineNumber: number
  ): Apple2BasicValue {
    switch (expression.type) {
      case "number-literal":
        return expression.value;
      case "string-literal":
        return expression.value;
      case "variable":
        return this.variables.get(expression.name) ?? getDefaultVariableValue(expression.name);
      case "unary":
        return -assertNumber(this.evaluateExpression(expression.operand, lineNumber), lineNumber);
      case "binary": {
        const left = this.evaluateExpression(expression.left, lineNumber);
        const right = this.evaluateExpression(expression.right, lineNumber);

        switch (expression.operator) {
          case "+":
            if (typeof left === "string" || typeof right === "string") {
              return `${formatValue(left)}${formatValue(right)}`;
            }
            return left + right;
          case "-":
            return assertNumber(left, lineNumber) - assertNumber(right, lineNumber);
          case "*":
            return assertNumber(left, lineNumber) * assertNumber(right, lineNumber);
          case "/": {
            const divisor = assertNumber(right, lineNumber);
            if (divisor === 0) {
              throw new Apple2BasicRuntimeError("?DIVISION BY ZERO ERROR", lineNumber);
            }
            return assertNumber(left, lineNumber) / divisor;
          }
          case "=":
          case "<>":
          case "<":
          case "<=":
          case ">":
          case ">=":
            return compareValues(left, right, expression.operator, lineNumber);
        }
      }
    }
  }

  private assignVariable(variable: string, value: Apple2BasicValue, lineNumber: number) {
    if (variable.endsWith("$")) {
      this.variables.set(variable, typeof value === "string" ? value : String(value));
      return;
    }

    if (typeof value !== "number") {
      throw new Apple2BasicRuntimeError("?TYPE MISMATCH ERROR", lineNumber);
    }

    this.variables.set(variable, value);
  }

  private executeStatement(
    statement: Apple2BasicStatement,
    lineNumber: number,
    outputLines: string[]
  ): Apple2BasicExecutionSignal {
    switch (statement.type) {
      case "rem":
        return { type: "next" };
      case "print":
        outputLines.push(
          statement.expressions
            .map((expression) => formatValue(this.evaluateExpression(expression, lineNumber)))
            .join(" ")
        );
        return { type: "next" };
      case "assignment":
        this.assignVariable(
          statement.variable,
          this.evaluateExpression(statement.expression, lineNumber),
          lineNumber
        );
        return { type: "next" };
      case "input":
        return {
          type: "input",
          variable: statement.variable,
          prompt: statement.prompt
        };
      case "goto":
        return {
          type: "jump",
          lineNumber: statement.lineNumber
        };
      case "if":
        if (!isTruthy(this.evaluateExpression(statement.condition, lineNumber))) {
          return { type: "next" };
        }

        if (statement.thenBranch.type === "line-number") {
          return {
            type: "jump",
            lineNumber: statement.thenBranch.lineNumber
          };
        }

        return this.executeStatement(statement.thenBranch.statement, lineNumber, outputLines);
      case "end":
        return { type: "end" };
    }
  }

  private fail(error: unknown, outputLines: string[]): Apple2BasicRunnerUpdate {
    this.inputRequest = null;
    this.status = "error";

    if (error instanceof Apple2BasicRuntimeError) {
      return {
        status: "error",
        outputLines,
        error: error.lineNumber ? `${error.message} IN ${error.lineNumber}` : error.message,
        lineNumber: error.lineNumber
      };
    }

    return {
      status: "error",
      outputLines,
      error: "?INTERNAL ERROR"
    };
  }
}

export const createApple2BasicProgramRunner = (
  programLines: readonly Apple2BasicProgramLine[],
  options: Apple2BasicInterpreterOptions = {}
):
  | {
      ok: true;
      runner: Apple2BasicProgramRunner;
    }
  | {
      ok: false;
      error: string;
    } => {
  const compiledProgram = compileProgram(programLines);
  if (!compiledProgram.ok) {
    return {
      ok: false,
      error: compiledProgram.error
    };
  }

  return {
    ok: true,
    runner: new Apple2BasicProgramRunnerStore(compiledProgram.compiledLines, options)
  };
};

export const runApple2BasicProgram = (
  programLines: readonly Apple2BasicProgramLine[],
  options: Apple2BasicInterpreterOptions & { inputs?: string[] } = {}
): Apple2BasicRunResult => {
  const createdRunner = createApple2BasicProgramRunner(programLines, options);
  if (!createdRunner.ok) {
    return {
      status: "error",
      outputLines: [],
      error: createdRunner.error
    };
  }

  const runner = createdRunner.runner;
  const outputLines: string[] = [];
  const queuedInputs = [...(options.inputs ?? [])];

  while (true) {
    const update = runner.advance(options.maxSteps ?? DEFAULT_MAX_STEPS);
    outputLines.push(...update.outputLines);

    switch (update.status) {
      case "running":
        continue;
      case "completed":
        return {
          status: "completed",
          outputLines
        };
      case "error":
      case "broken":
        return {
          status: "error",
          outputLines,
          error: update.error,
          lineNumber: update.lineNumber
        };
      case "awaiting-input": {
        const nextInput = queuedInputs.shift();
        if (nextInput === undefined) {
          return {
            status: "error",
            outputLines,
            error: `?INPUT REQUIRED IN ${update.inputRequest.lineNumber}`,
            lineNumber: update.inputRequest.lineNumber
          };
        }

        const resumed = runner.resumeInput(nextInput, options.maxSteps ?? DEFAULT_MAX_STEPS);
        outputLines.push(...resumed.outputLines);

        if (resumed.status === "awaiting-input") {
          continue;
        }

        if (resumed.status === "running") {
          continue;
        }

        if (resumed.status === "completed") {
          return {
            status: "completed",
            outputLines
          };
        }

        return {
          status: "error",
          outputLines,
          error: resumed.error,
          lineNumber: resumed.lineNumber
        };
      }
    }
  }
};
