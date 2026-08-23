import { useEffect, useMemo, useState } from "react";
import { RetroScreen } from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";
import "./light-dark-surfaces.css";

export const LIGHT_DARK_TYPING_MS = 4200;
export const LIGHT_DARK_CYCLE_MS = 5200;

export const LIGHT_SURFACE_STREAM = [
  "\u001b[1mLIGHT SURFACE\u001b[0m",
  "\u001b[38;5;160mR\u001b[38;5;214mA\u001b[38;5;190mI\u001b[38;5;45mN\u001b[38;5;39mB\u001b[38;5;141mO\u001b[38;5;201mW\u001b[0m contrast check",
  "\u001b[38;2;194;94;0mamber\u001b[0m  \u001b[38;2;0;104;181mblue\u001b[0m  \u001b[38;2;108;40;148mviolet\u001b[0m",
  "\u001b[38;2;28;139;98mtyped live\u001b[0m on bright LCD glass"
].join("\r\n");

export const DARK_SURFACE_STREAM = [
  "\u001b[1mDARK SURFACE\u001b[0m",
  "\u001b[38;5;160mR\u001b[38;5;214mA\u001b[38;5;190mI\u001b[38;5;45mN\u001b[38;5;39mB\u001b[38;5;141mO\u001b[38;5;201mW\u001b[0m contrast check",
  "\u001b[38;2;255;176;86mamber\u001b[0m  \u001b[38;2;102;198;255mblue\u001b[0m  \u001b[38;2;214;145;255mviolet\u001b[0m",
  "\u001b[38;2;110;255;185mtyped live\u001b[0m on deep terminal glass"
].join("\r\n");

export const buildAnsiTypedFrames = (value: string) => {
  const frames: string[] = [];
  let current = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "\u001b") {
      let end = index + 2;
      while (end < value.length && !/[\u0040-\u007e]/u.test(value[end] ?? "")) {
        end += 1;
      }
      current += value.slice(index, Math.min(value.length, end + 1));
      index = end;
      continue;
    }

    current += character;
    frames.push(current);
  }

  return frames;
};

export const resolveAnsiTypedFrame = (frames: string[], progress: number) => {
  if (progress <= 0) return "";
  const index = Math.min(frames.length - 1, Math.max(0, Math.round(frames.length * progress) - 1));
  return frames[index] ?? "";
};

export function LightDarkSurfaces() {
  const [tick, setTick] = useState(0);
  const lightFrames = useMemo(() => buildAnsiTypedFrames(LIGHT_SURFACE_STREAM), []);
  const darkFrames = useMemo(() => buildAnsiTypedFrames(DARK_SURFACE_STREAM), []);
  const now = tick % LIGHT_DARK_CYCLE_MS;
  const progress = Math.max(0, Math.min(1, now / LIGHT_DARK_TYPING_MS));

  useEffect(() => {
    const startedAt = window.performance.now();
    const timer = window.setInterval(() => {
      setTick(window.performance.now() - startedAt);
    }, 80);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="light-dark-surfaces"
      data-animation-phase={now < LIGHT_DARK_TYPING_MS ? "typing" : "hold"}
    >
      <article className="light-dark-surfaces__card light-dark-surfaces__card--light">
        <h2>Bright docs lane</h2>
        <RetroScreen
          mode="terminal"
          value={resolveAnsiTypedFrame(lightFrames, progress)}
          displaySurfaceMode="light"
          displayColorMode="ansi-extended"
          rows={6}
          displayPadding={{ block: 12, inline: 14 }}
        />
      </article>
      <article className="light-dark-surfaces__card light-dark-surfaces__card--dark">
        <h2>Night operations lane</h2>
        <RetroScreen
          mode="terminal"
          value={resolveAnsiTypedFrame(darkFrames, progress)}
          displaySurfaceMode="dark"
          displayColorMode="ansi-extended"
          rows={6}
          displayPadding={{ block: 12, inline: 14 }}
        />
      </article>
    </div>
  );
}
