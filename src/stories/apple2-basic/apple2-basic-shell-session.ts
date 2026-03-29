import {
  createApple2BasicProgramRunner,
  type Apple2BasicProgramRunner
} from "./apple2-basic-interpreter";
import { parseApple2BasicInput } from "./apple2-basic-parser";

const ESC = "\u001b";
const DEL = "\u007f";
const CTRL_C = "\u0003";

const DEFAULT_PROMPT = "]";
const DEFAULT_MAX_INPUT_LENGTH = 120;
const DEFAULT_RUN_STEP_BUDGET = 64;
const DEFAULT_BOOT_LINES = [
  "APPLE IIE BASIC STORYBOOK DEMO",
  "",
  "PHASE 4 INTERACTIVE RUNTIME ONLINE",
  "INPUT NOW PAUSES AND RESUMES PROGRAMS",
  "CTRL+C BREAKS RUNNING OR WAITING PROGRAMS",
  ""
] as const;

const textDecoder = new TextDecoder();

export type Apple2BasicProgramLine = {
  lineNumber: number;
  source: string;
};

export type Apple2BasicShellMode = "idle" | "running" | "awaiting-input";

export type Apple2BasicShellState = {
  booted: boolean;
  mode: Apple2BasicShellMode;
  prompt: string;
  inputPrefix: string | null;
  currentInput: string;
  transcriptLines: string[];
  programLines: Apple2BasicProgramLine[];
};

export type Apple2BasicShellSessionOptions = {
  prompt?: string;
  bootLines?: readonly string[];
  maxInputLength?: number;
  runStepBudget?: number;
  interpreterMaxSteps?: number;
};

export type Apple2BasicShellSession = {
  boot: () => void;
  reset: () => void;
  handleInputBytes: (data: string | Uint8Array) => void;
  getState: () => Apple2BasicShellState;
  subscribe: (listener: () => void) => () => void;
};

const isPrintableCharacter = (value: string) => value >= " " && value !== DEL;

const consumeEscapeSequence = (value: string, start: number) => {
  const prefix = value[start + 1];

  if (!prefix) {
    return start + 1;
  }

  if (prefix === "[") {
    let index = start + 2;

    while (index < value.length) {
      const char = value[index];
      if (char && char >= "@" && char <= "~") {
        return index + 1;
      }
      index += 1;
    }

    return value.length;
  }

  if (prefix === "O") {
    return Math.min(value.length, start + 3);
  }

  return Math.min(value.length, start + 2);
};

