import type { ComponentType } from "react";
import { Description, Subtitle, Title } from "@storybook/addon-docs/blocks";
import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import * as RetroScreenStories from "../src/stories/RetroScreen.stories";
import * as AnsiDisplayBufferStories from "../src/stories/AnsiDisplayBuffer.stories";
import * as EditorStories from "../src/stories/Editor.stories";
import * as ResizeResponsiveStories from "../src/stories/ResizeResponsive.stories";
import { RetroDocsStoryPreview } from "../src/stories/retro-docs-story-preview";
import { projectAnnotations } from "./projectAnnotations";

const GITHUB_REPOSITORY_URL = "https://github.com/smysnk/react-retro-display-tty-ansi-ascii";
const NPM_PACKAGE_URL = "https://www.npmjs.com/package/react-retro-display-tty-ansi-ascii";
const STORYBOOK_URL = "https://smysnk.github.io/react-retro-display-tty-ansi-ascii/";
const CI_WORKFLOW_URL =
  "https://github.com/smysnk/react-retro-display-tty-ansi-ascii/actions/workflows/cicd.yml";
const ANSI_DISPLAY_SUPPORT_REPORT_URL =
  "https://github.com/smysnk/react-retro-display-tty-ansi-ascii/blob/main/docs/ansi-display-support-matrix.md";
const PUBLISHED_BADGE_BASE_URL =
  "https://smysnk.github.io/react-retro-display-tty-ansi-ascii/badges";
const GITHUB_BADGE_URL =
  "https://img.shields.io/badge/github-smysnk%2Freact--retro--display--tty--ansi--ascii-181717?logo=github&logoColor=white";
const TESTS_BADGE_URL =
  `https://img.shields.io/endpoint?url=${encodeURIComponent(`${PUBLISHED_BADGE_BASE_URL}/tests.json`)}`;
const COVERAGE_BADGE_URL =
  `https://img.shields.io/endpoint?url=${encodeURIComponent(`${PUBLISHED_BADGE_BASE_URL}/coverage.json`)}`;
const HEALTH_BADGE_URL =
  `https://img.shields.io/endpoint?url=${encodeURIComponent(`${PUBLISHED_BADGE_BASE_URL}/health.json`)}`;
const NPM_BADGE_URL = "https://img.shields.io/npm/v/react-retro-display-tty-ansi-ascii?label=npm";

const badgeLinks = [
  {
    href: GITHUB_REPOSITORY_URL,
    label: "github repository",
    src: GITHUB_BADGE_URL
  },
  {
    href: NPM_PACKAGE_URL,
    label: "npm version",
    src: NPM_BADGE_URL
  },
  {
    href: CI_WORKFLOW_URL,
    label: "test status",
    src: TESTS_BADGE_URL
  },
  {
    href: CI_WORKFLOW_URL,
    label: "coverage",
    src: COVERAGE_BADGE_URL
  },
  {
    href: CI_WORKFLOW_URL,
    label: "health",
    src: HEALTH_BADGE_URL
  }
];

setProjectAnnotations(projectAnnotations);

const {
  CalmReadout,
  DisplayColorModes,
  FitWidthLockedFrame,
  LightDarkHosts,
  MatrixCodeRain,
  MidjourneyVortex,
  PromptLoop,
  TerminalStream,
  WhiteRabbitSignal
} = composeStories(RetroScreenStories);

const {
  AnsiSurface,
  BadAppleAnsi,
  BadAppleAnsiGzipStream,
  ControlCharacterReplay,
  DisplayBuffer
} = composeStories(AnsiDisplayBufferStories);

const {
  EditableNotebook,
  EditorSelectionLab,
  EditorSelectionReadOnly,
  EditorSelectionWrapped,
  EditorWordSelectionLab
} = composeStories(EditorStories);

const {
  AutoResizeProbe,
  ResizablePanel,
  ResizablePanelLeadingEdges,
  ResponsivePanel
} = composeStories(ResizeResponsiveStories);

