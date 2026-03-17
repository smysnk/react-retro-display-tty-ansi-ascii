import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { progressRewriteTraceFixture } from "../core/terminal/conformance/fixtures/real-world/progress-rewrite.trace.fixture";
import { shellSessionTraceFixture } from "../core/terminal/conformance/fixtures/real-world/shell-session.trace.fixture";
import { statusPaneTraceFixture } from "../core/terminal/conformance/fixtures/real-world/status-pane.trace.fixture";
import { createRetroLcdController } from "../core/terminal/controller";
import type { RetroLcdDisplayColorMode, RetroLcdGeometry } from "../core/types";
import { RetroLcd } from "../react/RetroLcd";

const STORY_COLOR = "#97ff9b";

type StoryShellProps = {
  kicker: string;
  title: string;
  copy: string;
  children: ReactNode;
  footer?: ReactNode;
};

type DisplayColorModeCardProps = {
  displayColorMode: RetroLcdDisplayColorMode;
  title: string;
  copy: string;
  children: ReactNode;
};

type TraceScenario = {
  id: string;
  label: string;
  title: string;
  copy: string;
  rows: number;
  cols: number;
  chunks: string[];
  stepDelay: number;
};

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });

const displayColorModeDemoSteps: {
  displayColorMode: RetroLcdDisplayColorMode;
  value: string;
}[] = [
  {
    displayColorMode: "phosphor-green",
    value: [
      "MODE  phosphor-green",
      "\u001b[31malert\u001b[0m \u001b[33mwarn\u001b[0m \u001b[34mlink\u001b[0m",
      "\u001b[38;5;196mindexed 196\u001b[0m \u001b[38;2;72;210;255mtruecolor\u001b[0m"
    ].join("\r\n")
  },
  {
    displayColorMode: "phosphor-amber",
    value: [
      "MODE  phosphor-amber",
      "\u001b[31malert\u001b[0m \u001b[33mwarn\u001b[0m \u001b[34mlink\u001b[0m",
      "\u001b[38;5;214mindexed 214\u001b[0m \u001b[38;2;255;214;120mtruecolor\u001b[0m"
    ].join("\r\n")
  },
  {
    displayColorMode: "phosphor-ice",
    value: [
      "MODE  phosphor-ice",
      "\u001b[31malert\u001b[0m \u001b[33mwarn\u001b[0m \u001b[34mlink\u001b[0m",
      "\u001b[38;5;51mindexed 051\u001b[0m \u001b[38;2;180;240;255mtruecolor\u001b[0m"
    ].join("\r\n")
  },
  {
    displayColorMode: "ansi-classic",
    value: [
      "MODE  ansi-classic",
      "\u001b[31mRED\u001b[0m \u001b[33mYELLOW\u001b[0m \u001b[34mBLUE\u001b[0m",
      "\u001b[92mBRIGHT\u001b[0m \u001b[7mINVERSE\u001b[0m \u001b[44;37mFRAME\u001b[0m"
    ].join("\r\n")
  },
  {
    displayColorMode: "ansi-extended",
    value: [
      "MODE  ansi-extended",
      "\u001b[31mRED\u001b[0m \u001b[38;5;196mIDX 196\u001b[0m \u001b[38;5;45mIDX 045\u001b[0m",
      "\u001b[38;2;255;180;120mTRUECOLOR\u001b[0m \u001b[48;5;25;37m BG 025 \u001b[0m"
    ].join("\r\n")
  }
];

const traceScenarios: TraceScenario[] = [
  {
    id: "progress-rewrite",
    label: "Progress rewrite",
    title: "Rewrite a live line without tearing the terminal state apart.",
    copy: "This path exercises carriage return plus erase-in-line so progress text can keep updating in place until the final status settles.",
    rows: progressRewriteTraceFixture.rows,
    cols: progressRewriteTraceFixture.cols,
    chunks: progressRewriteTraceFixture.chunks,
    stepDelay: 560
  },
  {
    id: "shell-session",
    label: "Shell trace",
    title: "Replay shell-like chunks and keep ANSI color intent intact.",
    copy: "The same conformance fixtures that compare against xterm can drive the component in Storybook, so the docs stay grounded in real terminal behavior.",
    rows: shellSessionTraceFixture.rows,
    cols: shellSessionTraceFixture.cols,
    chunks: shellSessionTraceFixture.chunks,
    stepDelay: 620
  },
  {
    id: "status-pane",
    label: "Status pane",
    title: "Scroll regions and insert-line updates stay readable in a tight pane.",
    copy: "This fixture exercises a fixed header, a constrained scrolling body, and a truecolor footer insertion inside the lower region.",
    rows: statusPaneTraceFixture.rows,
    cols: statusPaneTraceFixture.cols,
    chunks: statusPaneTraceFixture.chunks,
    stepDelay: 700
  }
];

