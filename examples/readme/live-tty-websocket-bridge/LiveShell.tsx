import { useMemo } from "react";
import {
  RetroScreen,
  createRetroScreenWebSocketSession
} from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

export function LiveShell({
  url = "ws://127.0.0.1:8787",
  cwd = "/workspace"
}: {
  url?: string;
  cwd?: string;
}) {
  const session = useMemo(
    () =>
      createRetroScreenWebSocketSession({
        url,
        openPayload: {
          cwd,
          term: "xterm-256color"
        }
      }),
    [cwd, url]
  );

  return (
    <RetroScreen
      mode="terminal"
      session={session}
      closeSessionOnUnmount
      autoFocus
      displayColorMode="ansi-extended"
      displayPadding={{ block: 12, inline: 14 }}
    />
  );
}
