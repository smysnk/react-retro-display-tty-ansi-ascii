import { useState } from "react";
import {
  RetroScreen,
  type RetroScreenGeometry
} from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

export function ResizablePanel() {
  const [geometry, setGeometry] = useState<RetroScreenGeometry | null>(null);

  return (
    <RetroScreen
      mode="terminal"
      resizable="both"
      resizableLeadingEdges
      displayPadding={{ block: 12, inline: 14 }}
      value={[
        "All resize handles are live here.",
        "",
        "Drag left, right, top, bottom, or any corner.",
        geometry
          ? `grid: ${geometry.cols} cols x ${geometry.rows} rows`
          : "grid: measuring"
      ].join("\n")}
      onGeometryChange={setGeometry}
    />
  );
}
