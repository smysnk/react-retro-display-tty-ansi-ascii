import { useEffect, useState } from "react";
import {
  RetroScreen,
  createRetroScreenController
} from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

export function ControlCharacterReplay() {
  const [controller] = useState(() =>
    createRetroScreenController({ rows: 6, cols: 34, cursorMode: "solid" })
  );

  useEffect(() => {
    controller.reset();
    controller.setCursorVisible(true);

    const writes = [
      "Downloading fixtures... 12%",
      "\rDownloading fixtures... 73%",
      "\r\u001b[32mDownloaded fixtures.\u001b[0m\u001b[K\r\n",
      "\u001b[2;6r",
      "\u001b[6;1H\u001b[L\u001b[38;2;255;180;120mrecorded regression fixture\u001b[0m"
    ];
    const timers = writes.map((value, index) =>
      window.setTimeout(() => {
        controller.write(value);
      }, 280 + index * 720)
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
      displayColorMode="ansi-extended"
    />
  );
}
