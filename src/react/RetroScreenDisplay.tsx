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
  RetroScreenDisplaySurfaceMode,
  RetroScreenProps
} from "../core/types";
import {
  getCellCharacter,
  type RetroScreenRenderCell,
  type RetroScreenRenderModel
} from "./retro-screen-render-model";
import { getCellPresentationStyle } from "./retro-screen-display-color";

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const getCellClassName = (cell: RetroScreenRenderCell) =>
  joinClassNames(
    "retro-screen__cell",
    cell.style.bold ? "retro-screen__cell--bold" : undefined,
    cell.style.faint ? "retro-screen__cell--faint" : undefined,
    cell.style.inverse ? "retro-screen__cell--inverse" : undefined,
    cell.style.conceal ? "retro-screen__cell--conceal" : undefined,
    cell.style.blink ? "retro-screen__cell--blink" : undefined,
    cell.isSelected ? "retro-screen__cell--selected" : undefined
  );

type RetroScreenDisplayProps = {
  mode: RetroScreenProps["mode"];
  renderModel: RetroScreenRenderModel;
  displayColorMode: RetroScreenDisplayColorMode;
  displaySurfaceMode: RetroScreenDisplaySurfaceMode;
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
  displayColorMode,
  displaySurfaceMode,
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
  return (
    <div className="retro-screen__screen">
      <div
        ref={viewportRef}
        className="retro-screen__viewport"
        onClick={onViewportClick}
        onFocus={onViewportFocus}
        onBlur={onViewportBlur}
        onPaste={onViewportPaste}
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
              mode === "value" ? "retro-screen__content--centered" : undefined
            )}
          >
            <div className="retro-screen__body" aria-live={mode === "terminal" ? "polite" : undefined}>
              {renderModel.cells.map((line, rowIndex) => (
                <div
                  className={joinClassNames("retro-screen__line", "retro-screen__line--cells")}
                  key={`cells-${rowIndex}`}
                >
                  {line.map((cell, colIndex) => (
                    <span
                      className={getCellClassName(cell)}
                      key={`${rowIndex}-${colIndex}-${cell.char}`}
                      data-source-offset={cell.sourceOffset ?? undefined}
                      style={getCellPresentationStyle(cell, displayColorMode, displaySurfaceMode)}
                    >
                      {getCellCharacter(cell)}
                    </span>
                  ))}
                </div>
              ))}
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