class Apple2BasicShellSessionStore implements Apple2BasicShellSession {
  private readonly listeners = new Set<() => void>();
  private readonly prompt: string;
  private readonly bootLines: readonly string[];
  private readonly maxInputLength: number;
  private readonly runStepBudget: number;
  private readonly interpreterMaxSteps: number | undefined;
  private readonly programLines = new Map<number, string>();
  private transcriptLines: string[] = [];
  private currentInput = "";
  private booted = false;
  private mode: Apple2BasicShellMode = "idle";
  private inputPrefix: string | null = DEFAULT_PROMPT;
  private runner: Apple2BasicProgramRunner | null = null;
  private runTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: Apple2BasicShellSessionOptions = {}) {
    this.prompt = options.prompt ?? DEFAULT_PROMPT;
    this.bootLines = options.bootLines ?? DEFAULT_BOOT_LINES;
    this.maxInputLength = options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
    this.runStepBudget = options.runStepBudget ?? DEFAULT_RUN_STEP_BUDGET;
    this.interpreterMaxSteps = options.interpreterMaxSteps;
    this.inputPrefix = this.prompt;
  }

  boot() {
    if (this.booted) {
      return;
    }

    this.booted = true;
    this.currentInput = "";
    this.mode = "idle";
    this.inputPrefix = this.prompt;
    this.transcriptLines = [...this.bootLines];
    this.emit();
  }

  reset() {
    this.clearRunner();
    this.programLines.clear();
    this.transcriptLines = [];
    this.currentInput = "";
    this.booted = false;
    this.mode = "idle";
    this.inputPrefix = this.prompt;
    this.boot();
  }

  handleInputBytes(data: string | Uint8Array) {
    if (!this.booted) {
      this.boot();
    }

    const input = typeof data === "string" ? data : textDecoder.decode(data);
    let index = 0;
    let changed = false;

    while (index < input.length) {
      const char = input[index];

      if (!char) {
        index += 1;
        continue;
      }

      if (char === ESC) {
        index = consumeEscapeSequence(input, index);
        continue;
      }

      if (char === CTRL_C) {
        if (this.mode === "running" || this.mode === "awaiting-input") {
          this.applyRunnerUpdate(this.runner?.breakExecution() ?? null);
          changed = true;
        } else if (this.currentInput.length > 0) {
          this.currentInput = "";
          changed = true;
        }

        index += 1;
        continue;
      }

      if (char === "\r") {
        if (input[index + 1] === "\n") {
          index += 1;
        }

        if (this.mode === "awaiting-input") {
          this.submitRuntimeInput();
          changed = true;
        } else if (this.mode === "idle") {
          this.submitCurrentInput();
          changed = true;
        }

        index += 1;
        continue;
      }

      if (char === "\n") {
        if (this.mode === "awaiting-input") {
          this.submitRuntimeInput();
          changed = true;
        } else if (this.mode === "idle") {
          this.submitCurrentInput();
          changed = true;
        }

        index += 1;
        continue;
      }

      if (this.mode === "running") {
        index += 1;
        continue;
      }

      if (char === DEL || char === "\b") {
        if (this.currentInput.length > 0) {
          this.currentInput = this.currentInput.slice(0, -1);
          changed = true;
        }

        index += 1;
        continue;
      }

      if (char === "\t") {
        changed = this.appendCharacter(" ") || changed;
        index += 1;
        continue;
      }

      if (isPrintableCharacter(char)) {
        changed = this.appendCharacter(char) || changed;
      }

      index += 1;
    }

    if (changed) {
      this.emit();
    }
  }

  getState(): Apple2BasicShellState {
    return {
      booted: this.booted,
      mode: this.mode,
      prompt: this.prompt,
      inputPrefix: this.inputPrefix,
      currentInput: this.currentInput,
      transcriptLines: [...this.transcriptLines],
      programLines: this.getSortedProgramLines()
    };
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private appendCharacter(value: string) {
    if (this.currentInput.length >= this.maxInputLength) {
      return false;
    }

    this.currentInput += value.toUpperCase();
    return true;
  }

  private submitCurrentInput() {
    const submittedInput = this.currentInput;
    this.transcriptLines.push(`${this.prompt}${submittedInput}`);
    this.currentInput = "";
    this.inputPrefix = this.prompt;

    const parsedInput = parseApple2BasicInput(submittedInput);

    switch (parsedInput.type) {
      case "empty":
        return;
      case "program-line":
        if (parsedInput.deletesLine) {
          this.programLines.delete(parsedInput.lineNumber);
          return;
        }

        this.programLines.set(parsedInput.lineNumber, parsedInput.source);
        return;
      case "command":
        switch (parsedInput.command) {
          case "LIST":
            if (this.programLines.size === 0) {
              this.transcriptLines.push("NO PROGRAM");
              return;
            }

            for (const entry of this.getSortedProgramLines()) {
              this.transcriptLines.push(`${entry.lineNumber} ${entry.source}`);
            }
            return;
          case "NEW":
            this.clearRunner();
            this.programLines.clear();
            this.mode = "idle";
            this.inputPrefix = this.prompt;
            this.transcriptLines.push("NEW PROGRAM");
            return;
          case "RUN":
            if (this.programLines.size === 0) {
              this.transcriptLines.push("NO PROGRAM");
              return;
            }

            this.startProgram();
            return;
        }
        return;
      case "invalid":
        this.transcriptLines.push(parsedInput.message);
        return;
    }
  }

  private submitRuntimeInput() {
    if (this.mode !== "awaiting-input" || !this.runner || !this.inputPrefix) {
      return;
    }

    const submittedInput = this.currentInput;
    this.transcriptLines.push(`${this.inputPrefix}${submittedInput}`);
    this.currentInput = "";

    const update = this.runner.resumeInput(submittedInput, this.runStepBudget);
    this.applyRunnerUpdate(update);
  }

  private startProgram() {
    this.clearRunner();

    const createdRunner = createApple2BasicProgramRunner(this.getSortedProgramLines(), {
      maxSteps: this.interpreterMaxSteps
    });

    if (!createdRunner.ok) {
      this.transcriptLines.push(createdRunner.error);
      this.mode = "idle";
      this.inputPrefix = this.prompt;
      return;
    }

    this.runner = createdRunner.runner;
    this.mode = "running";
    this.inputPrefix = null;
    this.schedulePump();
  }

  private schedulePump() {
    if (this.runTimer !== null || !this.runner) {
      return;
    }

    this.runTimer = setTimeout(() => {
      this.runTimer = null;
      this.pumpProgram();
    }, 0);
  }

  private pumpProgram() {
    if (!this.runner) {
      return;
    }

    const update = this.runner.advance(this.runStepBudget);
    this.applyRunnerUpdate(update);
  }

  private applyRunnerUpdate(update: ReturnType<Apple2BasicProgramRunner["advance"]> | null) {
    if (!update) {
      return;
    }

    this.transcriptLines.push(...update.outputLines);

    switch (update.status) {
      case "running":
        this.mode = "running";
        this.inputPrefix = null;
        this.schedulePump();
        break;
      case "awaiting-input":
        this.mode = "awaiting-input";
        this.inputPrefix = update.inputRequest.prompt;
        this.currentInput = "";
        break;
      case "completed":
        this.clearRunner();
        this.mode = "idle";
        this.inputPrefix = this.prompt;
        break;
      case "error":
      case "broken":
        this.clearRunner();
        this.mode = "idle";
        this.inputPrefix = this.prompt;
        this.currentInput = "";
        this.transcriptLines.push(update.error);
        break;
    }

    this.emit();
  }

  private clearRunner() {
    this.runner = null;

    if (this.runTimer !== null) {
      clearTimeout(this.runTimer);
      this.runTimer = null;
    }
  }

  private getSortedProgramLines() {
    return [...this.programLines.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([lineNumber, source]) => ({
        lineNumber,
        source
      }));
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const createApple2BasicShellSession = (
  options: Apple2BasicShellSessionOptions = {}
) => new Apple2BasicShellSessionStore(options);
