import { useEffect, useMemo, useRef, useState } from "react";
import type { RetroLcdScreenSnapshot } from "../core/terminal/types";
import {
  clampSnapshotScrollOffset,
  getSnapshotMaxScrollOffset,
  snapshotToRenderModel,
  type RetroLcdRenderModel
} from "./retro-screen-render-model";

export type RetroLcdBufferViewportState = {
  autoFollow: boolean;
  scrollOffset: number;
  maxScrollOffset: number;
  totalLines: number;
};

const clampDelta = (value: number) => (Number.isFinite(value) ? Math.abs(value) : 0);

export const useRetroLcdBufferViewport = ({
  snapshot,
  enabled,
  defaultAutoFollow = true
}: {
  snapshot: RetroLcdScreenSnapshot;
  enabled: boolean;
  defaultAutoFollow?: boolean;
}): {
  renderModel: RetroLcdRenderModel;
  viewportState: RetroLcdBufferViewportState;
  handleNavigationKey: (key: string) => boolean;
  handleWheelDelta: (deltaY: number) => boolean;
} => {
  const maxScrollOffset = getSnapshotMaxScrollOffset(snapshot);
  const previousMaxScrollOffsetRef = useRef(maxScrollOffset);
  const [viewportState, setViewportState] = useState<RetroLcdBufferViewportState>(() => ({
    autoFollow: defaultAutoFollow,
    scrollOffset: 0,
    maxScrollOffset,
    totalLines: snapshot.scrollbackCells.length + snapshot.cells.length
  }));

  useEffect(() => {
    previousMaxScrollOffsetRef.current = maxScrollOffset;
    setViewportState({
      autoFollow: defaultAutoFollow,
      scrollOffset: 0,
      maxScrollOffset,
      totalLines: snapshot.scrollbackCells.length + snapshot.cells.length
    });
  }, [defaultAutoFollow, enabled]);

  useEffect(() => {
    const previousMaxScrollOffset = previousMaxScrollOffsetRef.current;
    previousMaxScrollOffsetRef.current = maxScrollOffset;

    setViewportState((current) => {
      const totalLines = snapshot.scrollbackCells.length + snapshot.cells.length;

      if (!enabled) {
        return current.maxScrollOffset === maxScrollOffset &&
          current.totalLines === totalLines &&
          current.scrollOffset === 0 &&
          current.autoFollow === defaultAutoFollow
          ? current
          : {
              autoFollow: defaultAutoFollow,
              scrollOffset: 0,
              maxScrollOffset,
              totalLines
            };
      }

      if (current.autoFollow) {
        return current.maxScrollOffset === maxScrollOffset &&
          current.totalLines === totalLines &&
          current.scrollOffset === 0
          ? current
          : {
              autoFollow: true,
              scrollOffset: 0,
              maxScrollOffset,
              totalLines
            };
      }

      const growth = Math.max(0, maxScrollOffset - previousMaxScrollOffset);
      const nextScrollOffset = clampSnapshotScrollOffset(snapshot, current.scrollOffset + growth);

      return current.maxScrollOffset === maxScrollOffset &&
        current.totalLines === totalLines &&
        current.scrollOffset === nextScrollOffset
        ? current
        : {
            ...current,
            scrollOffset: nextScrollOffset,
            maxScrollOffset,
            totalLines
          };
    });
  }, [
    defaultAutoFollow,
    enabled,
    maxScrollOffset,
    snapshot.cells.length,
    snapshot.scrollbackCells.length,
    snapshot
  ]);

  const adjustScrollOffset = (delta: number) => {
    if (!enabled || maxScrollOffset === 0 || delta === 0) {
      return false;
    }

    let changed = false;
    setViewportState((current) => {
      const nextScrollOffset = clampSnapshotScrollOffset(snapshot, current.scrollOffset + delta);
      const nextAutoFollow = nextScrollOffset === 0;

      if (
        nextScrollOffset === current.scrollOffset &&
        nextAutoFollow === current.autoFollow &&
        current.maxScrollOffset === maxScrollOffset
      ) {
        return current;
      }

      changed = true;
      return {
        autoFollow: nextAutoFollow,
        scrollOffset: nextScrollOffset,
        maxScrollOffset,
        totalLines: snapshot.scrollbackCells.length + snapshot.cells.length
      };
    });

    return changed;
  };

  const pageStep = Math.max(1, snapshot.rows - 1);

  const handleNavigationKey = (key: string) => {
    switch (key) {
      case "PageUp":
        return adjustScrollOffset(pageStep);
      case "PageDown":
        return adjustScrollOffset(-pageStep);
      case "Home":
        return adjustScrollOffset(maxScrollOffset - viewportState.scrollOffset);
      case "End":
        return adjustScrollOffset(-viewportState.scrollOffset);
      default:
        return false;
    }
  };

  const handleWheelDelta = (deltaY: number) => {
    if (!enabled || deltaY === 0) {
      return false;
    }

    const lineDelta = Math.max(1, Math.ceil(clampDelta(deltaY) / 48));
    return adjustScrollOffset(deltaY < 0 ? lineDelta : -lineDelta);
  };

  const renderModel = useMemo(
    () =>
      snapshotToRenderModel(snapshot, {
        scrollOffset: enabled ? viewportState.scrollOffset : 0
      }),
    [enabled, snapshot, viewportState.scrollOffset]
  );

  return {
    renderModel,
    viewportState: {
      ...viewportState,
      maxScrollOffset,
      totalLines: snapshot.scrollbackCells.length + snapshot.cells.length
    },
    handleNavigationKey,
    handleWheelDelta
  };
};
