import { describe, expect, it, vi } from "vitest";
import { createApple2BasicShellSession } from "./apple2-basic-shell-session";

const submit = (session: ReturnType<typeof createApple2BasicShellSession>, value: string) => {
  session.handleInputBytes(`${value}\r`);
};

describe("createApple2BasicShellSession", () => {
  it("boots with Apple-style banner lines and an empty prompt", () => {
    const session = createApple2BasicShellSession();

    session.boot();

    const state = session.getState();
    expect(state.booted).toBe(true);
    expect(state.prompt).toBe("]");
    expect(state.inputPrefix).toBe("]");
    expect(state.currentInput).toBe("");
    expect(state.transcriptLines[0]).toContain("APPLE IIE BASIC STORYBOOK DEMO");
    expect(state.transcriptLines[2]).toContain("PHASE 4 INTERACTIVE RUNTIME ONLINE");
  });

  it("supports a custom boot banner for themed story variants", () => {
    const session = createApple2BasicShellSession({
      bootLines: ["APPLE II", "DOS VERSION 3.3"]
    });

    session.boot();

    expect(session.getState().transcriptLines).toEqual(["APPLE II", "DOS VERSION 3.3"]);
  });

  it("stores, replaces, and deletes numbered lines", () => {
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, '10 print "hello"');
    submit(session, '10 print "goodbye"');

    expect(session.getState().programLines).toEqual([
      {
        lineNumber: 10,
        source: 'PRINT "GOODBYE"'
      }
    ]);

    submit(session, "10");

    expect(session.getState().programLines).toEqual([]);
  });

  it("lists stored lines in ascending line-number order", () => {
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, "20 goto 10");
    submit(session, '10 print "hello"');
    submit(session, "list");

    expect(session.getState().transcriptLines.slice(-3)).toEqual([
      "]LIST",
      '10 PRINT "HELLO"',
      "20 GOTO 10"
    ]);
  });

  it("prints NO PROGRAM when LIST is requested on an empty listing", () => {
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, "LIST");

    expect(session.getState().transcriptLines.slice(-1)[0]).toBe("NO PROGRAM");
  });

  it("clears the program with NEW and leaves a status message", () => {
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, "10 PRINT 1");
    submit(session, "NEW");

    expect(session.getState().programLines).toEqual([]);
    expect(session.getState().transcriptLines.slice(-1)[0]).toBe("NEW PROGRAM");
  });

  it("runs stored programs and appends output", async () => {
    vi.useFakeTimers();
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, "RUN");
    expect(session.getState().transcriptLines.slice(-1)[0]).toBe("NO PROGRAM");

    submit(session, '10 PRINT "HELLO"');
    submit(session, "20 END");
    submit(session, "RUN");
    await vi.runAllTimersAsync();
    expect(session.getState().transcriptLines.slice(-2)).toEqual([
      "]RUN",
      "HELLO"
    ]);
    vi.useRealTimers();
  });

  it("applies local prompt editing with backspace before submission", () => {
    const session = createApple2BasicShellSession();

    session.boot();
    session.handleInputBytes("AB");
    session.handleInputBytes("\u007f");
    session.handleInputBytes("c");

    expect(session.getState().currentInput).toBe("AC");
  });

  it("surfaces syntax errors for unsupported shell input and invalid line numbers", () => {
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, "CATALOG");
    expect(session.getState().transcriptLines.slice(-1)[0]).toBe("?SYNTAX ERROR");

    submit(session, "70000 PRINT 1");
    expect(session.getState().transcriptLines.slice(-1)[0]).toBe("?SYNTAX ERROR");
  });

  it("surfaces runtime errors from RUN with line context", async () => {
    vi.useFakeTimers();
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, "10 GOTO 40");
    submit(session, "RUN");
    await vi.runAllTimersAsync();

    expect(session.getState().transcriptLines.slice(-1)[0]).toBe(
      "?UNDEFINED STATEMENT ERROR IN 10"
    );
    vi.useRealTimers();
  });

  it("pauses for INPUT and resumes after terminal input is provided", async () => {
    vi.useFakeTimers();
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, '10 INPUT "NAME"; A$');
    submit(session, '20 PRINT "HELLO " + A$');
    submit(session, "RUN");

    await vi.runAllTimersAsync();

    expect(session.getState().mode).toBe("awaiting-input");
    expect(session.getState().inputPrefix).toBe("NAME? ");

    session.handleInputBytes("JOSH\r");

    expect(session.getState().mode).toBe("idle");
    expect(session.getState().transcriptLines.slice(-2)).toEqual([
      "NAME? JOSH",
      "HELLO JOSH"
    ]);
    vi.useRealTimers();
  });

  it("keeps waiting after invalid numeric INPUT and accepts a retry", async () => {
    vi.useFakeTimers();
    const session = createApple2BasicShellSession();

    session.boot();
    submit(session, "10 INPUT A");
    submit(session, "20 PRINT A");
    submit(session, "RUN");

    await vi.runAllTimersAsync();

    expect(session.getState().mode).toBe("awaiting-input");
    session.handleInputBytes("NOPE\r");

    expect(session.getState().mode).toBe("awaiting-input");
    expect(session.getState().transcriptLines.slice(-2)).toEqual([
      "? NOPE",
      "?REENTER"
    ]);

    session.handleInputBytes("5\r");
    expect(session.getState().mode).toBe("idle");
    expect(session.getState().transcriptLines.slice(-2)).toEqual([
      "? 5",
      "5"
    ]);
    vi.useRealTimers();
  });

  it("supports BREAK while a program is running", async () => {
    vi.useFakeTimers();
    const session = createApple2BasicShellSession({
      runStepBudget: 1,
      interpreterMaxSteps: 1000
    });

    session.boot();
    submit(session, "10 GOTO 10");
    submit(session, "RUN");

    expect(session.getState().mode).toBe("running");
    await vi.advanceTimersToNextTimerAsync();
    expect(session.getState().mode).toBe("running");

    session.handleInputBytes("\u0003");

    expect(session.getState().mode).toBe("idle");
    expect(session.getState().transcriptLines.slice(-1)[0]).toBe("BREAK IN 10");
    vi.useRealTimers();
  });
});
