import { useCallback, useRef, useState } from "react";
import {
  RetroScreen,
  createRetroScreenController,
  type RetroScreenController,
  type RetroScreenGeometry
} from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

const fit = (value: string, width: number) => value.slice(0, width).padEnd(width, " ");

export const redrawBorderAndMetrics = (
  controller: RetroScreenController,
  rows: number,
  cols: number
) => {
  const innerWidth = Math.max(0, cols - 2);
  const lines = Array.from({ length: rows }, (_, row) => {
    if (rows === 1) return fit(` ${cols} x ${rows} `, cols);
    if (row === 0) return `┌${"─".repeat(innerWidth)}┐`;
    if (row === rows - 1) return `└${"─".repeat(innerWidth)}┘`;

    const message = row === Math.floor(rows / 2) ? `${cols} cols x ${rows} rows` : "";
    return `│${fit(message, innerWidth)}│`;
  });

  controller.batch(() => {
    controller.reset();
    controller.resize(rows, cols);
    controller.setCursorVisible(false);
    controller.write(lines.join("\r\n"));
  });
};

export function AutoResizeProbe() {
  const [controller] = useState(() =>
    createRetroScreenController({ rows: 9, cols: 34, cursorMode: "solid" })
  );
  const [lastReply, setLastReply] = useState("measuring");
  const previousGeometry = useRef("");

  const handleGeometryChange = useCallback(
    (geometry: RetroScreenGeometry) => {
      const signature = `${geometry.rows}x${geometry.cols}`;
      if (signature === previousGeometry.current) return;
      previousGeometry.current = signature;

      const reply = `\u001b[8;${geometry.rows};${geometry.cols}t`;
      setLastReply(reply.replace("\u001b", "ESC"));
      redrawBorderAndMetrics(controller, geometry.rows, geometry.cols);
    },
    [controller]
  );

  return (
    <>
      <RetroScreen
        mode="terminal"
        controller={controller}
        resizable="both"
        resizableLeadingEdges
        displayPadding={{ block: 8, inline: 10 }}
        onGeometryChange={handleGeometryChange}
      />
      <output>terminal reply: {lastReply}</output>
    </>
  );
}
