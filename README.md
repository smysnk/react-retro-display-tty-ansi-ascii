<video src="./docs/assets/react-retro-display-tty-ansi.mp4" width="100%" autoplay controls muted playsinline loop></video>

# react-retro-display-tty-ansi

`react-retro-display-tty-ansi` is a React component for calm, terminal-flavored interfaces.
It can be a read-only display, a controlled editable surface, a controller-driven terminal,
or a small command prompt without changing visual language.

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

<video src="./docs/assets/react-retro-display-tty-ansi-quiet-output.mp4" width="100%" autoplay controls muted playsinline loop></video>

```tsx
<RetroLcd
  mode="value"
  value="LINK STABLE\nAwaiting operator input."
/>
```

### 2. Editable drafting

Turn on `editable` when you want the same surface to behave like a controlled input.

<video src="./docs/assets/react-retro-display-tty-ansi-editable-drafting.mp4" width="100%" autoplay controls muted playsinline loop></video>

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

<video src="./docs/assets/react-retro-display-tty-ansi-terminal-output.mp4" width="100%" autoplay controls muted playsinline loop></video>

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

<video src="./docs/assets/react-retro-display-tty-ansi-prompt-loop.mp4" width="100%" autoplay controls muted playsinline loop></video>

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
- ANSI styling
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
npm run storybook
```
