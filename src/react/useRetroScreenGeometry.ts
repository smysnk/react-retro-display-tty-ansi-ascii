import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject
} from "react";
import { measureGrid, measureStaticGrid } from "../core/geometry/measure-grid";
import type { RetroLcdGeometry, RetroLcdGridMode } from "../core/types";

const DEFAULT_GEOMETRY = measureGrid({
  innerWidth: 560,
  innerHeight: 220,
  cellWidth: 12,
  cellHeight: 24,
  fontSize: 24
});

const buildStaticFallbackGeometry = (rows?: number, cols?: number) =>
  measureStaticGrid({
    innerWidth: DEFAULT_GEOMETRY.innerWidth,
    innerHeight: DEFAULT_GEOMETRY.innerHeight,
    rows: rows ?? 9,
    cols: cols ?? 46,
    fontWidthRatio: DEFAULT_GEOMETRY.cellWidth / DEFAULT_GEOMETRY.fontSize,
    fontHeightRatio: DEFAULT_GEOMETRY.cellHeight / DEFAULT_GEOMETRY.fontSize
  });

type UseRetroLcdGeometryOptions = {
  screenRef: RefObject<HTMLElement | null>;
  probeRef: RefObject<HTMLElement | null>;
  gridMode?: RetroLcdGridMode;
  rows?: number;
  cols?: number;
  fontScale?: number;
  onGeometryChange?: (geometry: RetroLcdGeometry) => void;
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const measureCurrentGeometry = ({
  screenRef,
  probeRef,
  gridMode,
  rows,
  cols
}: Pick<
  UseRetroLcdGeometryOptions,
  "screenRef" | "probeRef" | "gridMode" | "rows" | "cols" | "fontScale"
>): RetroLcdGeometry => {
  const screenNode = screenRef.current;
  const probeNode = probeRef.current;

  if (!screenNode || !probeNode) {
    if (gridMode === "static") {
      return buildStaticFallbackGeometry(rows, cols);
    }

    return DEFAULT_GEOMETRY;
  }

  const screenRect = screenNode.getBoundingClientRect();
  const probeRect = probeNode.getBoundingClientRect();

  if (screenRect.width <= 0 || screenRect.height <= 0) {
    if (gridMode === "static") {
      return buildStaticFallbackGeometry(rows, cols);
    }

    return DEFAULT_GEOMETRY;
  }

  const cellWidth = probeRect.width > 0 ? probeRect.width : DEFAULT_GEOMETRY.cellWidth;
  const cellHeight = probeRect.height > 0 ? probeRect.height : DEFAULT_GEOMETRY.cellHeight;
  const computedFontSize = Number.parseFloat(window.getComputedStyle(probeNode).fontSize);
  const fontSize = Number.isFinite(computedFontSize) && computedFontSize > 0
    ? computedFontSize
    : DEFAULT_GEOMETRY.fontSize;

  if (gridMode === "static") {
    return measureStaticGrid({
      innerWidth: Math.max(0, screenRect.width),
      innerHeight: Math.max(0, screenRect.height),
      rows: rows ?? 9,
      cols: cols ?? 46,
      fontWidthRatio: cellWidth / fontSize,
      fontHeightRatio: cellHeight / fontSize
    });
  }

  return measureGrid({
    innerWidth: Math.max(0, screenRect.width),
    innerHeight: Math.max(0, screenRect.height),
    cellWidth,
    cellHeight,
    fontSize
  });
};

export const useRetroLcdGeometry = ({
  screenRef,
  probeRef,
  gridMode,
  rows,
  cols,
  fontScale,
  onGeometryChange
}: UseRetroLcdGeometryOptions) => {
  const [geometry, setGeometry] = useState(() =>
    measureCurrentGeometry({ screenRef, probeRef, gridMode, rows, cols, fontScale })
  );

  useIsomorphicLayoutEffect(() => {
    setGeometry(measureCurrentGeometry({ screenRef, probeRef, gridMode, rows, cols, fontScale }));
  }, [cols, fontScale, gridMode, probeRef, rows, screenRef]);

  useEffect(() => {
    const screenNode = screenRef.current;

    if (!screenNode || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      setGeometry(measureCurrentGeometry({ screenRef, probeRef, gridMode, rows, cols, fontScale }));
    });

    observer.observe(screenNode);
    return () => observer.disconnect();
  }, [cols, fontScale, gridMode, probeRef, rows, screenRef]);

  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document) || !document.fonts?.ready) {
      return;
    }

    let cancelled = false;
    const syncGeometry = () => {
      if (!cancelled) {
        setGeometry(
          measureCurrentGeometry({ screenRef, probeRef, gridMode, rows, cols, fontScale })
        );
      }
    };

    void document.fonts.ready.then(syncGeometry);

    return () => {
      cancelled = true;
    };
  }, [cols, fontScale, gridMode, probeRef, rows, screenRef]);

  useEffect(() => {
    onGeometryChange?.(geometry);
  }, [geometry, onGeometryChange]);

  const cssVars = useMemo(
    () =>
      ({
        "--retro-lcd-cell-width": `${geometry.cellWidth}px`,
        "--retro-lcd-cell-height": `${geometry.cellHeight}px`,
        "--retro-lcd-font-size": `${geometry.fontSize}px`
      }) as CSSProperties,
    [geometry.cellHeight, geometry.cellWidth, geometry.fontSize]
  );

  return {
    geometry,
    cssVars
  };
};
