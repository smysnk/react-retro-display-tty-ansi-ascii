import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type {
  RetroScreenDisplayCharacterSizingMode,
  RetroScreenDisplayColorMode,
  RetroScreenDisplayFontSizingMode,
  RetroScreenDisplayLayoutMode,
  RetroScreenDisplayPadding,
  RetroScreenDisplaySurfaceMode
} from "../core/types";
import { createRetroScreenController } from "../core/terminal/controller";
import { RetroScreen } from "../react/RetroScreen";
import {
  createApple2BasicShellSession,
  type Apple2BasicShellState
} from "./apple2-basic/apple2-basic-shell-session";
import {
  apple2Dos33BootLines,
  apple2Dos33BootPromptScript,
  apple2BasicPhase5DemoScript,
  type Apple2BasicDemoScriptStep
} from "./apple2-basic/apple2-basic-fixtures";

const STORY_COLOR = "#ffc76d";
const APPLE2_ROWS = 24;
const APPLE2_COLS = 40;
const APPLE2_DOS33_ROWS = 12;
const APPLE2_DOS33_COLS = 80;
const APPLE2_STAGE_MAX_WIDTH = 860;
const APPLE2_SCREEN_HEIGHT = "clamp(420px, 58vw, 560px)";
const APPLE2_DISPLAY_FONT_SCALE = 1.18;
const APPLE2_DISPLAY_ROW_SCALE = 1.08;
const APPLE2_DISPLAY_PADDING = {
  block: 8,
  inline: 10
} as const;
const APPLE2_DOS33_STAGE_MAX_WIDTH = 1480;
const APPLE2_DOS33_COLOR = "#35f6e0";
const APPLE2_DOS33_SCREEN_STYLE = {
  width: "100%",
  "--retro-screen-font-family": "AnsiIBMVGA",
  "--retro-screen-bg-top": "#030605",
  "--retro-screen-bg-bottom": "#010201"
} as CSSProperties;
const APPLE2_DOS33_DISPLAY_PADDING = {
  block: 8,
  inline: 10
} as const;

type StoryShellProps = {
  kicker: string;
  title: string;
  copy: string;
  children: ReactNode;
  footer?: ReactNode;
  shellMaxWidth?: number;
};

type Apple2BasicShellSurfaceProps = {
  scriptedSteps?: readonly Apple2BasicDemoScriptStep[];
  bootLines?: readonly string[];
  rows?: number;
  cols?: number;
  resetOnInteract?: boolean;
  screenColor?: string;
  displayColorMode?: RetroScreenDisplayColorMode;
  displaySurfaceMode?: RetroScreenDisplaySurfaceMode;
  displayLayoutMode?: RetroScreenDisplayLayoutMode;
  displayLayoutMaxHeight?: number;
  displayFontSizingMode?: RetroScreenDisplayFontSizingMode;
  displayCharacterSizingMode?: RetroScreenDisplayCharacterSizingMode;
  displayPadding?: RetroScreenDisplayPadding;
  displayFontScale?: number;
  displayRowScale?: number;
  displayScanlines?: boolean;
  disableCellRowScale?: boolean;
  focusGlow?: boolean;
  screenClassName?: string;
  screenStyle?: CSSProperties;
};

const buildShellDisplayText = (state: Apple2BasicShellState) => {
  if (!state.booted) {
    return "";
  }

  const liveInputLine =
    state.inputPrefix === null ? [] : [`${state.inputPrefix}${state.currentInput}`];

  return [...state.transcriptLines, ...liveInputLine].join("\r\n");
};

