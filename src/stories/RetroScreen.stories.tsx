import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
  type ReactNode
} from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { progressRewriteTraceFixture } from "../core/terminal/conformance/fixtures/real-world/progress-rewrite.trace.fixture";
import { shellSessionTraceFixture } from "../core/terminal/conformance/fixtures/real-world/shell-session.trace.fixture";
import { statusPaneTraceFixture } from "../core/terminal/conformance/fixtures/real-world/status-pane.trace.fixture";
import { createRetroScreenController } from "../core/terminal/controller";
import { createRetroScreenWebSocketSession } from "../core/terminal/websocket-session";
import type { RetroScreenDisplayColorMode, RetroScreenGeometry } from "../core/types";
import { RetroScreen as RetroScreenBase } from "../react/RetroScreen";
import { RetroScreenAnsiPlayer } from "../react/RetroScreenAnsiPlayer";
import type { RetroScreenAnsiPlayerState } from "../react/useRetroScreenAnsiPlayer";
import { loadBadAppleAnsiAsset, type BadAppleAnsiAsset } from "./bad-apple-ansi";
import {
  streamBadAppleGzipAnsiAsset,
  type BadAppleGzipAnsiAsset
} from "./bad-apple-gzip-ansi";
import { AnsiGalleryViewer } from "./ansi-gallery";
import { MatrixCodeRainScreen } from "./matrix-code-rain";

const STORY_COLOR = "#97ff9b";

type StoryShellProps = {
  kicker: string;
  title: string;
  copy: string;
  children: ReactNode;
  footer?: ReactNode;
};

type BadApplePlaybackPhase = "loading" | "playing" | "failed";

type DisplayColorModeCardProps = {
  displayColorMode: RetroScreenDisplayColorMode;
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

type TerminalProbeSize = {
  width: number;
  height: number;
};

type ProbeBorderStyle = {
  id: string;
  label: string;
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
};

type ProbeGlyphStyle = {
  id: string;
  label: string;
  glyphs: Record<string, string[]>;
};

type ProbeSceneState = {
  displayColorMode: RetroScreenDisplayColorMode;
  borderStyleLabel: string;
  glyphStyleLabel: string;
};

type ProbeRedrawMeta = {
  sequence: number;
  reason: "live-update" | "transition-settle";
  rows: number;
  cols: number;
};

type LiveTtyDemoConfig = {
  url: string;
  openPayload?: Record<string, unknown>;
};

type LiveTtyStageSize = {
  id: string;
  label: string;
  width: number;
  height: number;
};

type ScriptedResizeHandle =
  | "right"
  | "bottom"
  | "bottom-right"
  | "left"
  | "top"
  | "top-left";

type DemoCursorRole = "pointer" | "ew-resize" | "ns-resize" | "nwse-resize";

type DemoCursorState = {
  visible: boolean;
  x: number;
  y: number;
  role: DemoCursorRole;
  dragging: boolean;
};

type ScriptedResizeStep = {
  id: string;
  label: string;
  handle: ScriptedResizeHandle;
  targetWidth?: number;
  targetHeight?: number;
  travelMs?: number;
  dragMs?: number;
  settleMs?: number;
};

type ScriptedResizePlaybackOptions = {
  stageRef: RefObject<HTMLDivElement | null>;
  targetRef: RefObject<HTMLDivElement | null>;
  paused: boolean;
  steps: readonly ScriptedResizeStep[];
  loop?: boolean;
  startDelayMs?: number;
  onResizeFrame?: (size: { width: number; height: number }) => void;
  onStepComplete?: (step: ScriptedResizeStep) => void;
};

type ResizablePanelLiveSurfaceProps = {
  capture?: boolean;
  leadingFocus?: boolean;
  onPauseChange?: (paused: boolean) => void;
  onActiveStepLabelChange?: (label: string) => void;
  onGeometryChange?: (geometry: RetroScreenGeometry | null) => void;
};

const DEFAULT_LIVE_TTY_URL = "ws://127.0.0.1:8787";
const initialDemoCursorState: DemoCursorState = {
  visible: false,
  x: 28,
  y: 28,
  role: "pointer",
  dragging: false
};
const scriptedResizeCursorRoleByHandle: Record<ScriptedResizeHandle, DemoCursorRole> = {
  right: "ew-resize",
  bottom: "ns-resize",
  "bottom-right": "nwse-resize",
  left: "ew-resize",
  top: "ns-resize",
  "top-left": "nwse-resize"
};
const resizablePanelInitialSize = {
  width: 672,
  height: 328
};
const resizablePanelLiveSteps: ScriptedResizeStep[] = [
  {
    id: "right-grow",
    label: "right edge",
    handle: "right",
    targetWidth: 760,
    travelMs: 540,
    dragMs: 1100,
    settleMs: 720
  },
  {
    id: "bottom-grow",
    label: "bottom edge",
    handle: "bottom",
    targetHeight: 388,
    travelMs: 420,
    dragMs: 980,
    settleMs: 680
  },
  {
    id: "left-trim",
    label: "left edge",
    handle: "left",
    targetWidth: 700,
    travelMs: 480,
    dragMs: 940,
    settleMs: 660
  },
  {
    id: "top-trim",
    label: "top edge",
    handle: "top",
    targetHeight: 340,
    travelMs: 420,
    dragMs: 920,
    settleMs: 640
  },
  {
    id: "corner-grow",
    label: "bottom-right corner",
    handle: "bottom-right",
    targetWidth: 812,
    targetHeight: 408,
    travelMs: 500,
    dragMs: 1140,
    settleMs: 760
  },
  {
    id: "corner-return",
    label: "top-left corner",
    handle: "top-left",
    targetWidth: resizablePanelInitialSize.width,
    targetHeight: resizablePanelInitialSize.height,
    travelMs: 500,
    dragMs: 1180,
    settleMs: 820
  }
];
const resizablePanelLeadingSteps: ScriptedResizeStep[] = [
  {
    id: "top-left-grow",
    label: "top-left corner",
    handle: "top-left",
    targetWidth: 792,
    targetHeight: 392,
    travelMs: 560,
    dragMs: 1180,
    settleMs: 760
  },
  {
    id: "left-balance",
    label: "left edge",
    handle: "left",
    targetWidth: 716,
    travelMs: 420,
    dragMs: 980,
    settleMs: 680
  },
  {
    id: "top-balance",
    label: "top edge",
    handle: "top",
    targetHeight: 340,
    travelMs: 420,
    dragMs: 940,
    settleMs: 660
  },
  {
    id: "bottom-right-reset",
    label: "bottom-right corner",
    handle: "bottom-right",
    targetWidth: resizablePanelInitialSize.width,
    targetHeight: resizablePanelInitialSize.height,
    travelMs: 520,
    dragMs: 1160,
    settleMs: 820
  }
];

const RetroScreen = (props: ComponentProps<typeof RetroScreenBase>) => (
  <RetroScreenBase
    {...props}
    resizable={props.resizable ?? true}
    resizableLeadingEdges={props.resizableLeadingEdges ?? true}
  />
);

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });

