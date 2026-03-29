import type { Apple2BasicProgramLine } from "./apple2-basic-shell-session";

export type Apple2BasicDemoScriptStep = {
  text: string;
  submit?: boolean;
  typingDelayMs?: number;
  afterDelayMs?: number;
};

const centerApple2Line = (value: string, cols = 40) => {
  if (value.length >= cols) {
    return value;
  }

  const leftPadding = Math.floor((cols - value.length) / 2);
  return `${" ".repeat(leftPadding)}${value}`;
};

export const apple2Dos33BootLines = [
  "",
  centerApple2Line("APPLE II", 80),
  "",
  centerApple2Line("DOS VERSION 3.3  SYSTEM MASTER", 80),
  "",
  centerApple2Line("JANUARY 1, 1983", 80),
  "",
  centerApple2Line("COPYRIGHT APPLE COMPUTER,INC. 1980,1982", 80),
  ""
] as const;

export const apple2BasicHelloWorldProgram: Apple2BasicProgramLine[] = [
  {
    lineNumber: 10,
    source: 'PRINT "HELLO, WORLD"'
  },
  {
    lineNumber: 20,
    source: "END"
  }
];

export const apple2BasicInputProgram: Apple2BasicProgramLine[] = [
  {
    lineNumber: 10,
    source: 'INPUT "NAME"; A$'
  },
  {
    lineNumber: 20,
    source: 'PRINT "WELCOME " + A$'
  },
  {
    lineNumber: 30,
    source: "END"
  }
];

export const apple2BasicPhase5DemoScript: readonly Apple2BasicDemoScriptStep[] = [
  {
    text: "NEW",
    submit: true,
    typingDelayMs: 90,
    afterDelayMs: 280
  },
  {
    text: '10 INPUT "NAME"; A$',
    submit: true,
    typingDelayMs: 70,
    afterDelayMs: 240
  },
  {
    text: '20 PRINT "WELCOME " + A$',
    submit: true,
    typingDelayMs: 65,
    afterDelayMs: 220
  },
  {
    text: "30 END",
    submit: true,
    typingDelayMs: 75,
    afterDelayMs: 260
  },
  {
    text: "RUN",
    submit: true,
    typingDelayMs: 100,
    afterDelayMs: 520
  },
  {
    text: "JOSH",
    submit: true,
    typingDelayMs: 120,
    afterDelayMs: 900
  }
] as const;

export const apple2Dos33BootPromptScript: readonly Apple2BasicDemoScriptStep[] = [
  {
    text: '10 PRINT "HELLO"',
    submit: true,
    typingDelayMs: 95,
    afterDelayMs: 220
  },
  {
    text: "RUN",
    submit: true,
    typingDelayMs: 120,
    afterDelayMs: 520
  },
  {
    text: '20 PRINT "FROM DOS 3.3"',
    submit: true,
    typingDelayMs: 90,
    afterDelayMs: 220
  },
  {
    text: "RUN",
    submit: true,
    typingDelayMs: 120,
    afterDelayMs: 640
  },
  {
    text: "30 C = C + 1",
    submit: true,
    typingDelayMs: 90,
    afterDelayMs: 180
  },
  {
    text: "40 IF C < 3 THEN GOTO 10",
    submit: true,
    typingDelayMs: 82,
    afterDelayMs: 220
  },
  {
    text: "50 END",
    submit: true,
    typingDelayMs: 90,
    afterDelayMs: 220
  },
  {
    text: "RUN",
    submit: true,
    typingDelayMs: 120,
    afterDelayMs: 880
  },
  {
    text: '60 INPUT "NAME"; A$',
    submit: true,
    typingDelayMs: 88,
    afterDelayMs: 180
  },
  {
    text: '70 PRINT "HI " + A$',
    submit: true,
    typingDelayMs: 84,
    afterDelayMs: 200
  },
  {
    text: "80 END",
    submit: true,
    typingDelayMs: 92,
    afterDelayMs: 180
  },
  {
    text: "RUN",
    submit: true,
    typingDelayMs: 120,
    afterDelayMs: 520
  },
  {
    text: "JOSH",
    submit: true,
    typingDelayMs: 130,
    afterDelayMs: 900
  }
] as const;
