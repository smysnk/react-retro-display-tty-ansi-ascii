<video src="https://github.com/user-attachments/assets/2be69856-c4d4-4f8e-8155-191f3836b96a" autoplay controls loop muted playsinline title="Feature Tour Demo">
  Your browser does not support the video tag.
</video>

# react-retro-display-tty-ansi

[![npm version](https://img.shields.io/npm/v/react-retro-display-tty-ansi.svg)](https://www.npmjs.com/package/react-retro-display-tty-ansi)
[![test-station](https://github.com/smysnk/react-retro-display-tty-ansi/actions/workflows/test.yml/badge.svg?branch=main&label=test-station)](https://test-station.smysnk.com/projects/react-retro-display-tty-ansi)

`react-retro-display-tty-ansi` is a React component for calm, terminal-flavored interfaces.
It can be a read-only display, a controlled editable surface, a controller-driven terminal,
or a small command prompt without changing visual language. It also understands ANSI styling,
semantic display color modes, and an xterm-checked terminal behavior surface for real control
character playback.

Latest test report: [test-station.smysnk.com/projects/react-retro-display-tty-ansi](https://test-station.smysnk.com/projects/react-retro-display-tty-ansi)

## Getting Started

Install the package, bring in the shared stylesheet, and start with the simplest thing:

```bash
npm install react-retro-display-tty-ansi
```

```tsx
import { RetroLcd } from "react-retro-display-tty-ansi";
import "react-retro-display-tty-ansi/styles.css";

export function StatusCard() {
  return (
    <RetroLcd
      mode="value"
      value="SYSTEM READY"
      color="#97ff9b"
    />
  );
}
```

That is the whole entry point.
You hand the component a mode, a value or controller when needed, and let it handle the grid,
wrapping, cursor rendering, and terminal feel.

## Modes Of Use

### 1. Quiet output

Use `mode="value"` when the display is just there to speak.

<video src="https://github.com/user-attachments/assets/4942d6d1-b68f-45aa-af69-d15e8a262fcb" autoplay controls loop muted playsinline title="Quiet Output Demo">
  Your browser does not support the video tag.
</video>

```tsx
<RetroLcd
  mode="value"
  value="LINK STABLE\nAwaiting operator input."
/>
```

### 2. Editable drafting

Turn on `editable` when you want the same surface to behave like a controlled input.

<video src="https://github.com/user-attachments/assets/78600036-e1f7-4898-a7db-05c2255729ae" autoplay controls loop muted playsinline title="Editable Drafting Demo">
  Your browser does not support the video tag.
</video>

```tsx
import { useState } from "react";

export function DraftPad() {
  const [value, setValue] = useState("");

  return (
    <RetroLcd
      mode="value"
      value={value}
      editable
      autoFocus
      placeholder="Write a line, then press Enter."
      onChange={setValue}
      onSubmit={(submitted) => {
        console.log("submitted:", submitted);
      }}
    />
  );
}
```

### 3. Terminal output from a controller

Use a controller when the display should follow external writes over time.

<video src="https://github.com/user-attachments/assets/a7d6ebbf-8f6f-4239-b8f7-9ca0523fff28" autoplay controls loop muted playsinline title="Terminal Output Demo">
  Your browser does not support the video tag.
</video>

```tsx
import { useEffect } from "react";
import {
  RetroLcd,
  createRetroLcdController
} from "react-retro-display-tty-ansi";

const controller = createRetroLcdController({
  rows: 9,
  cols: 46,
  cursorMode: "hollow"
});

export function StreamedTerminal() {
  useEffect(() => {
    controller.reset();
    controller.writeln("BOOT  react-retro-display-tty-ansi");
    controller.write("\u001b[1mREADY\u001b[0m ansi parser online");
  }, []);

  return <RetroLcd mode="terminal" controller={controller} />;
}
```

If you already have a terminal-like buffer as a string, `mode="terminal"` also accepts `value`
or `initialBuffer`.

### 4. Prompt-first interaction

Use `mode="prompt"` when the interface should feel like a guided shell.

<video src="https://github.com/user-attachments/assets/f8f40e8b-d658-4808-a12b-9dfd15ef215d" autoplay controls loop muted playsinline title="Prompt Interaction Demo">
  Your browser does not support the video tag.
</video>

```tsx
<RetroLcd
  mode="prompt"
  autoFocus
  promptChar="$"
  acceptanceText="READY"
  rejectionText="DENIED"
  onCommand={async (command) => {
    if (command === "status") {
      return {
        accepted: true,
        response: ["grid synced", "cursor stable"]
      };
    }

    return {
      accepted: false,
      response: "unknown command"
    };
  }}
/>
```

## Display Buffer And Follow Mode

Terminal and prompt surfaces now expose a real display buffer instead of only showing the live
viewport. That means you can scroll back through recent output, inspect older lines, then return
to the live tail when you are ready to follow the stream again.

Built-in behavior:

- `PageUp` and `PageDown` move through the display buffer
- mouse wheel scrolling moves through the same history
- `End` returns terminal mode to the live tail
- auto-follow starts enabled, turns off when you scroll back, and turns back on when you return to the bottom

Use `bufferSize` to control how many rows of history the component-managed terminal or prompt
surface keeps, and `defaultAutoFollow` if you want the view to start detached from the tail.

```tsx
<RetroLcd
  mode="terminal"
  bufferSize={400}
  defaultAutoFollow
  value={[
    "line-01  warm boot",
    "line-02  telemetry stable",
    "line-03  waiting for operator"
  ].join("\n")}
/>
```

If you are driving the component with your own controller, configure the underlying buffer size on
the controller itself:

```tsx
const controller = createRetroLcdController({
  rows: 9,
  cols: 46,
  scrollback: 400
});

<RetroLcd mode="terminal" controller={controller} />
```

The browser suite now covers this path directly, including paging, wheel scrolling, anchored
scrollback while new lines arrive, and auto-follow recovery back to the live tail.

## Terminal Color Modes

Use `displayColorMode` to decide how semantic terminal color should be projected onto the screen.
The phosphor modes keep the retro LCD personality even when the source emits ANSI color. The ANSI
modes preserve more of the source terminal palette.

<video src="https://github.com/user-attachments/assets/7ce144e3-672c-490b-9eeb-230c22f847fc" autoplay controls loop muted playsinline title="Display Color Modes Demo">
  Your browser does not support the video tag.
</video>

Available modes:

- `phosphor-green`
- `phosphor-amber`
- `phosphor-ice`
- `ansi-classic`
- `ansi-extended`

```tsx
<RetroLcd
  mode="terminal"
  displayColorMode="ansi-extended"
  value={[
    "\u001b[31mALERT\u001b[0m \u001b[32mlink stable\u001b[0m",
    "\u001b[38;5;196mindexed 196\u001b[0m from the 256-color palette",
    "\u001b[38;2;255;180;120mtruecolor 255,180,120\u001b[0m"
  ].join("\n")}
/>
```

Reach for `ansi-classic` when you want the familiar 16-color terminal profile, or
`ansi-extended` when 256-color and truecolor cells should survive all the way to the display.

## Control-Character Playback

The terminal path is now tested against an xterm oracle and can faithfully replay real control
character effects like carriage return rewrites, erase-in-line, scroll regions, insert-line
updates, ANSI 16-color, indexed 256-color, and truecolor output.

<video src="https://github.com/user-attachments/assets/77e6ffed-d352-487c-92e7-9f72befdebb8" autoplay controls loop muted playsinline title="Control Character Replay Demo">
  Your browser does not support the video tag.
</video>

```tsx
import {
  RetroLcd,
  createRetroLcdController
} from "react-retro-display-tty-ansi";

const controller = createRetroLcdController({ rows: 6, cols: 34 });

controller.write("Downloading fixtures... 12%");
controller.write("\rDownloading fixtures... 73%");
controller.write("\r\u001b[32mDownloaded fixtures.\u001b[0m\u001b[K\r\n");
controller.write("\u001b[2;6r");
controller.write(
  "\u001b[6;1H\u001b[L\u001b[38;2;255;180;120mrecorded regression fixture\u001b[0m"
);

<RetroLcd
  mode="terminal"
  controller={controller}
  displayColorMode="ansi-extended"
/>
```

The same trace fixtures used in Storybook are also exercised in the terminal verification layers:

```bash
yarn test:conformance
yarn test:e2e
```

## Ease Of Integration

The component is intentionally small at the edge:

- Start with `mode="value"` when all you need is a beautiful terminal-like readout.
- Add `editable` if the content should be controlled by React state.
- Switch to `mode="terminal"` when output is driven by a stream or controller.
- Switch to `mode="prompt"` when commands and responses should live in one transcript.
- Listen to `onGeometryChange` if rows and columns matter to the rest of your app.

## Storybook

Storybook now acts as the living demo surface for the package.
It includes stories for the main user journeys:

- read-only display
- editable drafting
- controller-fed terminal output
- display buffer paging and follow mode
- ANSI styling
- display color mode projection
- control-character replay fixtures
- prompt interaction
- responsive geometry
- a capture-ready feature tour

Run it locally with:

```bash
npm install
npm run storybook
```

## Development

```bash
npm install
npm run build
npm run test
npm run test:unit
npm run storybook
```