const setTextareaValue = (node: HTMLTextAreaElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  descriptor?.set?.call(node, value);
  node.setSelectionRange(value.length, value.length);
  node.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
};

const pressTextareaEnter = (node: HTMLTextAreaElement, shiftKey = false) => {
  const options = {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
    shiftKey
  };

  node.dispatchEvent(new KeyboardEvent("keydown", options));
  node.dispatchEvent(new KeyboardEvent("keyup", options));
};

const typeIntoTextarea = async (
  node: HTMLTextAreaElement,
  text: string,
  {
    delay = 110,
    initialValue
  }: {
    delay?: number;
    initialValue?: string;
  } = {}
) => {
  let currentValue = initialValue ?? node.value;

  for (const character of text) {
    currentValue += character;
    setTextareaValue(node, currentValue);
    await wait(delay);
  }

  return currentValue;
};

const playTraceScenario = (
  controller: ReturnType<typeof createRetroLcdController>,
  scenario: TraceScenario,
  startAt = 0
) => {
  const timers: number[] = [
    window.setTimeout(() => {
      controller.reset();
      controller.resize(scenario.rows, scenario.cols);
      controller.setCursorVisible(false);
    }, startAt)
  ];
  let nextAt = startAt + 240;

  for (const chunk of scenario.chunks) {
    timers.push(
      window.setTimeout(() => {
        controller.write(chunk);
      }, nextAt)
    );
    nextAt += scenario.stepDelay;
  }

  return {
    timers,
    nextAt
  };
};

