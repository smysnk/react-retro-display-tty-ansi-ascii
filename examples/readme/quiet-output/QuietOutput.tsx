import { useEffect, useState } from "react";
import { RetroScreen } from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

const MESSAGE = "LINK STABLE\nAwaiting operator input.";

export function QuietOutput() {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timers: number[] = [];
    let nextAt = 220;

    for (let index = 1; index <= MESSAGE.length; index += 1) {
      const character = MESSAGE[index - 1];
      timers.push(
        window.setTimeout(() => {
          setValue(MESSAGE.slice(0, index));
        }, nextAt)
      );
      nextAt += character === "\n" ? 260 : 92;
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  return <RetroScreen mode="value" value={value} color="#97ff9b" />;
}