export function RetroScreenDocsPage() {
  const renderStory = (
    story: ComponentType | undefined,
    key: string,
    options?: {
      eager?: boolean;
    }
  ) => {
    if (!story) {
      return null;
    }

    const Story = story;
    const storyTitle = story.storyName ?? story.name ?? key;
    const eager = options?.eager ?? false;

    return (
      <RetroDocsStoryPreview eager={eager} key={key} story={Story} storyKey={key} storyTitle={storyTitle} />
    );
  };

  return (
    <div className="sb-retro-docs-page">
      <header className="sb-retro-docs-hero">
        <span className="sb-retro-kicker">React Retro Terminal Surfaces</span>
        <Title />
        <Subtitle />
        <div className="sb-retro-docs-badges">
          {badgeLinks.map((badge) => (
            <a key={badge.label} href={badge.href} target="_blank" rel="noreferrer">
              <img alt={badge.label} src={badge.src} />
            </a>
          ))}
        </div>
        <div className="sb-retro-docs-link-copy">
          <a href={STORYBOOK_URL} target="_blank" rel="noreferrer">
            Published Storybook
          </a>
          <span aria-hidden="true">·</span>
          <a href={ANSI_DISPLAY_SUPPORT_REPORT_URL} target="_blank" rel="noreferrer">
            ANSI Display Support Matrix
          </a>
          <span aria-hidden="true">·</span>
          <a href={CI_WORKFLOW_URL} target="_blank" rel="noreferrer">
            Latest CI Runs
          </a>
        </div>
        <div className="sb-retro-docs-description">
          <Description />
        </div>
      </header>
      <section className="sb-retro-docs-section">
        <h2>Core Modes</h2>
        <p>The main readout, terminal, prompt, and cinematic demos live here.</p>
        {[
          renderStory(CalmReadout, "calm-readout", { eager: true }),
          renderStory(FitWidthLockedFrame, "fit-width-locked-frame", { eager: true }),
          renderStory(TerminalStream, "terminal-stream", { eager: true }),
          renderStory(PromptLoop, "prompt-loop"),
          renderStory(WhiteRabbitSignal, "white-rabbit-signal"),
          renderStory(MatrixCodeRain, "matrix-code-rain"),
          renderStory(MidjourneyVortex, "midjourney-vortex"),
          renderStory(DisplayColorModes, "display-color-modes"),
          renderStory(LightDarkHosts, "light-dark-hosts")
        ]}
      </section>
      <section className="sb-retro-docs-section">
        <h2>ANSI And Buffer Playback</h2>
        <p>ANSI styling, scrollback, replay, and large playback examples.</p>
        {[
          renderStory(AnsiSurface, "ansi-surface"),
          renderStory(ControlCharacterReplay, "control-character-replay"),
          renderStory(DisplayBuffer, "display-buffer"),
          renderStory(BadAppleAnsi, "bad-apple-ansi"),
          renderStory(BadAppleAnsiGzipStream, "bad-apple-ansi-gzip-stream")
        ]}
      </section>
      <section className="sb-retro-docs-section">
        <h2>Editor Modes</h2>
        <p>Selection, editing, wrapping, and read-only editor flows.</p>
        {[
          renderStory(EditableNotebook, "editable-notebook"),
          renderStory(EditorSelectionLab, "editor-selection-lab"),
          renderStory(EditorSelectionWrapped, "editor-selection-wrapped"),
          renderStory(EditorWordSelectionLab, "editor-word-selection-lab"),
          renderStory(EditorSelectionReadOnly, "editor-selection-read-only")
        ]}
      </section>
      <section className="sb-retro-docs-section">
        <h2>Responsive Panels</h2>
        <p>Geometry-aware layouts, auto-resize behavior, and live resize handles.</p>
        {[
          renderStory(ResponsivePanel, "responsive-panel"),
          renderStory(ResizablePanel, "resizable-panel"),
          renderStory(ResizablePanelLeadingEdges, "resizable-panel-leading-edges"),
          renderStory(AutoResizeProbe, "auto-resize-probe")
        ]}
      </section>
    </div>
  );
}
