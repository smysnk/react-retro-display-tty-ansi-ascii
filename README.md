[![Feature Tour Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi.webp)](https://github.com/user-attachments/assets/c0ccd3ff-147b-4b8f-b214-47bddb2419d1)

# react-retro-display-tty-ansi

[![npm](https://img.shields.io/npm/v/react-retro-display-tty-ansi?label=npm)](https://www.npmjs.com/package/react-retro-display-tty-ansi)
[![tests](https://img.shields.io/endpoint?url=https%3A%2F%2Fsmysnk.github.io%2Freact-retro-display-tty-ansi%2Fbadges%2Ftests.json)](https://smysnk.github.io/react-retro-display-tty-ansi/)
[![coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fsmysnk.github.io%2Freact-retro-display-tty-ansi%2Fbadges%2Fcoverage.json)](https://smysnk.github.io/react-retro-display-tty-ansi/)

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
import { RetroScreen } from "react-retro-display-tty-ansi";
import "react-retro-display-tty-ansi/styles.css";

export function StatusCard() {
  return (
    <RetroScreen
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
<RetroScreen mode="value" value="Tight framing" displayPadding={8} />

<RetroScreen mode="value" value="Room to breathe" displayPadding="1.25rem" />

<RetroScreen
  mode="terminal"
  displayPadding={{ block: 10, inline: 14 }}
  value="measured from the padded screen area"
/>

<RetroScreen
  mode="prompt"
  displayPadding={{ top: 6, right: 10, bottom: 12, left: 10 }}
/>
```

RetroScreen also shows a focus glow around the shell by default so editable, prompt, and terminal
surfaces clearly read as active. Disable it when you want a quieter shell:

```tsx
<RetroScreen mode="terminal" focusGlow={false} />
```

Because rows and columns are measured from the visible screen area, tighter padding yields a
denser grid and looser padding yields fewer cells.

## Resizable Panels

Use `resizable` when the panel itself should be draggable instead of only responding to layout
changes around it. The live Storybook demo now shows a visible mouse cursor grabbing the real
handles, including the optional leading-edge handles, so the docs match the shipped interaction.

[![Resizable Panel Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-resizable-panel.webp)](https://github.com/user-attachments/assets/227b03f2-23a1-43eb-91b1-e326988313da)

```tsx
<RetroScreen
  mode="terminal"
  resizable="both"
  resizableLeadingEdges
  displayPadding={{ block: 12, inline: 14 }}
  value={[
    "All resize handles are live here.",
    "",
    "Drag left, right, top, bottom, or either corner.",
    "Rows and columns recompute as the panel changes size."
  ].join("\n")}
/>
```

Reach for:

- `resizable="width"` when the panel should only stretch sideways
- `resizable="height"` when it should stack or collapse vertically
- `resizable` or `resizable="both"` for freeform terminal panes
- `resizableLeadingEdges` when left, top, and top-left handles should join the same interaction surface

## Light And Dark Surface Modes

Use `displaySurfaceMode` when the LCD itself should read like a light instrument panel or a
dark night-ops surface. This is separate from the host page theme, so the same ANSI-rich
terminal content can sit inside bright docs, dark dashboards, or a side-by-side comparison view.

[![Light And Dark Hosts Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-light-dark-hosts.webp)](https://github.com/user-attachments/assets/fb758db8-d014-46b3-96fc-cc649bf0c475)

```tsx
<RetroScreen
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

<RetroScreen
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

[![Quiet Output Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-quiet-output.webp)](https://github.com/user-attachments/assets/df971b76-3de6-4686-833a-8fad19a66832)

```tsx
<RetroScreen
  mode="value"
  value="LINK STABLE\nAwaiting operator input."
/>
```

### 2. Signal intercept

Use a controller when the display should reveal text over time and the cadence matters as much as the message.

[![White Rabbit Signal Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-white-rabbit-signal.webp)](https://github.com/user-attachments/assets/f05998aa-40a0-4c51-9612-025b5e5f5b29)

```tsx
import { useEffect } from "react";
import {
  RetroScreen,
  createRetroScreenController
} from "react-retro-display-tty-ansi";

const controller = createRetroScreenController({
  rows: 5,
  cols: 34,
  cursorMode: "solid"
});

export function WhiteRabbitSignal() {
  useEffect(() => {
    controller.reset();
    controller.write("Wake up, Neo...");
  }, []);

  return <RetroScreen mode="terminal" controller={controller} />;
}
```

The Storybook version uses timed writes and screen clears so the four-line sequence lands like a late-night intercepted signal instead of a static quote.

### 3. Matrix code rain

Use the terminal renderer as a dense animated display surface when you want the operators' green rain instead of a message prompt.

[![Matrix Code Rain Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-matrix-code-rain.webp)](https://github.com/user-attachments/assets/df2c7fdc-cd27-4296-8f70-1373fdfb63aa)

```tsx
import type { CSSProperties } from "react";
import { RetroScreen, createRetroScreenController } from "react-retro-display-tty-ansi";

const controller = createRetroScreenController({ rows: 24, cols: 58 });
const matrixFontStyle = {
  "--retro-screen-font-family": "\"Matrix\""
} as CSSProperties;

<RetroScreen
  mode="terminal"
  controller={controller}
  gridMode="static"
  rows={24}
  cols={58}
  displayColorMode="ansi-extended"
  color="#8efe8e"
  displayFontScale={1.05}
  displayRowScale={1.08}
  displayPadding={{ block: 12, inline: 14 }}
  style={matrixFontStyle}
/>
```

The Storybook demo keeps the glyphs planted on the grid and moves waves of illumination through them so the effect feels closer to the movie than a simple falling-text loop. It uses the bundled `Matrix` font.

### 4. Editable drafting

Turn on `editable` when you want the same surface to behave like a controlled input.

[![Editable Drafting Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-editable-drafting.webp)](https://github.com/user-attachments/assets/5670d23a-c794-46a0-bb40-784f04a2da14)

```tsx
import { useState } from "react";

export function DraftPad() {
  const [value, setValue] = useState("");

  return (
    <RetroScreen
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

### 5. Terminal output from a controller

Use a controller when the display should follow external writes over time.

[![Terminal Output Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-terminal-output.webp)](https://github.com/user-attachments/assets/57258c51-5afd-4164-87dd-d30b85726a26)

```tsx
import { useEffect } from "react";
import {
  RetroScreen,
  createRetroScreenController
} from "react-retro-display-tty-ansi";

const controller = createRetroScreenController({
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

  return <RetroScreen mode="terminal" controller={controller} />;
}
```

If you already have a terminal-like buffer as a string, `mode="terminal"` also accepts `value`
or `initialBuffer`.

## Live TTY Websocket Bridge

`RetroScreen` can also act as the browser-side surface for a real TTY session. The transport
stays outside the component, while the component handles geometry, keyboard capture, paste,
focus reporting, mouse reporting, alternate-screen rendering, title updates, and bell metadata.

[![Live Tty Terminal Bridge Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-live-tty-terminal-bridge.webp)](https://github.com/user-attachments/assets/8e525d78-ddf1-4604-bdcc-d05f6d817489)

The demo sequence is recorded from a live shell session and stages the kind of workload this
bridge is built for: a live-updating `top` session, a fullscreen `vim` pass, and a `nano`
screen with help bars and cursor-owned chrome.

```tsx
import {
  RetroScreen,
  createRetroScreenWebSocketSession
} from "react-retro-display-tty-ansi";

const session = createRetroScreenWebSocketSession({
  url: "ws://127.0.0.1:8787",
  openPayload: {
    cwd: "/workspace",
    term: "xterm-256color"
  }
});

export function LiveShell() {
  return (
    <RetroScreen
      mode="terminal"
      session={session}
      autoFocus
      displayColorMode="ansi-extended"
      displayPadding={{ block: 12, inline: 14 }}
    />
  );
}
```

For local development, the repo includes a reference `node-pty` websocket backend:

```bash
yarn tty:server
```

By default, that example server starts a themed demo shell rooted at `~/tty-demo` with the
prompt `operator@retro:~/tty-demo$`, so the live story and the recorded bridge demo share the
same shell framing.

There is also a dedicated Storybook story for this path. It now defaults to the local example
server at `ws://127.0.0.1:8787`, so if `yarn tty:server` is already running you can open the
`Live Tty Terminal Bridge` story directly without adding any extra query params.

If you want to override the target or the open payload, use:

```js
window.__RETRO_SCREEN_TTY_DEMO__ = {
  url: "ws://127.0.0.1:8787",
  openPayload: {
    cwd: "/Users/josh/play/react-retro-display",
    term: "xterm-256color"
  }
};
```

The example server now supports token checks, origin checks, idle timeouts, payload-size limits,
and optional command/cwd/env override restrictions. See
[examples/node-tty-websocket-server/README.md](/Users/josh/play/react-retro-display/examples/node-tty-websocket-server/README.md)
for the available flags.

### 6. Prompt-first interaction

Use `mode="prompt"` when the interface should feel like a guided shell.

[![Prompt Interaction Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-prompt-loop.webp)](https://github.com/user-attachments/assets/75eec8ea-6da7-41f4-98be-f17e5284980a)

```tsx
<RetroScreen
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
<RetroScreen
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
const controller = createRetroScreenController({
  rows: 9,
  cols: 46,
  scrollback: 400
});

<RetroScreen mode="terminal" controller={controller} />
```

The browser suite now covers this path directly, including paging, wheel scrolling, anchored
scrollback while new lines arrive, and auto-follow recovery back to the live tail.

## Auto Resize And Geometry Probing

When rows and columns matter to the program inside the display, listen to `onGeometryChange`,
turn that measurement into a terminal-style reply, and redraw from the reported size. The demo
below simulates a terminal app issuing `CSI 18 t`, receiving `CSI 8;<rows>;<cols>t`, then
repainting a full border and centered dimensions every time the panel resizes. The current demo
shows a visible cursor dragging the real resize handles, pauses if you intervene manually, and
still cycles through tight screen padding, multiple border alphabets, oversized glyph styles,
plus every monochrome and ANSI display mode so the same terminal program can be watched under
different visual projections.

[![Auto Resize Probe Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-auto-resize-probe.webp)](https://github.com/user-attachments/assets/2dfd68d7-284c-4895-ad5f-fb513cb09c80)

```tsx
import {
  RetroScreen,
  createRetroScreenController
} from "react-retro-display-tty-ansi";

const controller = createRetroScreenController({
  rows: 9,
  cols: 34,
  cursorMode: "solid"
});

export function ResizingTerminalProbe() {
  return (
    <RetroScreen
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

[![Display Color Modes Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-display-color-modes.webp)](https://github.com/user-attachments/assets/3536a8f4-fe5d-401d-af79-1f2e707f2ce5)

Available modes:

- `phosphor-green`
- `phosphor-amber`
- `phosphor-ice`
- `ansi-classic`
- `ansi-extended`

```tsx
<RetroScreen
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

## ANSI Art Playback

Storybook now includes a dedicated `Bad Apple ANSI` demo that loads the real ANSI release,
decodes the original IBM VGA / CP437 bytes outside the display component, and then feeds those
bytes into the reusable `RetroScreenAnsiPlayer` wrapper. The player incrementally materializes
stabilized full-screen `80 x 25` snapshots while the parent owns byte loading and streaming. The
demo uses the full `BADAPPLE.ANS` payload, not a trimmed excerpt, and tightens the glyph scale so
the character rows visually sit flush instead of leaving air between scanlines.

[![Bad Apple ANSI Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-bad-apple-ansi.webp)](https://github.com/user-attachments/assets/82d505be-5296-4139-ab64-83aae59804ad)

The README clip is a 30-second capture of the real ANSI-art playback path, not a separate video renderer.

Credit for the original ANSI release goes to [Mistigris](https://mistigris.org/).

Open it here:
[smysnk.github.io/react-retro-display-tty-ansi/?path=/story/retroscreen-display-buffer--bad-apple-ansi](https://smysnk.github.io/react-retro-display-tty-ansi/?path=/story/retroscreen-display-buffer--bad-apple-ansi)

The Storybook demo is backed by the bundled asset at
[src/stories/assets/bad-apple.ans](/Users/josh/play/react-retro-display/src/stories/assets/bad-apple.ans).

The key wiring for this kind of ANSI-art playback is:

```tsx
<RetroScreenAnsiPlayer
  byteStream={asset.byteStream}
  rows={25}
  cols={80}
  frameDelayMs={asset.frameDelayMs}
  complete
  loop
  displayColorMode="ansi-classic"
  displayPadding={{ block: 8, inline: 12 }}
  displayFontScale={1.22}
  displayRowScale={1.14}
  style={{ width: "1010px", height: "642px" }}
/>
```

Use `RetroScreenAnsiPlayer` when a parent is responsible for supplying ANSI bytes or byte chunks,
including incremental streams. Keep the asset loading outside the display component, pass the
native `rows` and `cols` so the art is not reflowed, and use `displayFontScale` plus
`displayRowScale` to densify the rendered glyphs when you want ANSI art to read as a continuous
image instead of separated text lines. For the Bad Apple panel, the demo also uses a container
size that lands on exact `12x24` cell geometry after padding and bezel chrome, which avoids
fractional row heights and helps eliminate subpixel seams.

## Control-Character Playback

The terminal path is now tested against an xterm oracle and can faithfully replay real control
character effects like carriage return rewrites, erase-in-line, scroll regions, insert-line
updates, ANSI 16-color, indexed 256-color, and truecolor output.

[![Control Character Replay Demo](https://raw.githubusercontent.com/smysnk/react-retro-display-tty-ansi/main/docs/assets/react-retro-display-tty-ansi-control-character-replay.webp)](https://github.com/user-attachments/assets/682d8e92-7871-420e-9e6d-a6a92b60c0fe)

```tsx
import {
  RetroScreen,
  createRetroScreenController
} from "react-retro-display-tty-ansi";

const controller = createRetroScreenController({ rows: 6, cols: 34 });

controller.write("Downloading fixtures... 12%");
controller.write("\rDownloading fixtures... 73%");
controller.write("\r\u001b[32mDownloaded fixtures.\u001b[0m\u001b[K\r\n");
controller.write("\u001b[2;6r");
controller.write(
  "\u001b[6;1H\u001b[L\u001b[38;2;255;180;120mrecorded regression fixture\u001b[0m"
);

<RetroScreen
  mode="terminal"
  controller={controller}
  displayColorMode="ansi-extended"
/>
```

The same trace fixtures used in Storybook are also exercised in the terminal verification layers:

```bash
yarn test:conformance
yarn test:tty
yarn test:e2e:tty
yarn test:e2e
```

The TTY-specific checks skip themselves automatically in environments where `node-pty` cannot
allocate a TTY session, but they run normally on TTY-capable developer machines and CI runners.

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
- resizable live panels with scripted handle demos
- auto-resize geometry probing
- live TTY bridge wiring
- ANSI art playback
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

Useful extra checks:

```bash
yarn test:tty
yarn test:e2e:tty
yarn perf:terminal
```
