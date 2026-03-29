import { describe, expect, it } from "vitest";
import {
  createApple2BasicProgramRunner,
  runApple2BasicProgram
} from "./apple2-basic-interpreter";

describe("runApple2BasicProgram", () => {
  it("runs a simple PRINT program", () => {
    const result = runApple2BasicProgram([
      { lineNumber: 10, source: 'PRINT "HELLO"' },
      { lineNumber: 20, source: "END" }
    ]);

    expect(result).toEqual({
      status: "completed",
      outputLines: ["HELLO"]
    });
  });

  it("supports LET, implicit assignment, and expression evaluation", () => {
    const result = runApple2BasicProgram([
      { lineNumber: 10, source: "LET A = 2" },
      { lineNumber: 20, source: "B = A * 5 + 1" },
      { lineNumber: 30, source: "PRINT B" }
    ]);

    expect(result).toEqual({
      status: "completed",
      outputLines: ["11"]
    });
  });

  it("supports IF THEN branching and GOTO", () => {
    const result = runApple2BasicProgram([
      { lineNumber: 10, source: "A = 1" },
      { lineNumber: 20, source: "IF A = 1 THEN 40" },
      { lineNumber: 30, source: 'PRINT "NO"' },
      { lineNumber: 40, source: 'PRINT "YES"' },
      { lineNumber: 50, source: "END" }
    ]);

    expect(result).toEqual({
      status: "completed",
      outputLines: ["YES"]
    });
  });

  it("supports PRINT with no expressions as a blank line", () => {
    const result = runApple2BasicProgram([
      { lineNumber: 10, source: "PRINT" },
      { lineNumber: 20, source: 'PRINT "NEXT"' }
    ]);

    expect(result).toEqual({
      status: "completed",
      outputLines: ["", "NEXT"]
    });
  });

  it("can feed INPUT values in one-shot mode", () => {
    const result = runApple2BasicProgram(
      [
        { lineNumber: 10, source: 'INPUT "NAME"; A$' },
        { lineNumber: 20, source: 'PRINT "HI " + A$' },
        { lineNumber: 30, source: "END" }
      ],
      {
        inputs: ["JOSH"]
      }
    );

    expect(result).toEqual({
      status: "completed",
      outputLines: ["HI JOSH"]
    });
  });

  it("reports syntax errors with line context", () => {
    const result = runApple2BasicProgram([
      { lineNumber: 10, source: "PRINT" },
      { lineNumber: 20, source: "IF THEN 30" }
    ]);

    expect(result).toEqual({
      status: "error",
      outputLines: [],
      error: "?SYNTAX ERROR IN 20"
    });
  });

  it("reports undefined jumps and runaway programs", () => {
    const undefinedJump = runApple2BasicProgram([{ lineNumber: 10, source: "GOTO 40" }]);

    expect(undefinedJump).toEqual({
      status: "error",
      outputLines: [],
      error: "?UNDEFINED STATEMENT ERROR IN 10",
      lineNumber: 10
    });

    const runaway = runApple2BasicProgram(
      [{ lineNumber: 10, source: "GOTO 10" }],
      {
        maxSteps: 5
      }
    );

    expect(runaway).toEqual({
      status: "error",
      outputLines: [],
      error: "?TOO MANY STEPS",
      lineNumber: undefined
    });
  });
});

describe("createApple2BasicProgramRunner", () => {
  it("pauses on INPUT and resumes when a value is supplied", () => {
    const createdRunner = createApple2BasicProgramRunner([
      { lineNumber: 10, source: 'INPUT "NAME"; A$' },
      { lineNumber: 20, source: 'PRINT "HELLO " + A$' }
    ]);

    expect(createdRunner.ok).toBe(true);
    if (!createdRunner.ok) {
      return;
    }

    const firstUpdate = createdRunner.runner.advance();
    expect(firstUpdate).toEqual({
      status: "awaiting-input",
      outputLines: [],
      inputRequest: {
        variable: "A$",
        prompt: "NAME? ",
        lineNumber: 10
      }
    });

    const resumed = createdRunner.runner.resumeInput("WORLD");
    expect(resumed).toEqual({
      status: "completed",
      outputLines: ["HELLO WORLD"]
    });
  });

  it("keeps waiting after invalid numeric input", () => {
    const createdRunner = createApple2BasicProgramRunner([
      { lineNumber: 10, source: "INPUT A" },
      { lineNumber: 20, source: "PRINT A" }
    ]);

    expect(createdRunner.ok).toBe(true);
    if (!createdRunner.ok) {
      return;
    }

    expect(createdRunner.runner.advance()).toEqual({
      status: "awaiting-input",
      outputLines: [],
      inputRequest: {
        variable: "A",
        prompt: "? ",
        lineNumber: 10
      }
    });

    expect(createdRunner.runner.resumeInput("NOPE")).toEqual({
      status: "awaiting-input",
      outputLines: ["?REENTER"],
      inputRequest: {
        variable: "A",
        prompt: "? ",
        lineNumber: 10
      }
    });
  });

  it("can break a waiting or running program", () => {
    const waitingRunner = createApple2BasicProgramRunner([
      { lineNumber: 10, source: "INPUT A" },
      { lineNumber: 20, source: "PRINT A" }
    ]);

    expect(waitingRunner.ok).toBe(true);
    if (!waitingRunner.ok) {
      return;
    }

    waitingRunner.runner.advance();
    expect(waitingRunner.runner.breakExecution()).toEqual({
      status: "broken",
      outputLines: [],
      error: "BREAK IN 10",
      lineNumber: 10
    });

    const runningRunner = createApple2BasicProgramRunner(
      [{ lineNumber: 10, source: "GOTO 10" }],
      { maxSteps: 50 }
    );

    expect(runningRunner.ok).toBe(true);
    if (!runningRunner.ok) {
      return;
    }

    expect(runningRunner.runner.advance(1)).toEqual({
      status: "running",
      outputLines: []
    });

    expect(runningRunner.runner.breakExecution()).toEqual({
      status: "broken",
      outputLines: [],
      error: "BREAK IN 10",
      lineNumber: 10
    });
  });
});
