import { useEffect, useRef } from "react";
import { createRetroLcdPromptSession } from "../core/terminal/prompt-session";
import type { RetroLcdPromptSessionOptions, RetroLcdPromptSession } from "../core/terminal/prompt-session";

export const useRetroLcdPromptSession = (
  options: RetroLcdPromptSessionOptions = {}
): RetroLcdPromptSession => {
  const sessionRef = useRef<RetroLcdPromptSession | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = createRetroLcdPromptSession(options);
  }

  useEffect(() => {
    sessionRef.current?.updateOptions(options);
  }, [
    options.acceptanceText,
    options.cursorMode,
    options.onCommand,
    options.promptChar,
    options.rejectionText,
    options.scrollback,
    options.tabWidth
  ]);

  useEffect(() => {
    sessionRef.current?.resize(options.rows ?? 9, options.cols ?? 46);
  }, [options.cols, options.rows]);

  return sessionRef.current;
};