const TERMINAL_SIZE_QUERY = "\u001b[18t";
const PROBE_RESET = "\u001b[0m";
const PROBE_BOLD = "\u001b[1m";
const PROBE_FAINT = "\u001b[2m";
const probeDisplayColorModes: RetroScreenDisplayColorMode[] = [
  "phosphor-green",
  "phosphor-amber",
  "phosphor-ice",
  "ansi-classic",
  "ansi-extended"
];
const probeBorderStyles: ProbeBorderStyle[] = [
  {
    id: "ascii",
    label: "ascii",
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    horizontal: "-",
    vertical: "|"
  },
  {
    id: "single-line",
    label: "single-line",
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│"
  },
  {
    id: "rounded",
    label: "rounded",
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│"
  },
  {
    id: "double",
    label: "double-line",
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║"
  },
  {
    id: "heavy",
    label: "heavy",
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "━",
    vertical: "┃"
  }
];
const classicProbeGlyphs: Record<string, string[]> = {
  "0": [" ### ", "#   #", "#   #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "  #  ", "  #  ", " ### "],
  "2": [" ### ", "#   #", "   # ", "  #  ", "#####"],
  "3": ["#### ", "    #", " ### ", "    #", "#### "],
  "4": ["#  # ", "#  # ", "#####", "   # ", "   # "],
  "5": ["#####", "#    ", "#### ", "    #", "#### "],
  "6": [" ### ", "#    ", "#### ", "#   #", " ### "],
  "7": ["#####", "   # ", "  #  ", " #   ", " #   "],
  "8": [" ### ", "#   #", " ### ", "#   #", " ### "],
  "9": [" ### ", "#   #", " ####", "    #", " ### "],
  "x": ["#   #", " # # ", "  #  ", " # # ", "#   #"]
};
const outlineProbeGlyphs: Record<string, string[]> = {
  "0": ["╭──╮", "│  │", "│  │", "│  │", "╰──╯"],
  "1": [" ╭╮ ", "  │ ", "  │ ", "  │ ", " ╰╯ "],
  "2": ["╭──╮", "  ─┤", "╭─╯ ", "│   ", "╰──╯"],
  "3": ["╭──╮", "  ─┤", " ──┤", "  ─┤", "╰──╯"],
  "4": ["│  │", "│  │", "╰──┤", "   │", "   ╵"],
  "5": ["╭──╮", "│   ", "╰──╮", "   │", "╰──╯"],
  "6": ["╭──╮", "│   ", "├──╮", "│  │", "╰──╯"],
  "7": ["╭──╮", "  ─┤", "  ╱ ", " ╱  ", "╱   "],
  "8": ["╭──╮", "├──┤", "├──┤", "│  │", "╰──╯"],
  "9": ["╭──╮", "│  │", "╰──┤", "   │", "╰──╯"],
  "x": ["╲  ╱", " ╲╱ ", " ╱╲ ", "╱  ╲", "    "]
};
const doubleProbeGlyphs: Record<string, string[]> = {
  "0": ["╔══╗", "║  ║", "║  ║", "║  ║", "╚══╝"],
  "1": [" ╔╗ ", "═╣║ ", " ║║ ", " ║║ ", "═╩╩═"],
  "2": ["╔══╗", "  ═╣", "╔═╝ ", "║   ", "╚══╝"],
  "3": ["╔══╗", "  ═╣", " ══╣", "  ═╣", "╚══╝"],
  "4": ["║  ║", "║  ║", "╚══╣", "   ║", "   ╵"],
  "5": ["╔══╗", "║   ", "╚══╗", "   ║", "╚══╝"],
  "6": ["╔══╗", "║   ", "╠══╗", "║  ║", "╚══╝"],
  "7": ["╔══╗", "  ═╣", "  ╱ ", " ╱  ", "╱   "],
  "8": ["╔══╗", "╠══╣", "╠══╣", "║  ║", "╚══╝"],
  "9": ["╔══╗", "║  ║", "╚══╣", "   ║", "╚══╝"],
  "x": ["╲  ╱", " ╳  ", " ╳  ", "╱  ╲", "    "]
};
const graffitiProbeGlyphs: Record<string, string[]> = {
  "0": ["█▀▀█", "█  █", "█  █", "█  █", "█▄▄█"],
  "1": [" ▄█ ", "  █ ", "  █ ", "  █ ", "▄██▄"],
  "2": ["█▀▀█", "  ▄▀", " ▀▄ ", "█   ", "█▄▄█"],
  "3": ["█▀▀█", "  ▄▀", "  ▀█", "   █", "█▄▄█"],
  "4": ["█  █", "█  █", "█▄▄█", "   █", "   █"],
  "5": ["█▀▀▀", "█   ", "█▀▀█", "   █", "█▄▄█"],
  "6": ["█▀▀█", "█   ", "█▀▀█", "█  █", "█▄▄█"],
  "7": ["█▀▀█", "   █", "  █ ", " █  ", "█   "],
  "8": ["█▀▀█", "█  █", "█▀▀█", "█  █", "█▄▄█"],
  "9": ["█▀▀█", "█  █", "█▄▄█", "   █", "█▄▄█"],
  "x": ["█  █", " ▀█ ", " ▄▀ ", "█  █", "    "]
};
const probeMonochromeGlyphStyles: ProbeGlyphStyle[] = [
  {
    id: "classic",
    label: "classic blocks",
    glyphs: classicProbeGlyphs
  },
  {
    id: "outline",
    label: "outline",
    glyphs: outlineProbeGlyphs
  },
  {
    id: "double",
    label: "double-line",
    glyphs: doubleProbeGlyphs
  }
];
const graffitiProbeGlyphStyle: ProbeGlyphStyle = {
  id: "graffiti",
  label: "3D graffiti",
  glyphs: graffitiProbeGlyphs
};
const autoResizeProbeSizes: TerminalProbeSize[] = [
  { width: 760, height: 360 },
  { width: 560, height: 420 },
  { width: 840, height: 332 },
  { width: 640, height: 388 }
];
const autoResizeProbeHoldAfterResizeMs = 250;
const autoResizeProbeResizeMs = 720;
const liveTtyStageSizes: LiveTtyStageSize[] = [
  { id: "compact", label: "Compact", width: 560, height: 280 },
  { id: "console", label: "Console", width: 720, height: 340 },
  { id: "wide", label: "Wide", width: 920, height: 420 }
];

declare global {
  interface Window {
    __RETRO_SCREEN_TTY_DEMO__?: LiveTtyDemoConfig;
  }
}

const displayColorModeDemoSteps: {
  displayColorMode: RetroScreenDisplayColorMode;
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

const buildTerminalSizeReply = (rows: number, cols: number) => `\u001b[8;${rows};${cols}t`;

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/gu, "");

const buildAnsiTypedFrames = (value: string) => {
  const frames: string[] = [];
  let current = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "\u001b") {
      let end = index + 1;

      if (value[end] === "[") {
        end += 1;

        while (end < value.length && !/[\u0040-\u007e]/u.test(value[end] ?? "")) {
          end += 1;
        }

        if (end < value.length) {
          end += 1;
        }
      }

      current += value.slice(index, end);
      index = end - 1;
      continue;
    }

    current += character;
    frames.push(current);
  }

  return frames;
};

const resolveAnsiTypedFrame = (frames: string[], progress: number) => {
  if (progress <= 0 || frames.length === 0) {
    return "";
  }

  const visibleCount = Math.min(frames.length, Math.max(1, Math.round(frames.length * progress)));
  return frames[visibleCount - 1] ?? "";
};

const applyAnsi = (code: string, text: string) => `${code}${text}${PROBE_RESET}`;

const colorizeSequence = (text: string, palette: string[]) => {
  let colorIndex = 0;

  const rendered = Array.from(text).map((character) => {
    if (character === " ") {
      return character;
    }

    const color = palette[colorIndex % palette.length] ?? "";
    colorIndex += 1;
    return `${color}${character}`;
  });

  return `${rendered.join("")}${PROBE_RESET}`;
};

const buildProbeTheme = (displayColorMode: RetroScreenDisplayColorMode) => {
  switch (displayColorMode) {
    case "ansi-classic":
      return {
        label: ["\u001b[97m", "\u001b[96m", "\u001b[95m"],
        meta: ["\u001b[93m", "\u001b[97m"],
        topBorder: ["\u001b[96m", "\u001b[94m", "\u001b[95m"],
        sideBorder: ["\u001b[93m", "\u001b[97m"],
        bottomBorder: ["\u001b[92m", "\u001b[93m", "\u001b[91m"],
        glyph: ["\u001b[97m", "\u001b[93m", "\u001b[96m"],
        graffiti: ["\u001b[91m", "\u001b[95m", "\u001b[93m", "\u001b[96m", "\u001b[92m"],
        graffitiShadow: "\u001b[90m"
      };
    case "ansi-extended":
      return {
        label: ["\u001b[38;2;255;240;196m", "\u001b[38;2;192;246;255m"],
        meta: ["\u001b[38;2;168;220;255m", "\u001b[38;2;255;205;117m"],
        topBorder: [
          "\u001b[38;2;116;255;224m",
          "\u001b[38;2;92;189;255m",
          "\u001b[38;2;199;128;255m"
        ],
        sideBorder: ["\u001b[38;2;255;214;92m", "\u001b[38;2;255;102;186m"],
        bottomBorder: [
          "\u001b[38;2;255;150;92m",
          "\u001b[38;2;255;214;92m",
          "\u001b[38;2;120;255;168m"
        ],
        glyph: ["\u001b[38;2;214;255;250m", "\u001b[38;2;255;232;171m"],
        graffiti: [
          "\u001b[38;2;255;96;142m",
          "\u001b[38;2;255;176;85m",
          "\u001b[38;2;255;240;103m",
          "\u001b[38;2;114;255;223m",
          "\u001b[38;2;90;171;255m"
        ],
        graffitiShadow: "\u001b[38;2;66;18;102m"
      };
    default:
      return {
        label: [PROBE_BOLD, PROBE_FAINT],
        meta: [PROBE_FAINT],
        topBorder: [PROBE_BOLD, PROBE_FAINT],
        sideBorder: [PROBE_FAINT, PROBE_BOLD],
        bottomBorder: [PROBE_BOLD, PROBE_FAINT],
        glyph: [PROBE_BOLD, PROBE_FAINT],
        graffiti: [PROBE_BOLD, PROBE_FAINT],
        graffitiShadow: PROBE_FAINT
      };
  }
};