function StoryShell({ kicker, title, copy, children, footer, shellMaxWidth }: StoryShellProps) {
  return (
    <div className="sb-retro-page">
      <div
        className="sb-retro-shell"
        style={shellMaxWidth ? { width: `min(${shellMaxWidth}px, 100%)` } : undefined}
      >
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

function Stage({
  children,
  maxWidth = 720,
  framePaddingInline
}: {
  children: ReactNode;
  maxWidth?: number;
  framePaddingInline?: CSSProperties["paddingInline"];
}) {
  return (
    <div className="sb-retro-stage">
      <div
        className="sb-retro-frame"
        style={{
          maxWidth,
          ...(framePaddingInline
            ? {
                paddingInline: framePaddingInline,
                boxSizing: "border-box"
              }
            : null)
        }}
      >
        {children}
      </div>
    </div>
  );
}

function CaptureStage({
  captureId,
  children,
  maxWidth = 720
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

const playApple2BasicDemoScript = (
  session: ReturnType<typeof createApple2BasicShellSession>,
  steps: readonly Apple2BasicDemoScriptStep[]
) => {
  const timers: number[] = [];
  let nextAt = 280;

  for (const step of steps) {
    const typingDelayMs = step.typingDelayMs ?? 80;

    for (const character of step.text) {
      timers.push(
        window.setTimeout(() => {
          session.handleInputBytes(character);
        }, nextAt)
      );
      nextAt += typingDelayMs;
    }

    if (step.submit) {
      timers.push(
        window.setTimeout(() => {
          session.handleInputBytes("\r");
        }, nextAt)
      );
      nextAt += 120;
    }

    nextAt += step.afterDelayMs ?? 220;
  }

  return () => {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
  };
};

function Apple2BasicShellSurface({
  scriptedSteps,
  bootLines,
  rows = APPLE2_ROWS,
  cols = APPLE2_COLS,
  resetOnInteract = false,
  screenColor = STORY_COLOR,
  displayColorMode = "phosphor-amber",
  displaySurfaceMode = "dark",
  displayLayoutMode,
  displayLayoutMaxHeight,
  displayFontSizingMode,
  displayCharacterSizingMode,
  displayPadding = APPLE2_DISPLAY_PADDING,
  displayFontScale = APPLE2_DISPLAY_FONT_SCALE,
  displayRowScale = APPLE2_DISPLAY_ROW_SCALE,
  displayScanlines = true,
  disableCellRowScale = false,
  focusGlow = true,
  screenClassName,
  screenStyle
}: Apple2BasicShellSurfaceProps) {
  const [controller] = useState(() =>
    createRetroScreenController({
      rows,
      cols,
      scrollback: 400,
      cursorMode: "solid"
    })
  );
  const [session] = useState(() => {
    const nextSession = createApple2BasicShellSession({
      bootLines
    });
    nextSession.boot();
    return nextSession;
  });
  const [shellState, setShellState] = useState<Apple2BasicShellState>(() => session.getState());
  const scriptedOnceRef = useRef(false);
  const scriptedCleanupRef = useRef<(() => void) | null>(null);
  const scriptedResetRef = useRef(false);

  useEffect(() => session.subscribe(() => setShellState(session.getState())), [session]);

  useEffect(() => {
    controller.batch(() => {
      controller.reset();
      controller.write(buildShellDisplayText(shellState));
      controller.setCursorMode("solid");
      controller.setCursorVisible(true);
    });
  }, [controller, shellState]);

  useEffect(() => {
    if (!scriptedSteps || scriptedOnceRef.current || scriptedResetRef.current) {
      return;
    }

    scriptedOnceRef.current = true;
    const cleanup = playApple2BasicDemoScript(session, scriptedSteps);
    scriptedCleanupRef.current = cleanup;

    return () => {
      cleanup();
      if (scriptedCleanupRef.current === cleanup) {
        scriptedCleanupRef.current = null;
      }
    };
  }, [scriptedSteps, session]);

  const handleUserReset = () => {
    if (!resetOnInteract) {
      return;
    }

    scriptedResetRef.current = true;
    scriptedCleanupRef.current?.();
    scriptedCleanupRef.current = null;
    session.reset();
  };

  return (
    <RetroScreen
      mode="terminal"
      controller={controller}
      autoFocus
      className={screenClassName ?? "sb-apple2-screen"}
      color={screenColor}
      displayColorMode={displayColorMode}
      displaySurfaceMode={displaySurfaceMode}
      displayLayoutMode={displayLayoutMode}
      displayLayoutMaxHeight={displayLayoutMaxHeight}
      displayFontSizingMode={displayFontSizingMode}
      displayCharacterSizingMode={displayCharacterSizingMode}
      displayPadding={displayPadding}
      displayFontScale={displayFontScale}
      displayRowScale={displayRowScale}
      displayScanlines={displayScanlines}
      disableCellRowScale={disableCellRowScale}
      focusGlow={focusGlow}
      gridMode="static"
      rows={rows}
      cols={cols}
      style={screenStyle ?? { height: APPLE2_SCREEN_HEIGHT }}
      onMouseDownCapture={handleUserReset}
      onTouchStartCapture={handleUserReset}
      onTerminalData={(data) => {
        session.handleInputBytes(data);
      }}
    />
  );
}

export function Apple2BasicShellStory() {
  return (
    <StoryShell
      kicker="Apple II BASIC"
      title="Boot a tiny BASIC shell inside Storybook."
      copy="Phase 5 polishes the Apple II BASIC demo into both an interactive playground and a deterministic docs surface. The shell keeps the live INPUT/BREAK runtime while adding a scripted capture flow for stable demos."
      footer={
        <>
          <ul className="sb-retro-note-list">
            <li>Try `10 INPUT "NAME"; A$`, `20 PRINT "HELLO " + A$`, then `RUN`.</li>
            <li>Use `CTRL+C` while a program is running or waiting for input to trigger `BREAK`.</li>
            <li>The capture/demo variant now auto-types a short program so docs can render a stable preview.</li>
          </ul>
          <div className="sb-retro-status">
            Phase 5 pairs a live shell with a deterministic demo script.
          </div>
        </>
      }
    >
      <Stage maxWidth={APPLE2_STAGE_MAX_WIDTH}>
        <Apple2BasicShellSurface />
      </Stage>
    </StoryShell>
  );
}

export function Apple2BasicDemoStory() {
  return (
    <CaptureStage captureId="apple2-basic-shell" maxWidth={APPLE2_STAGE_MAX_WIDTH}>
      <Apple2BasicShellSurface scriptedSteps={apple2BasicPhase5DemoScript} />
    </CaptureStage>
  );
}

export function Apple2Dos33BootPromptStory() {
  return (
    <StoryShell
      kicker="Apple II DOS 3.3"
      title="Watch a DOS 3.3-style Apple prompt wake up."
      copy="This story progressively builds a BASIC program on load, pausing to `RUN` it at a few milestones before ending on an interactive prompt. Click the terminal at any point and it will reset back to the blank boot screen so you can take over from a clean prompt."
      shellMaxWidth={1560}
      footer={
        <div className="sb-retro-status">
          Auto-types a progressively more complex BASIC demo, then resets to a clean boot prompt when you click the terminal.
        </div>
      }
    >
      <Stage maxWidth={APPLE2_DOS33_STAGE_MAX_WIDTH} framePaddingInline={28}>
        <Apple2BasicShellSurface
          bootLines={apple2Dos33BootLines}
          rows={APPLE2_DOS33_ROWS}
          cols={APPLE2_DOS33_COLS}
          scriptedSteps={apple2Dos33BootPromptScript}
          resetOnInteract
          screenColor={APPLE2_DOS33_COLOR}
          displayColorMode="phosphor-ice"
          displayLayoutMode="fit-width"
          displayFontSizingMode="fit-cols"
          displayPadding={APPLE2_DOS33_DISPLAY_PADDING}
          displayFontScale={1.04}
          displayRowScale={1}
          displayScanlines
          disableCellRowScale
          focusGlow={false}
          screenClassName="sb-apple2-screen sb-apple2-dos33-screen"
          screenStyle={APPLE2_DOS33_SCREEN_STYLE}
        />
      </Stage>
    </StoryShell>
  );
}

const meta = {
  title: "RetroScreen/Apple II DOS 3.3",
  component: RetroScreen,
  includeStories: ["Apple2Dos33Story"],
  parameters: {
    controls: {
      disable: true
    }
  }
} satisfies Meta<typeof RetroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Apple2Dos33Story: Story = {
  name: "Apple II DOS 3.3",
  args: {
    mode: "terminal"
  },
  render: () => <Apple2Dos33BootPromptStory />
};
