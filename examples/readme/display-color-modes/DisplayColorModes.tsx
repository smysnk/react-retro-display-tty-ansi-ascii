import { RetroScreen } from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

const VALUE = [
  "\u001b[31mALERT\u001b[0m \u001b[32mlink stable\u001b[0m",
  "\u001b[38;5;196mindexed 196\u001b[0m from the 256-color palette",
  "\u001b[38;2;255;180;120mtruecolor 255,180,120\u001b[0m"
].join("\n");

export function DisplayColorModes() {
  return (
    <RetroScreen
      mode="terminal"
      displayColorMode="ansi-extended"
      value={VALUE}
    />
  );
}
