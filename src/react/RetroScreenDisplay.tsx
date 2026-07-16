import type {
  ClipboardEventHandler,
  FocusEventHandler,
  CSSProperties,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  RefObject,
  TouchEventHandler,
  WheelEventHandler
} from "react";
import type { RetroScreenCell } from "../core/terminal/types";
import type {
  RetroScreenDisplayColorMode,
  RetroScreenDisplayGlyphMode,
  RetroScreenDisplaySurfaceMode,
  RetroScreenRenderBackend,
  RetroScreenProps
} from "../core/types";
import type { RetroScreenRenderModel } from "./retro-screen-render-model";
import { RetroScreenCanvasSurface } from "./RetroScreenCanvasSurface";
import { RetroScreenDomSurface } from "./RetroScreenDomSurface";

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

type RetroScreenDisplayProps = {
  mode: RetroScreenProps["mode"];
  renderModel: RetroScreenRenderModel;
  rows: number;
  cols: number;
  displayColorMode: RetroScreenDisplayColorMode;
  displayGlyphMode: RetroScreenDisplayGlyphMode;
  displayIceColors: boolean;
  displaySurfaceMode: RetroScreenDisplaySurfaceMode;
  displayFrame: boolean;
  renderBackend: RetroScreenRenderBackend;
  canvasAccessibilityLabel?: string;
  canvasAccessibleText: boolean;
  onCanvasUnavailable: () => void;
  screenRef: RefObject<HTMLDivElement | null>;
  probeRef: RefObject<HTMLSpanElement | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
  onViewportClick: () => void;
  onViewportFocus?: FocusEventHandler<HTMLDivElement>;
  onViewportBlur?: FocusEventHandler<HTMLDivElement>;
  onViewportPaste?: ClipboardEventHandler<HTMLDivElement>;
  onViewportKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  onViewportKeyUp?: KeyboardEventHandler<HTMLDivElement>;
  onViewportMouseDownCapture?: MouseEventHandler<HTMLDivElement>;
  onViewportMouseDown?: MouseEventHandler<HTMLDivElement>;
  onViewportMouseMove?: MouseEventHandler<HTMLDivElement>;
  onViewportMouseUp?: MouseEventHandler<HTMLDivElement>;
  onViewportTouchStartCapture?: TouchEventHandler<HTMLDivElement>;
  onViewportDoubleClick?: MouseEventHandler<HTMLDivElement>;
  onViewportContextMenu?: MouseEventHandler<HTMLDivElement>;
  onViewportWheel?: WheelEventHandler<HTMLDivElement>;
  viewportTabIndex?: number;
  children?: ReactNode;
};

export function RetroScreenDisplay({
  mode,
  renderModel,
  rows,
  cols,
  displayColorMode,
  displayGlyphMode = "font",
  displayIceColors = false,
  displaySurfaceMode,
  displayFrame = true,
  renderBackend = "dom",
  canvasAccessibilityLabel,
  canvasAccessibleText = true,
  onCanvasUnavailable = () => {},
  screenRef,
  probeRef,
  viewportRef,
  onViewportClick,
  onViewportFocus,
  onViewportBlur,
  onViewportPaste,
  onViewportKeyDown,
  onViewportKeyUp,
  onViewportMouseDownCapture,
  onViewportMouseDown,
  onViewportMouseMove,
  onViewportMouseUp,
  onViewportTouchStartCapture,
  onViewportDoubleClick,
  onViewportContextMenu,
  onViewportWheel,
  viewportTabIndex,
  children
}: RetroScreenDisplayProps) {
  const renderDomSurface = renderBackend !== "canvas";
  const renderCanvasSurface = renderBackend !== "dom" && displayGlyphMode !== "font";
  const handleCopy: ClipboardEventHandler<HTMLDivElement> = (event) => {
    if (renderBackend !== "canvas") {
      return;
    }

    const selectedRows = renderModel.cells
      .map((row) => row.filter((cell) => cell.isSelected).map((cell) => cell.char).join(""))
      .filter((row) => row.length > 0);

    if (selectedRows.length === 0) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", selectedRows.join("\n"));
  };

  return (
    <div className={joinClassNames("retro-screen__screen", displayFrame ? undefined : "retro-screen__screen--frameless")}>
      <div
        ref={viewportRef}
        className="retro-screen__viewport"
        onClick={onViewportClick}
        onFocus={onViewportFocus}
        onBlur={onViewportBlur}
        onPaste={onViewportPaste}
        onCopy={handleCopy}
        onKeyDown={onViewportKeyDown}
        onKeyUp={onViewportKeyUp}
        onMouseDownCapture={onViewportMouseDownCapture}
        onMouseDown={onViewportMouseDown}
        onMouseMove={onViewportMouseMove}
        onMouseUp={onViewportMouseUp}
        onTouchStartCapture={onViewportTouchStartCapture}
        onDoubleClick={onViewportDoubleClick}
        onContextMenu={onViewportContextMenu}
        onWheel={onViewportWheel}
        tabIndex={viewportTabIndex}
      >
        <div
          ref={screenRef}
          className={joinClassNames(
            "retro-screen__grid",
            renderModel.isDimmed ? "retro-screen__grid--dimmed" : undefined
          )}
        >
          <span ref={probeRef} className="retro-screen__probe" aria-hidden="true">
            M
          </span>
          <div
            className={joinClassNames(
              "retro-screen__content",
              mode === "value" ? "retro-screen__content--centered" : undefined,
              renderCanvasSurface ? "retro-screen__content--bitmap" : undefined
            )}
          >
            <div
              className={joinClassNames(
                "retro-screen__body",
                renderCanvasSurface ? "retro-screen__body--bitmap" : undefined,
                renderBackend === "canvas" ? "retro-screen__body--canvas-only" : undefined
              )}
              aria-live={mode === "terminal" && renderDomSurface ? "polite" : undefined}
            >
              {renderDomSurface ? (
                <RetroScreenDomSurface
                  displayColorMode={displayColorMode}
                  displayIceColors={displayIceColors}
                  displaySurfaceMode={displaySurfaceMode}
                  renderModel={renderModel}
                />
              ) : null}
              {renderCanvasSurface ? (
                <RetroScreenCanvasSurface
                  accessibilityLabel={canvasAccessibilityLabel}
                  accessible={renderBackend === "canvas"}
                  accessibleText={renderBackend === "canvas" && canvasAccessibleText}
                  cols={cols}
                  displayColorMode={displayColorMode}
                  displayGlyphMode={displayGlyphMode as Exclude<RetroScreenDisplayGlyphMode, "font">}
                  displayIceColors={displayIceColors}
                  displaySurfaceMode={displaySurfaceMode}
                  onCanvasUnavailable={onCanvasUnavailable}
                  renderModel={renderModel}
                  rows={rows}
                />
              ) : null}
            </div>
            {renderModel.cursor ? (
              <div
                className="retro-screen__cursor"
                data-cursor-mode={renderModel.cursor.mode}
                style={
                  {
                    "--retro-screen-cursor-row": renderModel.cursor.row,
                    "--retro-screen-cursor-col": renderModel.cursor.col
                  } as CSSProperties
                }
                aria-hidden="true"
              />
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
