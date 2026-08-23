import { useState } from "react";
import { RetroScreen } from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

export function TouchDemo() {
  const [lastTouch, setLastTouch] = useState("Tap the screen");

  return (
    <>
      <RetroScreen
        mode="terminal"
        gridMode="static"
        rows={12}
        cols={32}
        value={[
          "┌──────────────────────────────┐",
          "│                              │",
          "│          TOUCH ME            │",
          "│                              │",
          "│   ↑ up          right →      │",
          "│                              │",
          "│   ← left       down ↓        │",
          "│                              │",
          "│                              │",
          "│                              │",
          "│                              │",
          "└──────────────────────────────┘"
        ].join("\n")}
        touchInput={{
          enabled: true,
          onTouchCell: ({ row, col, rows, cols, pointerType }) => {
            setLastTouch(`${pointerType} @ ${row},${col} inside ${rows}x${cols}`);
          }
        }}
      />
      <output>{lastTouch}</output>
    </>
  );
}
