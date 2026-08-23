import { useEffect, useState } from "react";
import {
  RetroScreen,
  createRetroScreenController
} from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

const SIGNAL_PHRASES = [
  { text: "Wake up, Neo...", pauseAfter: 1360 },
  { text: "The Matrix has you...", pauseAfter: 1220 },
  { text: "Follow the white rabbit.", pauseAfter: 1220 },
  { text: "Knock, knock, Neo.", pauseAfter: 0 }
] as const;

export function WhiteRabbitSignal() {
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

    const getTypingDelay = (character: string, nextCharacter?: string) => {
      if (character === " ") return 86;
      if (character === ",") return 214;
      if (character === "." && nextCharacter === ".") return 70;
      if (character === ".") return 320;
      if (/[A-Z]/u.test(character)) return 154;
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
        nextAt += getTypingDelay(character, characters[index + 1]);
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

    SIGNAL_PHRASES.forEach(({ text, pauseAfter }, index) => {
      if (index > 0) {
        scheduleReset();
      }

      scheduleTypedWrite(text);
      nextAt += pauseAfter;
    });

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
      displayPadding={{ block: 14, inline: 16 }}
      style={{ minHeight: "212px" }}
    />
  );
}
