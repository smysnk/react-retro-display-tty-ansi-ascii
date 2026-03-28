import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject
} from "react";
import { measureGrid, measureStaticGrid } from "../core/geometry/measure-grid";
import type { RetroScreenGeometry, RetroScreenGridMode } from "../core/types";

const DEFAULT_GEOMETRY = measureGrid({
  innerWidth: 560,
  innerHeight: 220,
  cellWidth: 12,
  cellHeight: 24,
  fontSize: 24
});

const buildStaticFallbackGeometry = (
  rows?: number,
  cols?: number,
  staticFitStrategy?: "contain" | "width"
) =>
  measureStaticGrid({
    innerWidth: DEFAULT_GEOMETRY.innerWidth,
    innerHeight: DEFAULT_GEOMETRY.innerHeight,
    rows: rows ?? 9,
    cols: cols ?? 46,
    fontWidthRatio: DEFAULT_GEOMETRY.cellWidth / DEFAULT_GEOMETRY.fontSize,
    fontHeightRatio: DEFAULT_GEOMETRY.cellHeight / DEFAULT_GEOMETRY.fontSize,
    fitStrategy: staticFitStrategy
  });

type UseRetroScreenGeometryOptions = {
  screenRef: RefObject<HTMLElement | null>;
  probeRef: RefObject<HTMLElement | null>;
  gridMode?: RetroScreenGridMode;
  rows?: number;
  cols?: number;
  staticFitStrategy?: "contain" | "width";
  onGeometryChange?: (geometry: RetroScreenGeometry) => void;
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const areGeometriesEqual = (left: RetroScreenGeometry, right: RetroScreenGeometry) =>
  left.rows === right.rows &&
  left.cols === right.cols &&
  left.cellWidth === right.cellWidth &&
  left.cellHeight === right.cellHeight &&
  left.innerWidth === right.innerWidth &&
  left.innerHeight === right.innerHeight &&
  left.fontSize === right.fontSize;

const measureCurrentGeometry = ({
  screenRef,
  probeRef,
  gridMode,
  rows,
  cols,
  staticFitStrategy
}: Pick<
  UseRetroScreenGeometryOptions,
  "screenRef" | "probeRef" | "gridMode" | "rows" | "cols" | "staticFitStrategy"
>): RetroScreenGeometry => {
  const screenNode = screenRef.current;
  const probeNode = probeRef.current;

  if (!screenNode || !probeNode) {
    if (gridMode === "static") {
      return buildStaticFallbackGeometry(rows, cols, staticFitStrategy);
    }

    return DEFAULT_GEOMETRY;
  }

  const screenRect = screenNode.getBoundingClientRect();
  const probeRect = probeNode.getBoundingClientRect();

  if (screenRect.width <= 0 || screenRect.height <= 0) {
    if (gridMode === "static") {
      return buildStaticFallbackGeometry(rows, cols, staticFitStrategy);
    }

    return DEFAULT_GEOMETRY;
  }

  const cellWidth = probeRect.width > 0 ? probeRect.width : DEFAULT_GEOMETRY.cellWidth;
  const cellHeight = probeRect.height > 0 ? probeRect.height : DEFAULT_GEOMETRY.cellHeight;
  const computedProbeFontSize = Number.parseFloat(window.getComputedStyle(probeNode).fontSize);
  const measuredFontSize =
    Number.isFinite(computedProbeFontSize) && computedProbeFontSize > 0
      ? computedProbeFontSize
      : DEFAULT_GEOMETRY.fontSize;

  if (gridMode === "static") {
    return measureStaticGrid({
      innerWidth: Math.max(0, screenRect.width),
      innerHeight: Math.max(0, screenRect.height),
      rows: rows ?? 9,
      cols: cols ?? 46,
      fontWidthRatio: cellWidth / measuredFontSize,
      fontHeightRatio: cellHeight / measuredFontSize,
      fitStrategy: staticFitStrategy
    });
  }

  return measureGrid({
    innerWidth: Math.max(0, screenRect.width),
    innerHeight: Math.max(0, screenRect.height),
    cellWidth,
    cellHeight,
    fontSize: cellHeight
  });
};

export const useRetroScreenGeometry = ({
  screenRef,
  probeRef,
  gridMode,
  rows,
  cols,
  staticFitStrategy,
  onGeometryChange
}: UseRetroScreenGeometryOptions) => {
  const [geometry, setGeometry] = useState(() =>
    measureCurrentGeometry({
      screenRef,
      probeRef,
      gridMode,
      rows,
      cols,
      staticFitStrategy
    })
  );
  const syncGeometry = () => {
    setGeometry((currentGeometry) => {
      const nextGeometry = measureCurrentGeometry({
        screenRef,
        probeRef,
        gridMode,
        rows,
        cols,
        staticFitStrategy
      });

      return areGeometriesEqual(currentGeometry, nextGeometry) ? currentGeometry : nextGeometry;
    });
  };

  useIsomorphicLayoutEffect(() => {
    syncGeometry();
  }, [cols, gridMode, probeRef, rows, screenRef, staticFitStrategy]);

  useEffect(() => {
    const screenNode = screenRef.current;
    const probeNode = probeRef.current;

    if (!screenNode || !probeNode || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncGeometry();
    });

    observer.observe(screenNode);
    observer.observe(probeNode);
    return () => observer.disconnect();
  }, [cols, gridMode, probeRef, rows, screenRef, staticFitStrategy]);

  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document) || !document.fonts?.ready) {
      return;
    }

    let cancelled = false;
    const syncGeometry = () => {
      if (!cancelled) {
        setGeometry((currentGeometry) => {
          const nextGeometry = measureCurrentGeometry({
            screenRef,
            probeRef,
            gridMode,
            rows,
            cols,
            staticFitStrategy
          });

          return areGeometriesEqual(currentGeometry, nextGeometry)
            ? currentGeometry
            : nextGeometry;
        });
      }
    };

    void document.fonts.ready.then(syncGeometry);

    const fontFaceSet = document.fonts;
    const handleFontFaceSetChange = () => {
      syncGeometry();
    };

    fontFaceSet.addEventListener?.("loadingdone", handleFontFaceSetChange);
    fontFaceSet.addEventListener?.("loadingerror", handleFontFaceSetChange);

    return () => {
      cancelled = true;
      fontFaceSet.removeEventListener?.("loadingdone", handleFontFaceSetChange);
      fontFaceSet.removeEventListener?.("loadingerror", handleFontFaceSetChange);
    };
  }, [cols, gridMode, probeRef, rows, screenRef, staticFitStrategy]);

  useEffect(() => {
    onGeometryChange?.(geometry);
  }, [geometry, onGeometryChange]);

  const cssVars = useMemo(
    () =>
      ({
        "--retro-screen-cell-width": `${geometry.cellWidth}px`,
        "--retro-screen-cell-height": `${geometry.cellHeight}px`,
        "--retro-screen-font-size": `${geometry.fontSize}px`
      }) as CSSProperties,
    [geometry.cellHeight, geometry.cellWidth, geometry.fontSize]
  );

  return {
    geometry,
    cssVars
  };
};
