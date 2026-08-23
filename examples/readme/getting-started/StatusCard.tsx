import { RetroScreen } from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

export function StatusCard() {
  return (
    <RetroScreen
      mode="value"
      value="SYSTEM READY"
      color="#97ff9b"
    />
  );
}
