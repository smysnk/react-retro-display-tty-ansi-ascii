import { useEffect, useState } from "react";
import {
  RetroScreen,
  createRetroScreenController
} from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

const OUTPUT_SEQUENCE = [
  {
    at: 260,
    text: "BOOT   react-retro-display-tty-ansi-ascii",
    appendNewline: true
  },
  {
    at: 1120,
    text: "CHECK  controller attached",
    appendNewline: true
  },
  {
    at: 2080,
    text: "\u001b[1mREADY\u001b[0m ansi parser online",
    appendNewline: true
  },
  {
    at: 3140,
    text: "\u001b[2msoft notes stay readable without stealing focus\u001b[0m",
    appendNewline: true
  },
  {
    at: 4320,
    text: "\u001b[7mLIVE\u001b[0m output keeps pace with external writes",
    appendNewline: false
  }
] as const;

export function TerminalOutput() {
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

    const timers = OUTPUT_SEQUENCE.map(({ at, text, appendNewline }) =>
      window.setTimeout(() => {
        if (appendNewline) {
          controller.writeln(text);
        } else {
          controller.write(text);
        }
      }, at)
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [controller]);

  return (
    <RetroScreen
      mode="terminal"
      controller={controller}
      color="#97ff9b"
    />
  );
}
