[![Feature Tour Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi.webp)](https://github.com/user-attachments/assets/6b09540f-8670-4f14-880b-c3f2cbdb34f3)

# react-retro-display-tty-ansi

[![npm version](https://img.shields.io/npm/v/react-retro-display-tty-ansi.svg)](https://www.npmjs.com/package/react-retro-display-tty-ansi)
[![test-station](https://github.com/smysnk/react-retro-display-tty-ansi/actions/workflows/test.yml/badge.svg?branch=main&label=test-station)](https://test-station.smysnk.com/projects/react-retro-display-tty-ansi)

Storybook: [smysnk.github.io/react-retro-display-tty-ansi](https://smysnk.github.io/react-retro-display-tty-ansi/)

`react-retro-display-tty-ansi` is a React component for calm, terminal-flavored interfaces.
It can be a read-only display, a controlled editable surface, a controller-driven terminal,
or a small command prompt without changing visual language. It also understands ANSI styling,
semantic display color modes, and an xterm-checked terminal behavior surface for real control
character playback. It can also project itself onto either dark or light LCD glass without
asking the whole app shell to follow.

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

## Display Padding

Use `displayPadding` when the screen content should sit tighter to the glass or breathe a little
more. The prop accepts:

- a number for uniform pixel padding
- a CSS length string for uniform padding
- an object with `block` and `inline`
- an object with per-side `top`, `right`, `bottom`, and `left`

```tsx
<RetroLcd mode="value" value="Tight framing" displayPadding={8} />

<RetroLcd mode="value" value="Room to breathe" displayPadding="1.25rem" />

<RetroLcd
  mode="terminal"
  displayPadding={{ block: 10, inline: 14 }}
  value="measured from the padded screen area"
/>

<RetroLcd
  mode="prompt"
  displayPadding={{ top: 6, right: 10, bottom: 12, left: 10 }}
/>
```

Because rows and columns are measured from the visible screen area, tighter padding yields a
denser grid and looser padding yields fewer cells.

## Light And Dark Surface Modes

Use `displaySurfaceMode` when the LCD itself should read like a light instrument panel or a
dark night-ops surface. This is separate from the host page theme, so the same ANSI-rich
terminal content can sit inside bright docs, dark dashboards, or a side-by-side comparison view.

[![Light And Dark Hosts Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-light-dark-hosts.webp)](https://github.com/user-attachments/assets/f8658ce6-e6b9-42f9-99cc-61d71d897e95)

```tsx
<RetroLcd
  mode="terminal"
  value={[
    "\u001b[1mLIGHT SURFACE\u001b[0m",
    "\u001b[38;5;160mR\u001b[38;5;214mA\u001b[38;5;190mI\u001b[38;5;45mN\u001b[38;5;39mB\u001b[38;5;141mO\u001b[38;5;201mW\u001b[0m contrast check",
    "\u001b[38;2;194;94;0mamber\u001b[0m  \u001b[38;2;0;104;181mblue\u001b[0m  \u001b[38;2;108;40;148mviolet\u001b[0m"
  ].join("\n")}
  displaySurfaceMode="light"
  displayColorMode="ansi-extended"
  displayPadding={{ block: 12, inline: 14 }}
/>

<RetroLcd
  mode="terminal"
  value={[
    "\u001b[1mDARK SURFACE\u001b[0m",
    "\u001b[38;5;160mR\u001b[38;5;214mA\u001b[38;5;190mI\u001b[38;5;45mN\u001b[38;5;39mB\u001b[38;5;141mO\u001b[38;5;201mW\u001b[0m contrast check",
    "\u001b[38;2;255;176;86mamber\u001b[0m  \u001b[38;2;102;198;255mblue\u001b[0m  \u001b[38;2;214;145;255mviolet\u001b[0m"
  ].join("\n")}
  displaySurfaceMode="dark"
  displayColorMode="ansi-extended"
  displayPadding={{ block: 12, inline: 14 }}
/>
```

Reach for `displaySurfaceMode="light"` when the LCD should feel like paper, enamel, or a sunlit
instrument panel. Keep `displaySurfaceMode="dark"` for the classic terminal-glass look. The
same ANSI palette will still be remapped for readable contrast against each surface.

## Modes Of Use

### 1. Quiet output

Use `mode="value"` when the display is just there to speak.

[![Quiet Output Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-quiet-output.webp)](https://github.com/user-attachments/assets/0d92a410-7151-4da8-bfc1-3b47151301b3)

```tsx
<RetroLcd
  mode="value"
  value="LINK STABLE\nAwaiting operator input."
/>
```

### 2. Editable drafting

Turn on `editable` when you want the same surface to behave like a controlled input.

[![Editable Drafting Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-editable-drafting.webp)](https://github.com/user-attachments/assets/6ce552c8-dd19-433a-8b14-9e64f376a33c)

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

[![Terminal Output Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-terminal-output.webp)](https://github.com/user-attachments/assets/79731222-0f78-482b-8684-dfc6aeb7d08c)

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

[![Prompt Interaction Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-prompt-loop.webp)](https://github.com/user-attachments/assets/c346c616-14fd-4b84-813b-545cd5d92f21)

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

## Auto Resize And Geometry Probing

When rows and columns matter to the program inside the display, listen to `onGeometryChange`,
turn that measurement into a terminal-style reply, and redraw from the reported size. The demo
below simulates a terminal app issuing `CSI 18 t`, receiving `CSI 8;<rows>;<cols>t`, then
repainting a full border and centered dimensions every time the DOM element resizes. The current
demo also cycles through tight screen padding, multiple border alphabets, oversized glyph styles,
and every monochrome plus ANSI display mode so the same terminal program can be watched under
different visual projections.

[![Auto Resize Probe Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-auto-resize-probe.webp)](https://github.com/user-attachments/assets/3cec7079-0a4b-4467-9c1b-84fea9875395)

```tsx
import {
  RetroLcd,
  createRetroLcdController
} from "react-retro-display-tty-ansi";

const controller = createRetroLcdController({
  rows: 9,
  cols: 34,
  cursorMode: "solid"
});

export function ResizingTerminalProbe() {
  return (
    <RetroLcd
      mode="terminal"
      controller={controller}
      displayPadding={{ block: 8, inline: 10 }}
      onGeometryChange={(geometry) => {
        const nextReply = `\u001b[8;${geometry.rows};${geometry.cols}t`;

        console.log("terminal reply:", nextReply);
        controller.reset();
        controller.resize(geometry.rows, geometry.cols);
        redrawBorderAndMetrics(controller, geometry.rows, geometry.cols);
      }}
    />
  );
}
```

This is useful for terminal-style dashboards, resize-aware prompts, or retro UIs that need to
center content, draw frames, or adapt layouts from the actual LCD grid instead of from CSS alone.
It is also a good place to project `displayColorMode` changes when you want the terminal behavior
to stay fixed while the display mood shifts around it.

## Terminal Color Modes

Use `displayColorMode` to decide how semantic terminal color should be projected onto the screen.
The phosphor modes keep the retro LCD personality even when the source emits ANSI color. The ANSI
modes preserve more of the source terminal palette.

[![Display Color Modes Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-display-color-modes.webp)](https://github.com/user-attachments/assets/c51b8e39-74e8-4a9f-add7-d26299886938)

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

[![Control Character Replay Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-control-character-replay.webp)](https://github.com/user-attachments/assets/35d6ba0e-cf4c-4ac5-8a5d-ebe090fa6b54)

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
- auto-resize geometry probing
- ANSI styling
- display color mode projection
- light and dark surface modes
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
