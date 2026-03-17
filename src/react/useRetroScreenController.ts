import { useEffect, useMemo } from "react";
import { createRetroLcdController } from "../core/terminal/controller";
import type { RetroLcdController } from "../core/types";
import type { RetroLcdScreenBufferOptions } from "../core/terminal/types";

export const useRetroLcdController = (
  options: Partial<RetroLcdScreenBufferOptions> = {}
): RetroLcdController => {
  const controller = useMemo(
    () =>
      createRetroLcdController({
        scrollback: options.scrollback,
        tabWidth: options.tabWidth
      }),
    [options.scrollback, options.tabWidth]
  );

  useEffect(() => {
    controller.resize(options.rows ?? 9, options.cols ?? 46);
  }, [controller, options.cols, options.rows]);

  useEffect(() => {
    if (options.cursorMode) {
      controller.setCursorMode(options.cursorMode);
    }
  }, [controller, options.cursorMode]);

  return controller;
};
