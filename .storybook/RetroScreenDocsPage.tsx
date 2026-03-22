import { Description, Subtitle, Title } from "@storybook/addon-docs/blocks";
import {
  CalmReadout,
  DisplayColorModes,
  LightDarkHosts,
  MatrixCodeRain,
  PromptLoop,
  TerminalStream,
  WhiteRabbitSignal
} from "../src/stories/RetroScreen.stories";
import {
  AnsiSurface,
  BadAppleAnsi,
  BadAppleAnsiGzipStream,
  ControlCharacterReplay,
  DisplayBuffer
} from "../src/stories/AnsiDisplayBuffer.stories";
import {
  EditableNotebook,
  EditorSelectionLab,
  EditorSelectionReadOnly,
  EditorSelectionWrapped,
  EditorWordSelectionLab
} from "../src/stories/Editor.stories";
import {
  AutoResizeProbe,
  ResizablePanel,
  ResizablePanelLeadingEdges,
  ResponsivePanel
} from "../src/stories/ResizeResponsive.stories";

const GITHUB_REPOSITORY_URL = "https://github.com/smysnk/react-retro-display-tty-ansi";
const NPM_PACKAGE_URL = "https://www.npmjs.com/package/react-retro-display-tty-ansi";
const STORYBOOK_URL = "https://smysnk.github.io/react-retro-display-tty-ansi/";
const TEST_REPORT_URL = "https://test-station.smysnk.com/projects/react-retro-display-tty-ansi";
const GITHUB_BADGE_URL =
  "https://img.shields.io/badge/github-smysnk%2Freact--retro--display--tty--ansi-181717?logo=github&logoColor=white";
const TESTS_BADGE_URL =
  "https://img.shields.io/endpoint?url=https%3A%2F%2Fsmysnk.github.io%2Freact-retro-display-tty-ansi%2Fbadges%2Ftests.json";
const COVERAGE_BADGE_URL =
  "https://img.shields.io/endpoint?url=https%3A%2F%2Fsmysnk.github.io%2Freact-retro-display-tty-ansi%2Fbadges%2Fcoverage.json";
const HEALTH_BADGE_URL =
  "https://img.shields.io/endpoint?url=https%3A%2F%2Fsmysnk.github.io%2Freact-retro-display-tty-ansi%2Fbadges%2Fhealth.json";
const NPM_BADGE_URL = "https://img.shields.io/npm/v/react-retro-display-tty-ansi?label=npm";

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
    href: STORYBOOK_URL,
    label: "test status",
    src: TESTS_BADGE_URL
  },
  {
    href: STORYBOOK_URL,
    label: "coverage",
    src: COVERAGE_BADGE_URL
  },
  {
    href: STORYBOOK_URL,
    label: "health",
    src: HEALTH_BADGE_URL
  }
];

export function RetroScreenDocsPage() {
  const renderStory = (story, key) => {
    if (typeof story?.render !== "function") {
      return null;
    }

    return (
      <div className="sb-retro-docs-story" data-docs-story={key} key={key}>
        {story.name ? <h3>{story.name}</h3> : null}
        {story.render(story.args ?? {})}
      </div>
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
          <a href={TEST_REPORT_URL} target="_blank" rel="noreferrer">
            Latest Test Report
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
          renderStory(CalmReadout, "calm-readout"),
          renderStory(TerminalStream, "terminal-stream"),
          renderStory(PromptLoop, "prompt-loop"),
          renderStory(WhiteRabbitSignal, "white-rabbit-signal"),
          renderStory(MatrixCodeRain, "matrix-code-rain"),
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
