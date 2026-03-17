import { useEffect, useMemo, useState } from "react";
import type {
  CursorMode,
  RetroLcdController,
  RetroLcdGeometry,
  RetroLcdTerminalModeProps
} from "../core/types";
import { buildTerminalSnapshot } from "./retro-lcd-render-model";
import type { RetroLcdScreenSnapshot } from "../core/terminal/types";

type UseRetroLcdTerminalRenderModelArgs = {
  terminalProps: RetroLcdTerminalModeProps | null;
  geometry: RetroLcdGeometry;
  cursorMode: CursorMode;
  requestedCursorMode?: CursorMode;
  internalController: RetroLcdController;
};

export const useRetroLcdTerminalRenderModel = ({
  terminalProps,
  geometry,
  cursorMode,
  requestedCursorMode,
  internalController
}: UseRetroLcdTerminalRenderModelArgs): {
  snapshot: RetroLcdScreenSnapshot;
  terminalController: RetroLcdController | null;
} => {
  const terminalController =
    terminalProps?.controller ?? (terminalProps ? internalController : null);
  const [snapshot, setSnapshot] = useState<RetroLcdScreenSnapshot>(() =>
    buildTerminalSnapshot({
      text: terminalProps?.value ?? terminalProps?.initialBuffer ?? "",
      rows: geometry.rows,
      cols: geometry.cols,
      cursorMode,
      scrollback: terminalProps?.bufferSize
    })
  );

  useEffect(() => {
    if (!terminalController) {
      return;
    }

    terminalController.resize(geometry.rows, geometry.cols);
    if (requestedCursorMode) {
      terminalController.setCursorMode(requestedCursorMode);
    }
  }, [geometry.cols, geometry.rows, requestedCursorMode, terminalController]);

  useEffect(() => {
    if (!terminalProps || terminalProps.controller) {
      return;
    }

    internalController.reset();
    internalController.setCursorMode(cursorMode);

    const initialText = terminalProps.value ?? terminalProps.initialBuffer ?? "";
    if (initialText) {
      internalController.write(initialText);
    }
  }, [
    cursorMode,
    internalController,
    terminalProps?.controller,
    terminalProps?.initialBuffer,
    terminalProps?.value
  ]);

  useEffect(() => {
    if (terminalController) {
      const syncSnapshot = () => {
        setSnapshot(terminalController.getSnapshot());
      };

      syncSnapshot();
      return terminalController.subscribe(syncSnapshot);
    }

    setSnapshot(
      buildTerminalSnapshot({
        text: terminalProps?.value ?? terminalProps?.initialBuffer ?? "",
        rows: geometry.rows,
        cols: geometry.cols,
        cursorMode,
        scrollback: terminalProps?.bufferSize
      })
    );
  }, [
    cursorMode,
    geometry.cols,
    geometry.rows,
    terminalProps?.bufferSize,
    terminalController,
    terminalProps?.initialBuffer,
    terminalProps?.value
  ]);

  return useMemo(
    () => ({
      snapshot,
      terminalController
    }),
    [snapshot, terminalController]
  );
};
