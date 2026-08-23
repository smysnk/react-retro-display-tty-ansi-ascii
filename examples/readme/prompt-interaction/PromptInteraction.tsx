import { RetroScreen } from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });

export function PromptInteraction() {
  return (
    <RetroScreen
      mode="prompt"
      autoFocus
      color="#97ff9b"
      cursorMode="solid"
      promptChar="$"
      acceptanceText="READY"
      rejectionText="DENIED"
      onCommand={async (command) => {
        await wait(420);

        switch (command.trim()) {
          case "status":
            return {
              accepted: true,
              response: ["grid synced", "cursor stable", "story ready"]
            };
          case "scan":
            return {
              accepted: true,
              response: ["signal sweep", "north: clear", "south: clear"]
            };
          default:
            return {
              accepted: false,
              response: "unknown command"
            };
        }
      }}
    />
  );
}