const parseTerminalSizeReply = (reply: string) => {
  const match = /^\u001b\[8;(\d+);(\d+)t$/u.exec(reply);

  if (!match) {
    return null;
  }

  return {
    rows: Number.parseInt(match[1] ?? "0", 10),
    cols: Number.parseInt(match[2] ?? "0", 10)
  };
};

const buildAutoResizeProbeSteps = (sizes: readonly TerminalProbeSize[]): ScriptedResizeStep[] => {
  const targets = [...sizes.slice(1), sizes[0]].filter(
    (size): size is TerminalProbeSize => size !== undefined
  );

  return targets.map((size, index) => ({
    id: `probe-${index + 1}`,
    label: `${size.width}x${size.height}`,
    handle: index % 2 === 0 ? "bottom-right" : "top-left",
    targetWidth: size.width,
    targetHeight: size.height,
    travelMs: 540,
    dragMs: autoResizeProbeResizeMs,
    settleMs: autoResizeProbeHoldAfterResizeMs
  }));
};

const scriptedResizeHandleSelector = (handle: ScriptedResizeHandle) =>
  `[data-resize-handle="${handle}"]`;

const resolveStoryPanelNode = (targetNode: HTMLDivElement | null) => {
  if (!targetNode) {
    return null;
  }

  if (targetNode.matches(".retro-screen")) {
    return targetNode;
  }

  return targetNode.querySelector<HTMLDivElement>(".retro-screen");
};

const getScriptedResizeDelta = (
  handle: ScriptedResizeHandle,
  panelRect: DOMRect,
  targetWidth?: number,
  targetHeight?: number
) => {
  const widthDelta =
    targetWidth === undefined ? 0 : Math.round(targetWidth - panelRect.width);
  const heightDelta =
    targetHeight === undefined ? 0 : Math.round(targetHeight - panelRect.height);

  switch (handle) {
    case "right":
      return { dx: widthDelta, dy: 0 };
    case "left":
      return { dx: -widthDelta, dy: 0 };
    case "bottom":
      return { dx: 0, dy: heightDelta };
    case "top":
      return { dx: 0, dy: -heightDelta };
    case "top-left":
      return { dx: -widthDelta, dy: -heightDelta };
    default:
      return { dx: widthDelta, dy: heightDelta };
  }
};

const getDemoCursorOffset = (role: DemoCursorRole) =>
  role === "pointer" ? { x: -5, y: -3 } : { x: -16, y: -16 };

const renderDemoCursorSvg = (role: DemoCursorRole) => {
  if (role === "pointer") {
    return (
      <svg viewBox="0 0 24 32" aria-hidden="true">
        <path
          d="M3 2.5 3.1 23.5 8.7 18.4 12.7 29.3 16.5 27.7 12.4 16.9 20.7 16.9Z"
          fill="#f8fafc"
          stroke="#0b1017"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const rotation = role === "ns-resize" ? 90 : role === "nwse-resize" ? 45 : 0;

  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <g transform={`rotate(${rotation} 14 14)`}>
        <path
          d="M3.5 14 9.6 7.9V11H18.4V7.9L24.5 14 18.4 20.1V17H9.6v3.1Z"
          fill="#f8fafc"
          stroke="#0b1017"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

function DemoMouseCursor({ state }: { state: DemoCursorState }) {
  const offset = getDemoCursorOffset(state.role);

  return (
    <div
      className="sb-retro-demo-cursor"
      data-demo-cursor="true"
      data-demo-cursor-role={state.role}
      data-demo-cursor-dragging={state.dragging ? "true" : undefined}
      style={{
        opacity: state.visible ? 1 : 0,
        transform: `translate(${Math.round(state.x + offset.x)}px, ${Math.round(state.y + offset.y)}px)`
      }}
    >
      {renderDemoCursorSvg(state.role)}
    </div>
  );
}

const useScriptedResizePlayback = ({
  stageRef,
  targetRef,
  paused,
  steps,
  loop = true,
  startDelayMs = 900,
  onResizeFrame,
  onStepComplete
}: ScriptedResizePlaybackOptions) => {
  const [cursor, setCursor] = useState<DemoCursorState>(initialDemoCursorState);
  const cursorRef = useRef(initialDemoCursorState);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    if (paused) {
      setCursor((current) => ({
        ...current,
        visible: false,
        dragging: false,
        role: "pointer"
      }));
      return;
    }

    let cancelled = false;
    let rafId = 0;

    const setCursorFromClientPoint = (
      clientX: number,
      clientY: number,
      role: DemoCursorRole,
      dragging: boolean
    ) => {
      const stageNode = stageRef.current;

      if (!stageNode || cancelled) {
        return;
      }

      const stageRect = stageNode.getBoundingClientRect();
      const nextState: DemoCursorState = {
        visible: true,
        x: clientX - stageRect.left,
        y: clientY - stageRect.top,
        role,
        dragging
      };

      cursorRef.current = nextState;
      setCursor(nextState);
    };

    const animateCursor = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      durationMs: number,
      role: DemoCursorRole,
      dragging: boolean,
      fromSize?: { width: number; height: number },
      toSize?: { width: number; height: number }
    ) =>
      new Promise<void>((resolve) => {
        if (cancelled) {
          resolve();
          return;
        }

        if (durationMs <= 0) {
          setCursorFromClientPoint(to.x, to.y, role, dragging);
          if (fromSize && toSize) {
            onResizeFrame?.(toSize);
          }
          resolve();
          return;
        }

        const startedAt = performance.now();

        const tick = (timestamp: number) => {
          if (cancelled) {
            resolve();
            return;
          }

          const progress = Math.min(1, (timestamp - startedAt) / durationMs);
          const nextX = from.x + (to.x - from.x) * progress;
          const nextY = from.y + (to.y - from.y) * progress;

          setCursorFromClientPoint(nextX, nextY, role, dragging);

          if (fromSize && toSize) {
            onResizeFrame?.({
              width: Math.round(fromSize.width + (toSize.width - fromSize.width) * progress),
              height: Math.round(fromSize.height + (toSize.height - fromSize.height) * progress)
            });
          }

          if (progress < 1) {
            rafId = window.requestAnimationFrame(tick);
            return;
          }

          resolve();
        };

        rafId = window.requestAnimationFrame(tick);
      });

    const run = async () => {
      await wait(startDelayMs);
      let previousPoint: { x: number; y: number } | null = null;

      while (!cancelled) {
        for (const step of steps) {
          if (cancelled) {
            return;
          }

          const panelNode = resolveStoryPanelNode(targetRef.current);
          const handleNode = panelNode?.querySelector<HTMLElement>(
            scriptedResizeHandleSelector(step.handle)
          );

          if (!panelNode || !handleNode) {
            await wait(180);
            continue;
          }

          const panelRect = panelNode.getBoundingClientRect();
          const handleRect = handleNode.getBoundingClientRect();
          const startPoint = {
            x: handleRect.left + handleRect.width / 2,
            y: handleRect.top + handleRect.height / 2
          };
          const { dx, dy } = getScriptedResizeDelta(
            step.handle,
            panelRect,
            step.targetWidth,
            step.targetHeight
          );
          const endPoint = {
            x: startPoint.x + dx,
            y: startPoint.y + dy
          };
          const targetSize = {
            width: Math.round(step.targetWidth ?? panelRect.width),
            height: Math.round(step.targetHeight ?? panelRect.height)
          };
          const approachPoint = previousPoint ?? {
            x: startPoint.x - 132,
            y: startPoint.y - 96
          };
          const cursorRole = scriptedResizeCursorRoleByHandle[step.handle];

          await animateCursor(
            approachPoint,
            startPoint,
            step.travelMs ?? 420,
            "pointer",
            false
          );

          if (cancelled) {
            return;
          }

          setCursorFromClientPoint(startPoint.x, startPoint.y, cursorRole, false);
          await animateCursor(
            startPoint,
            endPoint,
            step.dragMs ?? 980,
            cursorRole,
            true,
            {
              width: Math.round(panelRect.width),
              height: Math.round(panelRect.height)
            },
            targetSize
          );
          onResizeFrame?.(targetSize);
          setCursorFromClientPoint(endPoint.x, endPoint.y, cursorRole, false);
          previousPoint = endPoint;
          onStepComplete?.(step);
          await wait(step.settleMs ?? 700);
        }

        if (!loop) {
          break;
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [loop, onResizeFrame, onStepComplete, paused, stageRef, startDelayMs, steps, targetRef]);

  return cursor;
};

const resolveLiveTtyDemoConfig = (): LiveTtyDemoConfig | null => {
  if (typeof window === "undefined") {
    return null;
  }

  let topWindowConfig: LiveTtyDemoConfig | undefined;

  try {
    topWindowConfig =
      window.top && window.top !== window ? window.top.__RETRO_SCREEN_TTY_DEMO__ : undefined;
  } catch {
    topWindowConfig = undefined;
  }

  const globalConfig = window.__RETRO_SCREEN_TTY_DEMO__ ?? topWindowConfig;
  const query = new URLSearchParams(window.location.search);
  const url = globalConfig?.url ?? query.get("ttyUrl") ?? DEFAULT_LIVE_TTY_URL;

  return {
    url,
    openPayload: globalConfig?.openPayload
  };
};

const toGlyphArt = (value: string, glyphs: Record<string, string[]>) => {
  const glyphLines = Array.from({ length: 5 }, () => "");

  for (const character of value) {
    const glyph = glyphs[character] ?? glyphs["0"];

    for (let index = 0; index < glyphLines.length; index += 1) {
      glyphLines[index] += `${glyph[index] ?? "     "} `;
    }
  }

  return glyphLines.map((line) => line.trimEnd());
};

const writeAt = (
  controller: ReturnType<typeof createRetroScreenController>,
  row: number,
  col: number,
  text: string
) => {
  controller.write(`\u001b[${row};${col}H${text}`);
};

const drawTerminalProbeFrame = (
  controller: ReturnType<typeof createRetroScreenController>,
  rows: number,
  cols: number,
  {
    displayColorMode,
    borderStyle,
    glyphStyle
  }: {
    displayColorMode: RetroScreenDisplayColorMode;
    borderStyle: ProbeBorderStyle;
    glyphStyle: ProbeGlyphStyle;
  }
) => {
  const theme = buildProbeTheme(displayColorMode);
  const clampedRows = Math.max(5, rows);
  const clampedCols = Math.max(12, cols);
  const middleWidth = Math.max(0, clampedCols - 2);
  const sizeValue = `${clampedCols}x${clampedRows}`;
  const glyphLines = toGlyphArt(sizeValue, glyphStyle.glyphs);
  const drawGraffitiShadow =
    glyphStyle.id === graffitiProbeGlyphStyle.id && clampedRows >= glyphLines.length + 4;
  const topBorder = colorizeSequence(
    `${borderStyle.topLeft}${borderStyle.horizontal.repeat(middleWidth)}${borderStyle.topRight}`,
    theme.topBorder
  );
  const bottomBorder = colorizeSequence(
    `${borderStyle.bottomLeft}${borderStyle.horizontal.repeat(middleWidth)}${borderStyle.bottomRight}`,
    theme.bottomBorder
  );
  const blockHeight = 1 + glyphLines.length + (drawGraffitiShadow ? 1 : 0);
  const startRow = Math.max(
    2,
    Math.min(clampedRows - blockHeight, Math.floor((clampedRows - blockHeight) / 2))
  );
  const labelText = colorizeSequence(
    `mode ${displayColorMode}  ${borderStyle.label}`,
    theme.label
  );

  controller.write("\u001b[2J\u001b[H");

  writeAt(controller, 1, 1, topBorder);
  for (let row = 2; row < clampedRows; row += 1) {
    writeAt(
      controller,
      row,
      1,
      `${applyAnsi(theme.sideBorder[0] ?? "", borderStyle.vertical)}${" ".repeat(middleWidth)}${applyAnsi(
        theme.sideBorder[theme.sideBorder.length - 1] ?? theme.sideBorder[0] ?? "",
        borderStyle.vertical
      )}`
    );
  }
  writeAt(controller, clampedRows, 1, bottomBorder);

  writeAt(
    controller,
    startRow,
    Math.max(2, Math.floor((clampedCols - stripAnsi(labelText).length) / 2) + 1),
    labelText
  );

  if (glyphStyle.id === graffitiProbeGlyphStyle.id) {
    glyphLines.forEach((line, index) => {
      const frontRow = startRow + index + 1;
      const plainLength = stripAnsi(line).length;
      const baseCol = Math.max(2, Math.floor((clampedCols - plainLength) / 2) + 1);

      if (drawGraffitiShadow) {
        const shadowRow = startRow + index + 2;

        writeAt(
          controller,
          shadowRow,
          Math.min(clampedCols - 1, baseCol + 2),
          colorizeSequence(line, [theme.graffitiShadow])
        );
      }

      writeAt(controller, frontRow, baseCol, colorizeSequence(line, theme.graffiti));
    });
  } else {
    glyphLines.forEach((line, index) => {
      const centered = colorizeSequence(line, theme.glyph);
      const startCol = Math.max(2, Math.floor((clampedCols - stripAnsi(line).length) / 2) + 1);
      writeAt(controller, startRow + index + 1, startCol, centered);
    });
  }

  controller.write(`\u001b[${clampedRows};${clampedCols}H`);
  controller.setCursorVisible(false);
};

const playTraceScenario = (
  controller: ReturnType<typeof createRetroScreenController>,
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

export function QuietOutputDemoStory() {
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
      <RetroScreen mode="value" color={STORY_COLOR} value={value} />
    </CaptureStage>
  );
}

export function EditableModeDemoStory() {
  const [value, setValue] = useState("");
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await wait(260);

      const input = hostRef.current?.querySelector(".retro-screen__input");
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
      <div ref={hostRef} className="sb-retro-capture-host">
        <RetroScreen
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

export function EditableNotebookStory() {
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
        <RetroScreen
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

export function EditorSelectionLabStory() {
  const [value, setValue] = useState("ABCD");
  const [selection, setSelection] = useState("0:0");

  return (
    <StoryShell
      kicker="Editor Mode"
      title="Select directly on the screen and edit from the same session."
      copy="Editor mode keeps the retro surface in charge of layout while still supporting text selection and destructive editing from keyboard input."
      footer={
        <div className="sb-retro-status">
          Value: <code>{value}</code> Selection: <code>{selection}</code>
        </div>
      }
    >
      <Stage maxWidth={520}>
        <RetroScreen
          mode="editor"
          value={value}
          onChange={setValue}
          onSelectionChange={(nextSelection) =>
            setSelection(nextSelection ? `${nextSelection.start}:${nextSelection.end}` : "null")
          }
          editable
          autoFocus
          color={STORY_COLOR}
          cursorMode="solid"
          gridMode="static"
          rows={3}
          cols={4}
        />
      </Stage>
    </StoryShell>
  );
}

export function EditorSelectionWrappedStory() {
  const [value, setValue] = useState("ABCDEFGHIJKL");
  const [selection, setSelection] = useState("0:0");

  return (
    <StoryShell
      kicker="Editor Mode"
      title="Wrapped editor selections stay aligned with the display grid."
      copy="This fixture keeps the editor in a tight static grid so browser tests can drag across wrapped lines and verify that deletion preserves the wrapped layout."
      footer={
        <div className="sb-retro-status">
          Value: <code>{value}</code> Selection: <code>{selection}</code>
        </div>
      }
    >
      <Stage maxWidth={520}>
        <RetroScreen
          mode="editor"
          value={value}
          onChange={setValue}
          onSelectionChange={(nextSelection) =>
            setSelection(nextSelection ? `${nextSelection.start}:${nextSelection.end}` : "null")
          }
          editable
          autoFocus
          color={STORY_COLOR}
          cursorMode="solid"
          gridMode="static"
          rows={4}
          cols={4}
        />
      </Stage>
    </StoryShell>
  );
}

export function EditorWordSelectionLabStory() {
  const [value, setValue] = useState("retro display tty");
  const [selection, setSelection] = useState("0:0");

  return (
    <StoryShell
      kicker="Editor Mode"
      title="Keyboard and pointer selection can snap to word boundaries."
      copy="This fixture gives the browser suite a stable multi-word sentence so it can verify double-click selection, word-wise keyboard extension, and follow-up destructive edits."
      footer={
        <div className="sb-retro-status">
          Value: <code>{value}</code> Selection: <code>{selection}</code>
        </div>
      }
    >
      <Stage maxWidth={620}>
        <RetroScreen
          mode="editor"
          value={value}
          onChange={setValue}
          onSelectionChange={(nextSelection) =>
            setSelection(nextSelection ? `${nextSelection.start}:${nextSelection.end}` : "null")
          }
          editable
          autoFocus
          color={STORY_COLOR}
          cursorMode="solid"
          gridMode="static"
          rows={4}
          cols={18}
        />
      </Stage>
    </StoryShell>
  );
}

export function EditorSelectionReadOnlyStory() {
  const [selection, setSelection] = useState("0:0");

  return (
    <StoryShell
      kicker="Editor Mode"
      title="Read-only editor surfaces can still expose selection without mutating content."
      copy="This fixture keeps the editor visually interactive while refusing actual edits, which is useful for copy-oriented read-only transcripts."
      footer={
        <div className="sb-retro-status">
          Selection: <code>{selection}</code>
        </div>
      }
    >
      <Stage maxWidth={520}>
        <RetroScreen
          mode="editor"
          value="ABCD"
          onSelectionChange={(nextSelection) =>
            setSelection(nextSelection ? `${nextSelection.start}:${nextSelection.end}` : "null")
          }
          editable={false}
          autoFocus
          color={STORY_COLOR}
          cursorMode="solid"
          gridMode="static"
          rows={3}
          cols={4}
        />
      </Stage>
    </StoryShell>
  );
}

function TerminalStreamStory() {
  const [controller] = useState(() =>
    createRetroScreenController({
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
        <RetroScreen mode="terminal" controller={controller} color={STORY_COLOR} />
      </Stage>
    </StoryShell>
  );
}

function WhiteRabbitSignalSurface({
  capture = false
}: {
  capture?: boolean;
}) {
  const [controller] = useState(() =>
    createRetroScreenController({
      rows: 5,
      cols: 34,
      cursorMode: "solid"
    })
  );

  useEffect(() => {
    controller.reset();
    controller.resize(5, 34);
    controller.setCursorMode("solid");
    controller.setCursorVisible(true);

    const timers: number[] = [];
    let nextAt = 380;

    const getSignalTypingDelay = (character: string, nextCharacter?: string) => {
      if (character === " ") {
        return 86;
      }

      if (character === ",") {
        return 214;
      }

      if (character === "." && nextCharacter === ".") {
        return 70;
      }

      if (character === ".") {
        return 320;
      }

      if (/[A-Z]/u.test(character)) {
        return 154;
      }

      return 122;
    };

    const scheduleTypedWrite = (text: string) => {
      const characters = Array.from(text);

      for (let index = 0; index < characters.length; index += 1) {
        const character = characters[index]!;
        timers.push(
          window.setTimeout(() => {
            controller.write(character);
          }, nextAt)
        );
        nextAt += getSignalTypingDelay(character, characters[index + 1]);
      }
    };

    const scheduleReset = () => {
      timers.push(
        window.setTimeout(() => {
          controller.reset();
          controller.resize(5, 34);
          controller.setCursorMode("solid");
          controller.setCursorVisible(true);
        }, nextAt)
      );
      nextAt += 360;
    };

    scheduleTypedWrite("Wake up, Neo...");
    nextAt += 1360;
    scheduleReset();
    scheduleTypedWrite("The Matrix has you...");
    nextAt += 1220;
    scheduleReset();
    scheduleTypedWrite("Follow the white rabbit.");
    nextAt += 1220;
    scheduleReset();
    scheduleTypedWrite("Knock, knock, Neo.");

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [controller]);

  const screen = (
    <RetroScreen
      mode="terminal"
      controller={controller}
      color={STORY_COLOR}
      displayPadding={{ block: 14, inline: 16 }}
      style={{ minHeight: "212px" }}
    />
  );

  if (capture) {
    return (
      <CaptureStage captureId="white-rabbit-signal" maxWidth={760}>
        {screen}
      </CaptureStage>
    );
  }

  return (
    <StoryShell
      kicker="Signal Intercept"
      title="Let a message arrive like a late-night terminal whisper."
      copy="This story leans into the cinematic side of RetroScreen with the full four-beat Matrix screen sequence and a more film-like typing cadence."
      footer={
        <ul className="sb-retro-note-list">
          <li>Built with the same controller-driven terminal path as the live stream demos.</li>
          <li>The sequence resets between each line so every phrase lands on its own beat.</li>
        </ul>
      }
    >
      <Stage maxWidth={760}>
        {screen}
      </Stage>
    </StoryShell>
  );
}

function WhiteRabbitSignalStory() {
  return <WhiteRabbitSignalSurface />;
}

export function WhiteRabbitSignalDemoStory() {
  return <WhiteRabbitSignalSurface capture />;
}

function MatrixCodeRainSurface({
  capture = false
}: {
  capture?: boolean;
}) {
  const screen = (
    <div className="sb-retro-matrix-rain-frame">
      <MatrixCodeRainScreen />
    </div>
  );

  if (capture) {
    return (
      <CaptureStage captureId="matrix-code-rain" maxWidth={940}>
        {screen}
      </CaptureStage>
    );
  }

  return (
    <StoryShell
      kicker="Matrix Code Rain"
      title="Let the code rain travel like it does on the operators' screens."
      copy="This demo uses a generated monospaced Matrix font built from the local reference set while driving a stationary glyph field with moving illumination waves so the columns feel closer to the film than a simple falling-text effect."
      footer={
        <ul className="sb-retro-note-list">
          <li>The glyphs stay planted on the grid while the glow waves descend through each column.</li>
          <li>The demo uses ANSI truecolor shades to push the white-hot tracer and green trail depth.</li>
        </ul>
      }
    >
      <Stage maxWidth={940}>
        {screen}
      </Stage>
    </StoryShell>
  );
}

function MatrixCodeRainStory() {
  return <MatrixCodeRainSurface />;
}

export function MatrixCodeRainDemoStory() {
  return <MatrixCodeRainSurface capture />;
}

export function TerminalModeDemoStory() {
  const [controller] = useState(() =>
    createRetroScreenController({
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
      <RetroScreen mode="terminal" controller={controller} color={STORY_COLOR} />
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
        <RetroScreen
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

export function PromptModeDemoStory() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await wait(260);

      const input = hostRef.current?.querySelector(".retro-screen__input");
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
      <div ref={hostRef} className="sb-retro-capture-host">
        <RetroScreen
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

export function DisplayColorModesDemoStory() {
  const [controller] = useState(() =>
    createRetroScreenController({
      rows: 6,
      cols: 40,
      cursorMode: "solid"
    })
  );
  const [displayColorMode, setDisplayColorMode] = useState<RetroScreenDisplayColorMode>(
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
      <RetroScreen
        mode="terminal"
        controller={controller}
        displayColorMode={displayColorMode}
        cursorMode="solid"
      />
    </CaptureStage>
  );
}

export function ControlCharacterReplayStory() {
  const [scenarioId, setScenarioId] = useState(traceScenarios[0].id);
  const [runToken, setRunToken] = useState(0);
  const [controller] = useState(() =>
    createRetroScreenController({
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
        <RetroScreen
          mode="terminal"
          controller={controller}
          displayColorMode="ansi-extended"
          cursorMode="solid"
        />
      </Stage>
    </StoryShell>
  );
}

export function ControlCharacterReplayDemoStory() {
  const [controller] = useState(() =>
    createRetroScreenController({
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
      <RetroScreen
        mode="terminal"
        controller={controller}
        displayColorMode="ansi-extended"
        cursorMode="solid"
      />
    </CaptureStage>
  );
}

export function DisplayBufferStory() {
  const [controller] = useState(() =>
    createRetroScreenController({
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
        <RetroScreen mode="terminal" controller={controller} />
      </Stage>
    </StoryShell>
  );
}

function BadAppleAnsiSurface({
  capture = false
}: {
  capture?: boolean;
}) {
  const [asset, setAsset] = useState<BadAppleAnsiAsset | null>(null);
  const [playbackState, setPlaybackState] = useState<BadApplePlaybackPhase>("loading");
  const [playerState, setPlayerState] = useState<RetroScreenAnsiPlayerState | null>(null);

  useEffect(() => {
    let active = true;

    loadBadAppleAnsiAsset()
      .then((nextAsset) => {
        if (!active) {
          return;
        }

        setAsset(nextAsset);
        setPlaybackState("playing");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        console.error("Bad Apple ANSI failed to load.", error);
        setPlaybackState("failed");
      });

    return () => {
      active = false;
    };
  }, []);
  const loadingValue =
    playbackState === "failed"
      ? "Bad Apple ANSI failed to load.\nSee the browser console for details."
      : "Loading Bad Apple ANSI...\nWaiting for CP437 decode.";
  const player = (
    <RetroScreenAnsiPlayer
      rows={asset?.height ?? 25}
      cols={asset?.width ?? 80}
      byteStream={playbackState === "playing" && asset ? asset.byteStream : []}
      frameDelayMs={asset?.frameDelayMs ?? 72}
      complete={asset?.complete ?? false}
      loop
      loadingValue={loadingValue}
      onPlaybackStateChange={setPlayerState}
      displayColorMode="ansi-classic"
      displayFontScale={1.22}
      displayRowScale={1.14}
      displayPadding={{ block: 8, inline: 12 }}
      style={{ width: "1010px", height: "642px" }}
    />
  );

  if (capture) {
    return (
      <CaptureStage captureId="ansi-art-bad-apple" maxWidth={1100}>
        {player}
      </CaptureStage>
    );
  }

  return (
    <StoryShell
      kicker="ANSI Playback"
      title="Play Bad Apple!! inside RetroScreen at its native 80x25 geometry."
      copy="This demo loads the full original ANSI release, prepares a byte stream outside of RetroScreen, and feeds those bytes into the reusable ANSI player wrapper. The player incrementally materializes stable 80x25 frames while keeping byte loading and playback concerns decoupled."
      footer={
        <div className="sb-retro-status">
          <span>
            {asset
              ? `Frame ${String((playerState?.frameIndex ?? 0) + 1).padStart(2, "0")} / ${playerState?.frameCount ?? "..."} · ${asset.width}x${asset.height} · ${asset.font}`
              : "Loading Mistigris ANSI release..."}
          </span>
          <span>
            Credit:{" "}
            <a href="https://mistigris.org/" rel="noreferrer" target="_blank">
              Mistigris
            </a>
            {asset ? ` · ${asset.title} by ${asset.author}` : ""}
          </span>
        </div>
      }
    >
      <Stage maxWidth={1100}>
        {player}
      </Stage>
    </StoryShell>
  );
}

export function BadAppleAnsiStory() {
  return <BadAppleAnsiSurface />;
}

export function BadAppleAnsiDemoStory() {
  return <BadAppleAnsiSurface capture />;
}

function BadAppleAnsiGzipSurface({
  capture = false
}: {
  capture?: boolean;
}) {
  const [asset, setAsset] = useState<BadAppleGzipAnsiAsset | null>(null);
  const [playbackState, setPlaybackState] = useState<BadApplePlaybackPhase>("loading");
  const [playerState, setPlayerState] = useState<RetroScreenAnsiPlayerState | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    streamBadAppleGzipAnsiAsset({
      signal: abortController.signal,
      onUpdate(nextAsset) {
        if (!active) {
          return;
        }

        setAsset(nextAsset);
        setPlaybackState("playing");
      }
    }).catch((error) => {
      if (!active || (error instanceof DOMException && error.name === "AbortError")) {
        return;
      }

      console.error("Bad Apple ANSI gzip stream failed to load.", error);
      setPlaybackState("failed");
    });

    return () => {
      active = false;
      abortController.abort();
    };
  }, []);
  const loadingValue =
    playbackState === "failed"
      ? "Bad Apple ANSI gzip stream failed to load.\nSee the browser console for details."
      : "Streaming Bad Apple ANSI over gzip...\nWaiting for the first decompressed frames.";
  const player = (
    <RetroScreenAnsiPlayer
      rows={asset?.height ?? 25}
      cols={asset?.width ?? 80}
      byteStream={playbackState === "playing" && asset ? asset.byteStream : []}
      frameDelayMs={asset?.frameDelayMs ?? 72}
      complete={asset?.complete ?? false}
      loop
      loadingValue={loadingValue}
      onPlaybackStateChange={setPlayerState}
      displayColorMode="ansi-classic"
      displayFontScale={1.22}
      displayRowScale={1.14}
      displayPadding={{ block: 8, inline: 12 }}
      style={{ width: "1010px", height: "642px" }}
    />
  );

  if (capture) {
    return (
      <CaptureStage captureId="ansi-art-bad-apple-gzip-stream" maxWidth={1100}>
        {player}
      </CaptureStage>
    );
  }

  return (
    <StoryShell
      kicker="Streaming Gzip Playback"
      title="Play Bad Apple!! from a gzipped ANSI stream as bytes arrive over HTTP."
      copy={
        "This demo fetches a `.ans.gz` asset, uses native HTTP gzip decoding when the server provides it, falls back to `DecompressionStream(\"gzip\")` when needed, and feeds each decompressed byte chunk into the reusable ANSI player. A small holdback window keeps the trailing SAUCE record out of the player, so frames can appear before the whole file finishes downloading."
      }
      footer={
        <div className="sb-retro-status">
          <span>
            {asset
              ? `Frame ${String((playerState?.frameIndex ?? 0) + 1).padStart(2, "0")} / ${playerState?.frameCount ?? "..."} · ${asset.width}x${asset.height} · ${asset.font} · ${asset.complete ? "stream complete" : `streaming ${Math.max(1, Math.round(asset.streamedByteCount / 1024))} KiB`}`
              : "Opening gzipped Bad Apple stream..."}
          </span>
          <span>
            Credit:{" "}
            <a href="https://mistigris.org/" rel="noreferrer" target="_blank">
              Mistigris
            </a>
            {asset ? ` · ${asset.title} by ${asset.author}` : ""}
          </span>
        </div>
      }
    >
      <Stage maxWidth={1100}>{player}</Stage>
    </StoryShell>
  );
}

export function BadAppleAnsiGzipStreamStory() {
  return <BadAppleAnsiGzipSurface />;
}

export function BadAppleAnsiGzipStreamDemoStory() {
  return <BadAppleAnsiGzipSurface capture />;
}

export function LargestAnsiGalleryStory() {
  return <AnsiGalleryViewer />;
}

function LiveTtyTerminalBridgeStory() {
  const [config] = useState<LiveTtyDemoConfig | null>(() => resolveLiveTtyDemoConfig());
  const [sessionState, setSessionState] = useState("idle");
  const [sessionTitle, setSessionTitle] = useState<string>("(waiting)");
  const [bellCount, setBellCount] = useState(0);
  const [stageSizeId, setStageSizeId] = useState(liveTtyStageSizes[1]?.id ?? "console");
  const stageSize =
    liveTtyStageSizes.find((candidate) => candidate.id === stageSizeId) ?? liveTtyStageSizes[1]!;
  const openPayloadSignature = JSON.stringify(config?.openPayload ?? {});
  const session = useMemo(() => {
    if (!config) {
      return null;
    }

    return createRetroScreenWebSocketSession({
      url: config.url,
      openPayload:
        typeof config.openPayload === "object" && config.openPayload !== null
          ? config.openPayload
          : undefined
    });
  }, [config?.url, openPayloadSignature]);

  useEffect(() => {
    setSessionState(session?.getState() ?? "idle");
    setSessionTitle("(waiting)");
    setBellCount(0);
  }, [session]);

  if (!config || !session) {
    return (
      <StoryShell
        kicker="Live TTY Bridge"
        title="Point the story at a websocket TTY and drive a real shell."
        copy="This story defaults to the local example server at ws://127.0.0.1:8787. Start that server and the demo will come alive automatically, or override the URL through a global config or a ttyUrl query param."
        footer={
          <ul className="sb-retro-note-list">
            <li>Start the example server with <code>yarn tty:server</code>.</li>
            <li>The story will try <code>{DEFAULT_LIVE_TTY_URL}</code> automatically.</li>
            <li>Set <code>window.__RETRO_SCREEN_TTY_DEMO__</code> to override the URL or open payload.</li>
            <li>The browser test suite does this automatically for the TTY bridge checks.</li>
          </ul>
        }
      >
        <Stage maxWidth={900}>
          <RetroScreen
            mode="value"
            value={[
              "LIVE TTY STORY IDLE",
              `Default URL: ${DEFAULT_LIVE_TTY_URL}`,
              "",
              "Start the example server:",
              "  yarn tty:server",
              "",
              "Optional override:",
              "Provide window.__RETRO_SCREEN_TTY_DEMO__ = {",
              `  url: "${DEFAULT_LIVE_TTY_URL}",`,
              "  openPayload: {",
              '    command: process.execPath,',
              '    args: ["/absolute/path/to/scripts/tty-test-terminal.mjs"]',
              "  }",
              "}"
            ].join("\n")}
            displayPadding={{ block: 12, inline: 14 }}
          />
        </Stage>
      </StoryShell>
    );
  }

  return (
    <StoryShell
      kicker="Live TTY Bridge"
      title="Drive a real TTY session through the browser terminal surface."
      copy="This story connects RetroScreen to an actual websocket TTY. Use the keyboard directly, resize the host shell with the buttons below, and watch session state, title reporting, alternate-screen mode, and bell tracking update live."
      footer={
        <div className="sb-retro-status">
          <span className="sb-retro-measure">
            state: <code>{sessionState}</code>
          </span>
          <span className="sb-retro-measure">
            title: <code>{sessionTitle}</code>
          </span>
          <span className="sb-retro-measure">
            bells: <code>{bellCount}</code>
          </span>
        </div>
      }
    >
      <div className="sb-retro-toolbar">
        {liveTtyStageSizes.map((size) => (
          <button
            className="sb-retro-button"
            key={size.id}
            type="button"
            data-tty-size={size.id}
            data-active={size.id === stageSize.id ? "true" : "false"}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => setStageSizeId(size.id)}
          >
            {size.label}
          </button>
        ))}
      </div>
      <Stage maxWidth={980}>
        <div
          className="sb-retro-live-tty-host"
          data-session-state={sessionState}
          data-tty-size-frame={stageSize.id}
          style={{ width: `${stageSize.width}px`, height: `${stageSize.height}px` }}
        >
          <RetroScreen
            mode="terminal"
            session={session}
            autoFocus
            displayColorMode="ansi-extended"
            displayPadding={{ block: 12, inline: 14 }}
            onSessionStateChange={setSessionState}
            onSessionEvent={(event) => {
              if (event.type === "title") {
                setSessionTitle(event.title || "(empty)");
              } else if (event.type === "bell") {
                setBellCount((count) => count + 1);
              }
            }}
          />
        </div>
      </Stage>
    </StoryShell>
  );
}

export function LiveTtyTerminalBridgeDemoStory() {
  const [config] = useState<LiveTtyDemoConfig | null>(() => resolveLiveTtyDemoConfig());
  const openPayloadSignature = JSON.stringify(config?.openPayload ?? {});
  const session = useMemo(() => {
    if (!config) {
      return null;
    }

    return createRetroScreenWebSocketSession({
      url: config.url,
      openPayload:
        typeof config.openPayload === "object" && config.openPayload !== null
          ? config.openPayload
          : undefined
    });
  }, [config?.url, openPayloadSignature]);

  if (!config || !session) {
    return (
      <CaptureStage captureId="live-tty-terminal-bridge" maxWidth={980}>
        <RetroScreen
          mode="value"
          value={[
            "LIVE TTY CAPTURE IDLE",
            `Default URL: ${DEFAULT_LIVE_TTY_URL}`,
            "",
            "Start the example server:",
            "  yarn tty:server",
            "",
            "Or provide window.__RETRO_SCREEN_TTY_DEMO__"
          ].join("\n")}
          displayPadding={{ block: 10, inline: 12 }}
        />
      </CaptureStage>
    );
  }

  return (
    <CaptureStage captureId="live-tty-terminal-bridge" maxWidth={980}>
      <div
        className="sb-retro-live-tty-host"
        data-session-state="capture"
        style={{ width: "920px", height: "420px" }}
      >
        <RetroScreen
          mode="terminal"
          session={session}
          autoFocus
          closeSessionOnUnmount
          displayColorMode="ansi-extended"
          displayPadding={{ block: 10, inline: 12 }}
        />
      </div>
    </CaptureStage>
  );
}

export function AutoResizeProbeStory() {
  const [lastReply, setLastReply] = useState<string>("");
  const [sceneState, setSceneState] = useState<ProbeSceneState>({
    displayColorMode: probeDisplayColorModes[0],
    borderStyleLabel: probeBorderStyles[0]?.label ?? "ascii",
    glyphStyleLabel: probeMonochromeGlyphStyles[0]?.label ?? "classic blocks"
  });
  const [resizePaused, setResizePaused] = useState(false);
  const [activeResizeLabel, setActiveResizeLabel] = useState(
    `${autoResizeProbeSizes[0]?.width ?? 0}x${autoResizeProbeSizes[0]?.height ?? 0}`
  );

  return (
    <StoryShell
      kicker="Auto Resize Probe"
      title="Let a terminal program redraw itself from the screen's reported geometry."
      copy="This demo simulates a terminal app issuing a size query, receiving a terminal-style rows/cols reply, and repainting the whole scene with ANSI cursor movement. A visible mouse cursor grabs the real resize handles, the screen keeps a deliberately tight padding, and the probe still cycles through every monochrome and ANSI display mode while border alphabets plus oversized text styles shuffle underneath."
      footer={
        <div className="sb-retro-status">
          <span className="sb-retro-measure">resize: <code>{resizePaused ? "paused" : "auto"}</code></span>
          <span className="sb-retro-measure">drag: <code>{activeResizeLabel}</code></span>
          <span className="sb-retro-measure">mode: <code>{sceneState.displayColorMode}</code></span>
          <span className="sb-retro-measure">border: <code>{sceneState.borderStyleLabel}</code></span>
          <span className="sb-retro-measure">glyphs: <code>{sceneState.glyphStyleLabel}</code></span>
          <span className="sb-retro-measure">
            query: <code>{TERMINAL_SIZE_QUERY.replace(/\u001b/gu, "ESC")}</code>
          </span>
          <span className="sb-retro-measure">
            reply: <code>{lastReply ? lastReply.replace(/\u001b/gu, "ESC") : "measuring"}</code>
          </span>
        </div>
      }
    >
      <AutoResizeProbeSurface
        onReplyChange={setLastReply}
        onSceneChange={setSceneState}
        onResizePauseChange={setResizePaused}
        onActiveResizeLabelChange={setActiveResizeLabel}
      />
    </StoryShell>
  );
}

function AutoResizeProbeSurface({
  onReplyChange,
  onSceneChange,
  onResizePauseChange,
  onActiveResizeLabelChange
}: {
  onReplyChange?: (reply: string) => void;
  onSceneChange?: (sceneState: ProbeSceneState) => void;
  onResizePauseChange?: (paused: boolean) => void;
  onActiveResizeLabelChange?: (label: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelHostRef = useRef<HTMLDivElement | null>(null);
  const windowResizePauseArmedRef = useRef(false);
  const [controller] = useState(() =>
    createRetroScreenController({
      rows: 9,
      cols: 34,
      scrollback: 20,
      cursorMode: "solid"
    })
  );
  const [sizeVariant, setSizeVariant] = useState(0);
  const [displayModeIndex, setDisplayModeIndex] = useState(0);
  const [visualVariant, setVisualVariant] = useState(0);
  const [resizePaused, setResizePaused] = useState(false);
  const [scriptedSize, setScriptedSize] = useState(() => autoResizeProbeSizes[0] ?? { width: 760, height: 360 });
  const [reportedGeometry, setReportedGeometry] = useState<RetroScreenGeometry | null>(null);
  const [settledResizeTick, setSettledResizeTick] = useState(0);
  const [redrawMeta, setRedrawMeta] = useState<ProbeRedrawMeta>({
    sequence: 0,
    reason: "live-update",
    rows: 0,
    cols: 0
  });

  useEffect(() => {
    onResizePauseChange?.(resizePaused);
  }, [onResizePauseChange, resizePaused]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDisplayModeIndex((current) => (current + 1) % probeDisplayColorModes.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextRandom = createSeededRandom(19760317);
    let timer = 0;
    let active = true;

    const schedule = () => {
      timer = window.setTimeout(
        () => {
          if (!active) {
            return;
          }

          setVisualVariant((current) => current + 1);
          schedule();
        },
        1150 + Math.floor(nextRandom() * 1500)
      );
    };

    schedule();

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const armTimer = window.setTimeout(() => {
      windowResizePauseArmedRef.current = true;
    }, 1400);

    return () => {
      window.clearTimeout(armTimer);
      windowResizePauseArmedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const pauseAutoResize = () => {
      if (!windowResizePauseArmedRef.current) {
        return;
      }

      setResizePaused(true);
    };

    window.addEventListener("resize", pauseAutoResize);
    return () => window.removeEventListener("resize", pauseAutoResize);
  }, []);

  const scriptedResizeSteps = useMemo(
    () => buildAutoResizeProbeSteps(autoResizeProbeSizes),
    []
  );
  const handleProbeResizeStepComplete = useCallback(
    (step: ScriptedResizeStep) => {
      setSizeVariant((current) => current + 1);
      setSettledResizeTick((current) => current + 1);
      onActiveResizeLabelChange?.(step.label);
    },
    [onActiveResizeLabelChange]
  );
  const cursor = useScriptedResizePlayback({
    stageRef,
    targetRef: panelHostRef,
    paused: resizePaused,
    steps: scriptedResizeSteps,
    onResizeFrame: setScriptedSize,
    onStepComplete: handleProbeResizeStepComplete
  });

  useEffect(() => {
    const initialStep = scriptedResizeSteps[0];

    if (initialStep) {
      onActiveResizeLabelChange?.(initialStep.label);
    }
  }, [onActiveResizeLabelChange, scriptedResizeSteps]);

  const displayColorMode = probeDisplayColorModes[displayModeIndex] ?? probeDisplayColorModes[0];
  const borderStyle = probeBorderStyles[visualVariant % probeBorderStyles.length] ?? probeBorderStyles[0];
  const monochromeGlyphStyle =
    probeMonochromeGlyphStyles[
      (visualVariant + Math.floor(sizeVariant / 2)) % probeMonochromeGlyphStyles.length
    ] ?? probeMonochromeGlyphStyles[0];
  const glyphStyle =
    displayColorMode === "ansi-classic" || displayColorMode === "ansi-extended"
      ? graffitiProbeGlyphStyle
      : monochromeGlyphStyle;

  useEffect(() => {
    onSceneChange?.({
      displayColorMode,
      borderStyleLabel: borderStyle.label,
      glyphStyleLabel: glyphStyle.label
    });
  }, [borderStyle.label, displayColorMode, glyphStyle.label, onSceneChange]);

  const redrawProbe = useCallback(
    (
      geometry: RetroScreenGeometry,
      reason: ProbeRedrawMeta["reason"]
    ) => {
      const reply = buildTerminalSizeReply(geometry.rows, geometry.cols);
      const parsed = parseTerminalSizeReply(reply);

      if (!parsed) {
        return;
      }

      onReplyChange?.(reply);
      controller.reset();
      controller.resize(parsed.rows, parsed.cols);
      drawTerminalProbeFrame(controller, parsed.rows, parsed.cols, {
        displayColorMode,
        borderStyle,
        glyphStyle
      });
      setRedrawMeta((current) => ({
        sequence: current.sequence + 1,
        reason,
        rows: parsed.rows,
        cols: parsed.cols
      }));
    },
    [borderStyle, controller, displayColorMode, glyphStyle, onReplyChange]
  );

  useEffect(() => {
    if (!reportedGeometry) {
      return;
    }

    redrawProbe(reportedGeometry, "live-update");
  }, [redrawProbe, reportedGeometry]);

  useEffect(() => {
    if (!reportedGeometry || settledResizeTick === 0) {
      return;
    }

    redrawProbe(reportedGeometry, "transition-settle");
  }, [redrawProbe, reportedGeometry, settledResizeTick]);

  return (
    <div
      ref={stageRef}
      className="sb-retro-auto-resize-stage sb-retro-resize-demo-stage"
      data-demo-resize-state={resizePaused ? "paused" : "auto"}
      onMouseDownCapture={(event) => {
        if (event.nativeEvent.isTrusted) {
          setResizePaused(true);
        }
      }}
      onTouchStartCapture={(event) => {
        if (event.nativeEvent.isTrusted) {
          setResizePaused(true);
        }
      }}
    >
      <div
        ref={panelHostRef}
        className="sb-retro-auto-resize-host"
        data-probe-redraw-seq={redrawMeta.sequence}
        data-probe-last-redraw-reason={redrawMeta.reason}
        data-probe-last-redraw-rows={redrawMeta.rows}
        data-probe-last-redraw-cols={redrawMeta.cols}
      >
        <RetroScreen
          mode="terminal"
          controller={controller}
          displayColorMode={displayColorMode}
          displayPadding={{ block: 8, inline: 10 }}
          onGeometryChange={setReportedGeometry}
          style={{
            width: scriptedSize.width,
            height: scriptedSize.height
          }}
        />
      </div>
      <DemoMouseCursor state={cursor} />
    </div>
  );
}

export function AutoResizeProbeDemoStory() {
  return (
    <CaptureStage captureId="auto-resize-probe" maxWidth={920}>
      <div className="sb-retro-auto-resize-capture-shell">
        <AutoResizeProbeSurface />
      </div>
    </CaptureStage>
  );
}

function ResizablePanelLiveSurface({
  capture = false,
  leadingFocus = false,
  onPauseChange,
  onActiveStepLabelChange,
  onGeometryChange
}: ResizablePanelLiveSurfaceProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelHostRef = useRef<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState<RetroScreenGeometry | null>(null);
  const [paused, setPaused] = useState(false);
  const [scriptedSize, setScriptedSize] = useState(resizablePanelInitialSize);
  const steps = useMemo(
    () => (leadingFocus ? resizablePanelLeadingSteps : resizablePanelLiveSteps),
    [leadingFocus]
  );
  const [activeStepLabel, setActiveStepLabel] = useState(
    steps[0]?.label ?? "right edge"
  );
  const handleResizableStepComplete = useCallback(
    (step: ScriptedResizeStep) => {
      setActiveStepLabel(step.label);
      onActiveStepLabelChange?.(step.label);
    },
    [onActiveStepLabelChange]
  );
  const cursor = useScriptedResizePlayback({
    stageRef,
    targetRef: panelHostRef,
    paused,
    steps,
    startDelayMs: capture ? 520 : 880,
    onResizeFrame: setScriptedSize,
    onStepComplete: handleResizableStepComplete
  });

  useEffect(() => {
    onPauseChange?.(paused);
  }, [onPauseChange, paused]);

  useEffect(() => {
    onGeometryChange?.(geometry);
  }, [geometry, onGeometryChange]);

  useEffect(() => {
    const initialStep = steps[0];

    if (initialStep) {
      setActiveStepLabel(initialStep.label);
      onActiveStepLabelChange?.(initialStep.label);
    }
  }, [onActiveStepLabelChange, steps]);

  const value = [
    leadingFocus
      ? "Leading-edge handles are live here too."
      : "All resize handles are live in this panel.",
    "",
    `auto drag: ${paused ? "paused" : "running"}`,
    `active handle: ${activeStepLabel}`,
    geometry ? `grid: ${geometry.cols} cols x ${geometry.rows} rows` : "grid: measuring",
    "Click or drag anywhere to pause the scripted pass."
  ].join("\n");

  return (
    <div
      ref={stageRef}
      className="sb-retro-resize-demo-stage"
      data-demo-resize-state={paused ? "paused" : "auto"}
      onMouseDownCapture={(event) => {
        if (event.nativeEvent.isTrusted) {
          setPaused(true);
        }
      }}
      onTouchStartCapture={(event) => {
        if (event.nativeEvent.isTrusted) {
          setPaused(true);
        }
      }}
    >
      <div ref={panelHostRef} className="sb-retro-resize-demo-host">
        <RetroScreen
          mode="terminal"
          resizable="both"
          resizableLeadingEdges
          displayPadding={{ block: 12, inline: 14 }}
          value={value}
          onGeometryChange={setGeometry}
          style={{
            width: scriptedSize.width,
            height: scriptedSize.height
          }}
        />
      </div>
      <DemoMouseCursor state={cursor} />
    </div>
  );
}

export function ResizablePanelStory() {
  const [paused, setPaused] = useState(false);
  const [activeHandleLabel, setActiveHandleLabel] = useState(
    resizablePanelLiveSteps[0]?.label ?? "right edge"
  );
  const [geometry, setGeometry] = useState<RetroScreenGeometry | null>(null);

  return (
    <StoryShell
      kicker="Resizable Panel"
      title="Let the glass stretch with the same handles users get at runtime."
      copy="Enable `resizable` when the panel itself should be draggable. This live Storybook surface now shows a visible mouse cursor grabbing the real resize handles, so the docs reflect the same interaction path the component ships with."
      footer={
        <div className="sb-retro-status">
          <span className="sb-retro-measure">demo: <code>{paused ? "paused" : "auto"}</code></span>
          <span className="sb-retro-measure">handle: <code>{activeHandleLabel}</code></span>
          <span className="sb-retro-measure">
            grid: <code>{geometry ? `${geometry.cols} x ${geometry.rows}` : "measuring"}</code>
          </span>
        </div>
      }
    >
      <Stage>
        <ResizablePanelLiveSurface
          onPauseChange={setPaused}
          onActiveStepLabelChange={setActiveHandleLabel}
          onGeometryChange={setGeometry}
        />
      </Stage>
    </StoryShell>
  );
}

export function ResizablePanelLeadingEdgesStory() {
  const [paused, setPaused] = useState(false);
  const [activeHandleLabel, setActiveHandleLabel] = useState(
    resizablePanelLeadingSteps[0]?.label ?? "top-left corner"
  );
  const [geometry, setGeometry] = useState<RetroScreenGeometry | null>(null);

  return (
    <StoryShell
      kicker="Leading-Edge Resize"
      title="Top and left handles can be part of the same live interaction surface."
      copy="Set `resizableLeadingEdges` when you want left, top, and top-left handles in play. This demo intentionally spends most of its time on those leading handles so you can see them lengthen the overall panel without inventing a separate layout model."
      footer={
        <div className="sb-retro-status">
          <span className="sb-retro-measure">demo: <code>{paused ? "paused" : "auto"}</code></span>
          <span className="sb-retro-measure">handle: <code>{activeHandleLabel}</code></span>
          <span className="sb-retro-measure">
            grid: <code>{geometry ? `${geometry.cols} x ${geometry.rows}` : "measuring"}</code>
          </span>
        </div>
      }
    >
      <Stage>
        <ResizablePanelLiveSurface
          leadingFocus
          onPauseChange={setPaused}
          onActiveStepLabelChange={setActiveHandleLabel}
          onGeometryChange={setGeometry}
        />
      </Stage>
    </StoryShell>
  );
}

export function ResizablePanelDemoStory() {
  return (
    <CaptureStage captureId="resizable-panel" maxWidth={920}>
      <div className="sb-retro-resizable-capture-shell">
        <ResizablePanelLiveSurface capture />
      </div>
    </CaptureStage>
  );
}

export function ResponsivePanelStory() {
  const widths = [
    { label: "Compact", value: 420 },
    { label: "Balanced", value: 620 },
    { label: "Wide", value: 840 }
  ];
  const [width, setWidth] = useState(widths[1].value);
  const [geometry, setGeometry] = useState<RetroScreenGeometry | null>(null);

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
        <RetroScreen
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
          <RetroScreen
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
          <RetroScreen
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
          <RetroScreen
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
          <RetroScreen
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
          <RetroScreen
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

function LightDarkHostsSurface({
  activeTheme,
  animated = false
}: {
  activeTheme: "light" | "dark" | "both";
  animated?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const cycleMs = 10200;
  const now = tick % cycleMs;
  const clampProgress = (start: number, end: number) =>
    Math.max(0, Math.min(1, (now - start) / (end - start)));
  const resolvedActiveTheme =
    animated ? (now < cycleMs / 2 ? "light" : "dark") : activeTheme;
  const lightStream = [
    "\u001b[1mLIGHT SURFACE\u001b[0m",
    "\u001b[38;5;160mR\u001b[38;5;214mA\u001b[38;5;190mI\u001b[38;5;45mN\u001b[38;5;39mB\u001b[38;5;141mO\u001b[38;5;201mW\u001b[0m contrast check",
    "\u001b[38;2;194;94;0mamber\u001b[0m  \u001b[38;2;0;104;181mblue\u001b[0m  \u001b[38;2;108;40;148mviolet\u001b[0m",
    "\u001b[38;2;28;139;98mtyped live\u001b[0m on bright LCD glass"
  ].join("\r\n");
  const darkStream = [
    "\u001b[1mDARK SURFACE\u001b[0m",
    "\u001b[38;5;160mR\u001b[38;5;214mA\u001b[38;5;190mI\u001b[38;5;45mN\u001b[38;5;39mB\u001b[38;5;141mO\u001b[38;5;201mW\u001b[0m contrast check",
    "\u001b[38;2;255;176;86mamber\u001b[0m  \u001b[38;2;102;198;255mblue\u001b[0m  \u001b[38;2;214;145;255mviolet\u001b[0m",
    "\u001b[38;2;110;255;185mtyped live\u001b[0m on deep terminal glass"
  ].join("\r\n");
  const lightFrames = buildAnsiTypedFrames(lightStream);
  const darkFrames = buildAnsiTypedFrames(darkStream);
  const lightValue = animated
    ? resolveAnsiTypedFrame(lightFrames, clampProgress(0, 4200))
    : lightStream;
  const darkValue = animated
    ? resolveAnsiTypedFrame(darkFrames, clampProgress(5200, 9400))
    : darkStream;

  useEffect(() => {
    if (!animated) {
      return undefined;
    }

    const startedAt = window.performance.now();
    const timer = window.setInterval(() => {
      setTick(window.performance.now() - startedAt);
    }, 80);

    return () => window.clearInterval(timer);
  }, [animated]);

  return (
    <div className="sb-retro-host-grid">
      <article
        className="sb-retro-host-card sb-retro-host-card--light"
        data-active={resolvedActiveTheme === "light" || resolvedActiveTheme === "both"}
      >
        <div className="sb-retro-host-copy">
          <span className="sb-retro-host-kicker">Light shell</span>
          <h2 className="sb-retro-host-title">Bright docs lane</h2>
          <p className="sb-retro-host-description">
            The same ANSI stream stays legible on a pale LCD surface instead of assuming dark glass.
          </p>
        </div>
        <RetroScreen
          mode="terminal"
          value={lightValue}
          displaySurfaceMode="light"
          displayColorMode="ansi-extended"
          rows={6}
          displayPadding={{ block: 12, inline: 14 }}
        />
      </article>
      <article
        className="sb-retro-host-card sb-retro-host-card--dark"
        data-active={resolvedActiveTheme === "dark" || resolvedActiveTheme === "both"}
      >
        <div className="sb-retro-host-copy">
          <span className="sb-retro-host-kicker">Dark shell</span>
          <h2 className="sb-retro-host-title">Night operations lane</h2>
          <p className="sb-retro-host-description">
            The exact same ANSI colors read differently, but still clearly, on the classic dark surface.
          </p>
        </div>
        <RetroScreen
          mode="terminal"
          value={darkValue}
          displaySurfaceMode="dark"
          displayColorMode="ansi-extended"
          rows={6}
          displayPadding={{ block: 12, inline: 14 }}
        />
      </article>
    </div>
  );
}

function LightDarkHostsStory() {
  const [activeTheme, setActiveTheme] = useState<"light" | "dark" | "both">("both");

  return (
    <StoryShell
      kicker="Light And Dark Shells"
      title="Let the host app pick the mood."
      copy="The component does not need the whole page to become a terminal. You can place the same ANSI-rich LCD inside a bright editorial shell or a deep operational shell and keep contrast readable in both."
      footer={
        <ul className="sb-retro-note-list">
          <li>Use the host page to define the light or dark surface around the display.</li>
          <li>`displaySurfaceMode` tunes the LCD glass, while ANSI colors still get contrast-safe rendering.</li>
        </ul>
      }
    >
      <div className="sb-retro-toolbar">
        {(["both", "light", "dark"] as const).map((entry) => (
          <button
            className="sb-retro-button"
            type="button"
            key={entry}
            data-active={entry === activeTheme}
            onClick={() => setActiveTheme(entry)}
          >
            {entry === "both" ? "Show both" : `${entry} focus`}
          </button>
        ))}
      </div>
      <Stage maxWidth={980}>
        <LightDarkHostsSurface activeTheme={activeTheme} />
      </Stage>
    </StoryShell>
  );
}

export function LightDarkHostsDemoStory() {
  return (
    <CaptureStage captureId="light-dark-hosts" maxWidth={980}>
      <LightDarkHostsSurface activeTheme="both" animated />
    </CaptureStage>
  );
}

export function FeatureTourStory() {
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
        <RetroScreen
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
        <RetroScreen
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
        <RetroScreen
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
        <RetroScreen
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
  title: "RetroScreen",
  component: RetroScreen,
  tags: ["autodocs"],
  excludeStories: /.*Story$/,
  args: {
    color: STORY_COLOR
  },
  parameters: {
    controls: {
      disable: true
    }
  }
} satisfies Meta<typeof RetroScreen>;

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
        <RetroScreen {...args} />
      </Stage>
    </StoryShell>
  )
};

export const TerminalStream: Story = {
  render: () => <TerminalStreamStory />
};

export const WhiteRabbitSignal: Story = {
  render: () => <WhiteRabbitSignalStory />
};

export const MatrixCodeRain: Story = {
  render: () => <MatrixCodeRainStory />
};

export function AnsiSurfaceStory() {
  return (
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
        <RetroScreen
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
  );
}

export const PromptLoop: Story = {
  render: () => <PromptConsoleStory />
};

export const DisplayColorModes: Story = {
  render: () => <DisplayColorModesStory />
};

export const LightDarkHosts: Story = {
  render: () => <LightDarkHostsStory />
};