function StoryShell({ kicker, title, copy, children, footer }: StoryShellProps) {
  return (
    <div className="sb-retro-page">
      <div className="sb-retro-shell">
        <div className="sb-retro-heading">
          <span className="sb-retro-kicker">{kicker}</span>
          <h1 className="sb-retro-title">{title}</h1>
          <p className="sb-retro-copy">{copy}</p>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

function Stage({ children, maxWidth = 860 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <div className="sb-retro-stage">
      <div className="sb-retro-frame" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
}

function DisplayColorModeCard({
  displayColorMode,
  title,
  copy,
  children
}: DisplayColorModeCardProps) {
  return (
    <div className="sb-retro-mode-card" data-display-mode-card={displayColorMode}>
      <div className="sb-retro-mode-copy">
        <span className="sb-retro-kicker">{displayColorMode}</span>
        <h2 className="sb-retro-mode-title">{title}</h2>
        <p className="sb-retro-mode-description">{copy}</p>
      </div>
      {children}
    </div>
  );
}

function CaptureStage({
  captureId,
  children,
  maxWidth = 860
}: {
  captureId: string;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div className="sb-retro-page sb-retro-page--capture">
      <div className="sb-retro-shell sb-retro-shell--capture">
        <div className="sb-retro-stage sb-retro-stage--capture">
          <div className="sb-retro-frame" style={{ maxWidth }}>
            <div className="sb-retro-capture-root" data-demo-capture={captureId}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuietOutputDemoStory() {
  const [value, setValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    const message = "LINK STABLE\nAwaiting operator input.";

    const run = async () => {
      await wait(220);

      for (let index = 1; index <= message.length; index += 1) {
        if (cancelled) {
          return;
        }

        setValue(message.slice(0, index));
        await wait(message[index - 1] === "\n" ? 260 : 92);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CaptureStage captureId="quiet-output" maxWidth={760}>
      <RetroLcd mode="value" color={STORY_COLOR} value={value} />
    </CaptureStage>
  );
}

function EditableModeDemoStory() {
  const [value, setValue] = useState("");
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await wait(260);

      const input = hostRef.current?.querySelector(".retro-lcd__input");
      if (!(input instanceof HTMLTextAreaElement)) {
        return;
      }

      input.focus();
      let currentValue = await typeIntoTextarea(input, "Compose inline.", { delay: 105 });

      if (cancelled) {
        return;
      }

      await wait(320);
      pressTextareaEnter(input, true);
      currentValue += "\n";
      setTextareaValue(input, currentValue);
      await wait(220);

      if (cancelled) {
        return;
      }

      await typeIntoTextarea(input, "Let the cursor land after every thought.", {
        delay: 96,
        initialValue: currentValue
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CaptureStage captureId="editable-drafting" maxWidth={860}>
      <div ref={hostRef}>
        <RetroLcd
          mode="value"
          value={value}
          editable
          autoFocus
          color={STORY_COLOR}
          cursorMode="solid"
          placeholder="Write a line, breathe, then press Enter."
          onChange={setValue}
        />
      </div>
    </CaptureStage>
  );
}

function EditableNotebookStory() {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState("Nothing committed yet.");

  return (
    <StoryShell
      kicker="Value Mode"
      title="A calm drafting surface."
      copy="Use the component as a controlled text area when you want the retro treatment without building a terminal protocol around it."
      footer={
        <div className="sb-retro-status">
          Last Enter press: {submitted} Shift+Enter keeps writing on the next line.
        </div>
      }
    >
      <Stage>
        <RetroLcd
          mode="value"
          value={value}
          editable
          autoFocus
          color={STORY_COLOR}
          placeholder="Write a line, breathe, then press Enter."
          onChange={setValue}
          onSubmit={(nextValue) => {
            setSubmitted(nextValue.length > 0 ? nextValue : "(empty)");
          }}
        />
      </Stage>
    </StoryShell>
  );
}

function TerminalStreamStory() {
  const [controller] = useState(() =>
    createRetroLcdController({
      rows: 9,
      cols: 46,
      cursorMode: "hollow"
    })
  );

  useEffect(() => {
    controller.reset();
    controller.setCursorMode("hollow");
    controller.setCursorVisible(true);

    const schedule = [
      window.setTimeout(() => {
        controller.writeln("BOOT   react-retro-display-tty-ansi");
      }, 400),
      window.setTimeout(() => {
        controller.writeln("CHECK  measuring rows and columns");
      }, 1050),
      window.setTimeout(() => {
        controller.write("\u001b[1mREADY\u001b[0m  controller attached");
        controller.writeln("");
      }, 1850),
      window.setTimeout(() => {
        controller.write("\u001b[2msoft state preserved for quiet hints\u001b[0m");
        controller.writeln("");
      }, 2800),
      window.setTimeout(() => {
        controller.write("\u001b[7mLIVE\u001b[0m feed bound to external events");
        controller.writeln("");
      }, 3800),
      window.setTimeout(() => {
        controller.write("\u001b[5mBLINK\u001b[0m cursor waiting for the next write");
      }, 4900)
    ];

    return () => {
      for (const timer of schedule) {
        window.clearTimeout(timer);
      }
    };
  }, [controller]);

  return (
    <StoryShell
      kicker="Terminal Mode"
      title="Drive it from outside your React tree."
      copy="Attach a controller when the display should follow logs, shell output, status feeds, or any stream of writes that already speaks terminal."
      footer={
        <ul className="sb-retro-note-list">
          <li>Useful for streaming output, simulated shells, or telemetry panes.</li>
          <li>The story writes over time so the controller path is visible, not just implied.</li>
        </ul>
      }
    >
      <Stage>
        <RetroLcd mode="terminal" controller={controller} color={STORY_COLOR} />
      </Stage>
    </StoryShell>
  );
}

function TerminalModeDemoStory() {
  const [controller] = useState(() =>
    createRetroLcdController({
      rows: 9,
      cols: 46,
      cursorMode: "solid"
    })
  );

  useEffect(() => {
    controller.reset();
    controller.setCursorMode("solid");
    controller.setCursorVisible(true);

    const schedule = [
      window.setTimeout(() => {
        controller.writeln("BOOT   react-retro-display-tty-ansi");
      }, 260),
      window.setTimeout(() => {
        controller.writeln("CHECK  controller attached");
      }, 1120),
      window.setTimeout(() => {
        controller.write("\u001b[1mREADY\u001b[0m ansi parser online");
        controller.writeln("");
      }, 2080),
      window.setTimeout(() => {
        controller.write("\u001b[2msoft notes stay readable without stealing focus\u001b[0m");
        controller.writeln("");
      }, 3140),
      window.setTimeout(() => {
        controller.write("\u001b[7mLIVE\u001b[0m output keeps pace with external writes");
        controller.writeln("");
      }, 4320)
    ];

    return () => {
      for (const timer of schedule) {
        window.clearTimeout(timer);
      }
    };
  }, [controller]);

  return (
    <CaptureStage captureId="terminal-output" maxWidth={860}>
      <RetroLcd mode="terminal" controller={controller} color={STORY_COLOR} />
    </CaptureStage>
  );
}

function PromptConsoleStory() {
  return (
    <StoryShell
      kicker="Prompt Mode"
      title="Keep the interaction loop small."
      copy="When the UI needs a command line instead of a free-form editor, prompt mode handles the transcript, cursor, and response protocol for you."
      footer={
        <ul className="sb-retro-note-list">
          <li>Click the display and try: `status`, `scan`, `sync`, or `wipe`.</li>
          <li>Accepted commands answer with READY. Unsupported ones return DENIED.</li>
        </ul>
      }
    >
      <Stage>
        <RetroLcd
          mode="prompt"
          autoFocus
          color={STORY_COLOR}
          promptChar="$"
          acceptanceText="READY"
          rejectionText="DENIED"
          onCommand={async (command) => {
            await wait(520);

            switch (command.trim()) {
              case "status":
                return {
                  accepted: true,
                  response: ["grid synced", "cursor stable", "story ready"]
                };
              case "scan":
                return {
                  accepted: true,
                  response: ["signal sweep", "north: clear", "south: clear", "depth: nominal"]
                };
              case "sync":
                return {
                  accepted: true,
                  response: "storybook and readme now agree"
                };
              default:
                return {
                  accepted: false,
                  response: "unknown command"
                };
            }
          }}
        />
      </Stage>
    </StoryShell>
  );
}

function PromptModeDemoStory() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await wait(260);

      const input = hostRef.current?.querySelector(".retro-lcd__input");
      if (!(input instanceof HTMLTextAreaElement)) {
        return;
      }

      input.focus();
      await typeIntoTextarea(input, "status", { delay: 120 });

      if (cancelled) {
        return;
      }

      await wait(260);
      pressTextareaEnter(input);
      await wait(1100);

      if (cancelled) {
        return;
      }

      await typeIntoTextarea(input, "wipe", { delay: 120 });
      await wait(220);
      pressTextareaEnter(input);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CaptureStage captureId="prompt-interaction" maxWidth={860}>
      <div ref={hostRef}>
        <RetroLcd
          mode="prompt"
          autoFocus
          color={STORY_COLOR}
          cursorMode="solid"
          promptChar="$"
          acceptanceText="READY"
          rejectionText="DENIED"
          onCommand={async (command) => {
            await wait(420);

            switch (command.trim()) {
              case "status":
                return {
                  accepted: true,
                  response: ["grid synced", "cursor stable", "story ready"]
                };
              default:
                return {
                  accepted: false,
                  response: "unknown command"
                };
            }
          }}
        />
      </div>
    </CaptureStage>
  );
}

function DisplayColorModesDemoStory() {
  const [controller] = useState(() =>
    createRetroLcdController({
      rows: 6,
      cols: 40,
      cursorMode: "solid"
    })
  );
  const [displayColorMode, setDisplayColorMode] = useState<RetroLcdDisplayColorMode>(
    displayColorModeDemoSteps[0].displayColorMode
  );

  useEffect(() => {
    const applyStep = ({
      displayColorMode: nextDisplayColorMode,
      value
    }: (typeof displayColorModeDemoSteps)[number]) => {
      setDisplayColorMode(nextDisplayColorMode);
      controller.reset();
      controller.resize(6, 40);
      controller.setCursorVisible(false);
      controller.write(value);
    };

    applyStep(displayColorModeDemoSteps[0]);

    const timers = displayColorModeDemoSteps.slice(1).map((step, index) =>
      window.setTimeout(() => {
        applyStep(step);
      }, (index + 1) * 1800)
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [controller]);

  return (
    <CaptureStage captureId="display-color-modes" maxWidth={820}>
      <RetroLcd
        mode="terminal"
        controller={controller}
        displayColorMode={displayColorMode}
        cursorMode="solid"
      />
    </CaptureStage>
  );
}

function ControlCharacterReplayStory() {
  const [scenarioId, setScenarioId] = useState(traceScenarios[0].id);
  const [runToken, setRunToken] = useState(0);
  const [controller] = useState(() =>
    createRetroLcdController({
      rows: traceScenarios[0].rows,
      cols: traceScenarios[0].cols,
      cursorMode: "solid"
    })
  );

  const scenario = traceScenarios.find((entry) => entry.id === scenarioId) ?? traceScenarios[0];

  useEffect(() => {
    const { timers } = playTraceScenario(controller, scenario, 160);

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [controller, runToken, scenario]);

  return (
    <StoryShell
      kicker="Terminal Conformance"
      title={scenario.title}
      copy={scenario.copy}
      footer={
        <ul className="sb-retro-note-list">
          <li>Click an active chip to replay the same trace.</li>
          <li>The component is replaying the same chunk fixtures used in the xterm-backed conformance suite.</li>
        </ul>
      }
    >
      <div className="sb-retro-toolbar">
        {traceScenarios.map((entry) => (
          <button
            className="sb-retro-button"
            type="button"
            key={entry.id}
            data-active={entry.id === scenario.id}
            onClick={() => {
              if (entry.id === scenario.id) {
                setRunToken((current) => current + 1);
                return;
              }

              setScenarioId(entry.id);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <Stage maxWidth={820}>
        <RetroLcd
          mode="terminal"
          controller={controller}
          displayColorMode="ansi-extended"
          cursorMode="solid"
        />
      </Stage>
    </StoryShell>
  );
}

function ControlCharacterReplayDemoStory() {
  const [controller] = useState(() =>
    createRetroLcdController({
      rows: 6,
      cols: 34,
      cursorMode: "solid"
    })
  );

  useEffect(() => {
    const timers: number[] = [];
    let nextAt = 180;

    for (const scenario of traceScenarios) {
      const scheduled = playTraceScenario(controller, scenario, nextAt);
      timers.push(...scheduled.timers);
      nextAt = scheduled.nextAt + 900;
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [controller]);

  return (
    <CaptureStage captureId="control-character-replay" maxWidth={820}>
      <RetroLcd
        mode="terminal"
        controller={controller}
        displayColorMode="ansi-extended"
        cursorMode="solid"
      />
    </CaptureStage>
  );
}

function DisplayBufferStory() {
  const [controller] = useState(() =>
    createRetroLcdController({
      rows: 8,
      cols: 34,
      scrollback: 40,
      cursorMode: "solid"
    })
  );
  const [lineNumber, setLineNumber] = useState(18);

  useEffect(() => {
    controller.reset();
    controller.setCursorVisible(true);
    controller.setCursorMode("solid");

    for (let index = 1; index <= 18; index += 1) {
      const line = `line-${String(index).padStart(2, "0")}  telemetry stable`;
      if (index < 18) {
        controller.writeln(line);
      } else {
        controller.write(line);
      }
    }
  }, [controller]);

  return (
    <StoryShell
      kicker="Display Buffer"
      title="Page through terminal history without losing the live tail."
      copy="The terminal viewport now exposes a real display buffer with page up/down, wheel scrolling, and auto-follow. Scroll back, append more output, then return to the bottom when you are ready to follow the stream again."
      footer={
        <ul className="sb-retro-note-list">
          <li>Focus the LCD, then use PageUp, PageDown, Home, End, or the mouse wheel.</li>
          <li>Appending new output while scrolled back should keep the visible window anchored.</li>
        </ul>
      }
    >
      <div className="sb-retro-toolbar">
        <button
          className="sb-retro-button"
          type="button"
          data-display-buffer-action="append"
          onClick={() => {
            const nextLineNumber = lineNumber + 1;
            controller.writeln(`line-${String(nextLineNumber).padStart(2, "0")}  live append`);
            setLineNumber(nextLineNumber);
          }}
        >
          Append live line
        </button>
      </div>
      <Stage maxWidth={820}>
        <RetroLcd mode="terminal" controller={controller} />
      </Stage>
    </StoryShell>
  );
}

function ResponsivePanelStory() {
  const widths = [
    { label: "Compact", value: 420 },
    { label: "Balanced", value: 620 },
    { label: "Wide", value: 840 }
  ];
  const [width, setWidth] = useState(widths[1].value);
  const [geometry, setGeometry] = useState<RetroLcdGeometry | null>(null);

  return (
    <StoryShell
      kicker="Responsive Geometry"
      title="Let the grid find its own measure."
      copy="The display sizes itself from the available space, then reports rows and columns back out when you need to align content or external state."
      footer={
        <div className="sb-retro-status">
          <span className="sb-retro-measure">
            {geometry ? `${geometry.rows} rows` : "measuring"}
          </span>
          <span className="sb-retro-measure">
            {geometry ? `${geometry.cols} cols` : "measuring"}
          </span>
          <span className="sb-retro-measure">
            {geometry ? `${Math.round(geometry.cellWidth)}px cells` : "measuring"}
          </span>
        </div>
      }
    >
      <div className="sb-retro-toolbar">
        {widths.map((entry) => (
          <button
            className="sb-retro-button"
            type="button"
            key={entry.label}
            data-active={entry.value === width}
            onClick={() => setWidth(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <Stage maxWidth={width}>
        <RetroLcd
          mode="value"
          color={STORY_COLOR}
          value="A single component can live in a hero panel, a narrow card, or a command rail without losing the grid."
          onGeometryChange={setGeometry}
        />
      </Stage>
    </StoryShell>
  );
}

function DisplayColorModesStory() {
  return (
    <StoryShell
      kicker="Display Color Modes"
      title="Keep semantic terminal color separate from the screen palette."
      copy="These modes all read from the same terminal state. The phosphor variants deliberately collapse color into a retro family, while the ANSI modes preserve palette intent."
      footer={
        <ul className="sb-retro-note-list">
          <li>Phosphor modes keep the LCD personality even when the source emits ANSI styling.</li>
          <li>`ansi-classic` targets the 16-color profile.</li>
          <li>`ansi-extended` preserves 256-color and truecolor cells.</li>
        </ul>
      }
    >
      <div className="sb-retro-grid sb-retro-grid--double">
        <DisplayColorModeCard
          displayColorMode="phosphor-green"
          title="Phosphor green"
          copy="The default projection for a clean monochrome terminal look."
        >
          <RetroLcd
            mode="terminal"
            displayColorMode="phosphor-green"
            value={[
              "\u001b[1mREADY\u001b[0m status window attached",
              "\u001b[31mwarning\u001b[0m still resolves into the green family"
            ].join("\r\n")}
          />
        </DisplayColorModeCard>
        <DisplayColorModeCard
          displayColorMode="phosphor-amber"
          title="Phosphor amber"
          copy="A warmer monochrome mode for calmer control-room styling."
        >
          <RetroLcd
            mode="terminal"
            displayColorMode="phosphor-amber"
            value={[
              "\u001b[1mREADY\u001b[0m maintenance lane open",
              "\u001b[34mtelemetry\u001b[0m still maps into amber light"
            ].join("\r\n")}
          />
        </DisplayColorModeCard>
        <DisplayColorModeCard
          displayColorMode="phosphor-ice"
          title="Phosphor ice"
          copy="A cooler monochrome palette when the vintage green is too heavy."
        >
          <RetroLcd
            mode="terminal"
            displayColorMode="phosphor-ice"
            value={[
              "\u001b[1mREADY\u001b[0m cool lane online",
              "\u001b[35mstatus\u001b[0m collapses into the ice palette"
            ].join("\r\n")}
          />
        </DisplayColorModeCard>
        <DisplayColorModeCard
          displayColorMode="ansi-classic"
          title="ANSI classic"
          copy="Preserves the 16-color terminal palette while keeping the LCD frame."
        >
          <RetroLcd
            mode="terminal"
            displayColorMode="ansi-classic"
            cursorMode="hollow"
            value={[
              "\u001b[31;44mALERT\u001b[0m \u001b[32mclear path\u001b[0m",
              "\u001b[93mbright yellow\u001b[0m on terminal glass"
            ].join("\r\n")}
          />
        </DisplayColorModeCard>
        <DisplayColorModeCard
          displayColorMode="ansi-extended"
          title="ANSI extended"
          copy="Carries indexed 256-color and truecolor output directly into the screen."
        >
          <RetroLcd
            mode="terminal"
            displayColorMode="ansi-extended"
            cursorMode="hollow"
            value={[
              "\u001b[38;5;196;48;5;25mINDEXED 196/25\u001b[0m",
              "\u001b[38;2;17;34;51;48;2;68;85;102mTRUECOLOR 17,34,51\u001b[0m"
            ].join("\r\n")}
          />
        </DisplayColorModeCard>
      </div>
    </StoryShell>
  );
}

function FeatureTourStory() {
  const [tick, setTick] = useState(0);
  const cycleMs = 30000;
  const now = tick % cycleMs;

  useEffect(() => {
    const startedAt = window.performance.now();
    const timer = window.setInterval(() => {
      setTick(window.performance.now() - startedAt);
    }, 80);

    return () => window.clearInterval(timer);
  }, []);

  const clampProgress = (start: number, end: number) =>
    Math.max(0, Math.min(1, (now - start) / (end - start)));
  const take = (text: string, progress: number) =>
    text.slice(0, Math.max(1, Math.round(text.length * progress)));

  let phase: {
    badge: string;
    title: string;
    copy: string;
    badges: string[];
    node: ReactNode;
  };

  if (now < 7200) {
    const message = "WAKE THE GRID.\nLET THE FIRST IMPRESSION FEEL LIT FROM WITHIN.";
    phase = {
      badge: "Passive display",
      title: "Start with pure output.",
      copy: "Value mode is the quietest path in. Hand it a string and it becomes a terminal-like display with wrapping, glow, and geometry baked in.",
      badges: ["value mode", "controlled text", "zero controller"],
      node: (
        <RetroLcd
          key="feature-tour-display"
          mode="value"
          color={STORY_COLOR}
          value={take(message, clampProgress(0, 5800))}
        />
      )
    };
  } else if (now < 14800) {
    const draft = "Compose inline.\nPress Enter when the thought lands.";
    phase = {
      badge: "Editable mode",
      title: "Promote it into a drafting surface.",
      copy: "Turn on `editable` and the same component becomes an input with cursor handling, placeholders, submission hooks, and multi-line support.",
      badges: ["editable", "cursor aware", "submit hooks"],
      node: (
        <RetroLcd
          key="feature-tour-editable"
          mode="value"
          editable
          autoFocus
          color={STORY_COLOR}
          value={take(draft, clampProgress(7200, 14000))}
          placeholder="Wait for the cursor..."
        />
      )
    };
  } else if (now < 22600) {
    const frames = [
      "BOOT  react-retro-display-tty-ansi",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured\n\u001b[1mREADY\u001b[0m ansi parser online",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured\n\u001b[1mREADY\u001b[0m ansi parser online\n\u001b[2msoft notes stay readable without stealing focus\u001b[0m",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured\n\u001b[1mREADY\u001b[0m ansi parser online\n\u001b[2msoft notes stay readable without stealing focus\u001b[0m\n\u001b[7mLIVE\u001b[0m controller-friendly output",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured\n\u001b[1mREADY\u001b[0m ansi parser online\n\u001b[2msoft notes stay readable without stealing focus\u001b[0m\n\u001b[7mLIVE\u001b[0m controller-friendly output\n\u001b[5mPULSE\u001b[0m waiting for next command"
    ];
    const progress = clampProgress(14800, 22000);
    const frameIndex = Math.min(frames.length - 1, Math.floor(progress * frames.length));

    phase = {
      badge: "Terminal stream",
      title: "Feed it real terminal output.",
      copy: "Terminal mode renders ANSI styling, scroll behavior, and cursor state, so logs and pseudo-TTYs can stay visually expressive without extra mapping.",
      badges: ["ansi", "scrolling buffer", "controller ready"],
      node: (
        <RetroLcd
          key="feature-tour-terminal"
          mode="terminal"
          color={STORY_COLOR}
          cursorMode="solid"
          value={frames[frameIndex]}
        />
      )
    };
  } else {
    const command = "status --calm";
    phase = {
      badge: "Prompt loop",
      title: "Close with a focused command line.",
      copy: "Prompt mode keeps the transcript shape tight. It is a small but expressive layer for command palettes, maintenance shells, and guided interactions.",
      badges: ["prompt session", "accept or reject", "guided commands"],
      node: (
        <RetroLcd
          key="feature-tour-prompt"
          mode="prompt"
          autoFocus
          color={STORY_COLOR}
          promptChar="$"
          value={command.slice(0, Math.max(1, Math.round(command.length * clampProgress(22600, 29400))))}
        />
      )
    };
  }

  return (
    <div className="sb-retro-page">
      <div className="sb-retro-feature-shell" data-feature-tour-root="true">
        <div className="sb-retro-feature-copy">
          <span className="sb-retro-kicker">Feature Tour</span>
          <span className="sb-retro-badge">{phase.badge}</span>
          <h1 className="sb-retro-title">{phase.title}</h1>
          <p className="sb-retro-copy">{phase.copy}</p>
          <div className="sb-retro-feature-badges">
            {phase.badges.map((badge) => (
              <span className="sb-retro-badge" key={badge}>
                {badge}
              </span>
            ))}
          </div>
        </div>
        <div className="sb-retro-feature-stage">{phase.node}</div>
      </div>
    </div>
  );
}

const meta = {
  title: "RetroLcd",
  component: RetroLcd,
  tags: ["autodocs"],
  args: {
    color: STORY_COLOR
  }
} satisfies Meta<typeof RetroLcd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CalmReadout: Story = {
  args: {
    mode: "value",
    value:
      "A small retro surface for status, prompts, notes, and ANSI-flavored terminal output.",
    color: STORY_COLOR
  },
  render: (args) => (
    <StoryShell
      kicker="Read-Only Display"
      title="Show a message without ceremony."
      copy="The simplest user story is still worth making beautiful: drop in a value, keep the surface quiet, and let the component own wrapping, spacing, and the retro glow."
      footer={<div className="sb-retro-status">Best when the display is pure output.</div>}
    >
      <Stage>
        <RetroLcd {...args} />
      </Stage>
    </StoryShell>
  )
};

export const EditableNotebook: Story = {
  render: () => <EditableNotebookStory />
};

export const TerminalStream: Story = {
  render: () => <TerminalStreamStory />
};

export const AnsiSurface: Story = {
  render: () => (
    <StoryShell
      kicker="ANSI Styling"
      title="Use terminal emphasis without a browser theme system."
      copy="The terminal renderer already understands bold, faint, inverse, conceal, and blink sequences, so existing ANSI-flavored strings can stay intact."
      footer={
        <ul className="sb-retro-note-list">
          <li>Useful when your source text already contains terminal styling codes.</li>
          <li>Inverse and faint states map cleanly onto the LCD-inspired palette.</li>
        </ul>
      }
    >
      <Stage>
        <RetroLcd
          mode="terminal"
          color={STORY_COLOR}
          cursorMode="hollow"
          value={[
            "\u001b[1mBOLD\u001b[0m emphasis for positive signals",
            "\u001b[2mFAINT\u001b[0m context that should recede",
            "\u001b[7mINVERSE\u001b[0m state changes that need contrast",
            "conceal -> [\u001b[8mhidden payload\u001b[0m]",
            "\u001b[5mBLINK\u001b[0m for urgent but sparing motion"
          ].join("\n")}
        />
      </Stage>
    </StoryShell>
  )
};

export const PromptLoop: Story = {
  render: () => <PromptConsoleStory />
};

export const ResponsivePanel: Story = {
  render: () => <ResponsivePanelStory />
};

export const DisplayColorModes: Story = {
  render: () => <DisplayColorModesStory />
};

export const ControlCharacterReplay: Story = {
  render: () => <ControlCharacterReplayStory />
};

export const DisplayBuffer: Story = {
  render: () => <DisplayBufferStory />
};

export const FeatureTour: Story = {
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <FeatureTourStory />
};

export const QuietOutputDemo: Story = {
  name: "Capture / Quiet Output Demo",
  parameters: {
    controls: {
      disable: true
    },
    docs: {
      disable: true
    }
  },
  render: () => <QuietOutputDemoStory />
};

export const EditableModeDemo: Story = {
  name: "Capture / Editable Mode Demo",
  parameters: {
    controls: {
      disable: true
    },
    docs: {
      disable: true
    }
  },
  render: () => <EditableModeDemoStory />
};

export const TerminalModeDemo: Story = {
  name: "Capture / Terminal Mode Demo",
  parameters: {
    controls: {
      disable: true
    },
    docs: {
      disable: true
    }
  },
  render: () => <TerminalModeDemoStory />
};

export const PromptModeDemo: Story = {
  name: "Capture / Prompt Mode Demo",
  parameters: {
    controls: {
      disable: true
    },
    docs: {
      disable: true
    }
  },
  render: () => <PromptModeDemoStory />
};

export const DisplayColorModesDemo: Story = {
  name: "Capture / Display Color Modes Demo",
  parameters: {
    controls: {
      disable: true
    },
    docs: {
      disable: true
    }
  },
  render: () => <DisplayColorModesDemoStory />
};

export const ControlCharacterReplayDemo: Story = {
  name: "Capture / Control Character Replay Demo",
  parameters: {
    controls: {
      disable: true
    },
    docs: {
      disable: true
    }
  },
  render: () => <ControlCharacterReplayDemoStory />
};
