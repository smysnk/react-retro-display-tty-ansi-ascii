import type {
  ClipboardEventHandler,
  FocusEventHandler,
  CSSProperties,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  RefObject,
  WheelEventHandler
} from "react";
import type { RetroLcdCell } from "../core/terminal/types";
import type {
  RetroLcdDisplayColorMode,
  RetroLcdDisplaySurfaceMode,
  RetroLcdProps
} from "../core/types";
import {
  getCellCharacter,
  getLineDisplayText,
  type RetroLcdRenderCell,
  type RetroLcdRenderModel
} from "./retro-screen-render-model";
import { getCellPresentationStyle } from "./retro-screen-display-color";

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const getCellClassName = (cell: RetroLcdRenderCell) =>
  joinClassNames(
    "retro-lcd__cell",
    cell.style.bold ? "retro-lcd__cell--bold" : undefined,
    cell.style.faint ? "retro-lcd__cell--faint" : undefined,
    cell.style.inverse ? "retro-lcd__cell--inverse" : undefined,
    cell.style.conceal ? "retro-lcd__cell--conceal" : undefined,
    cell.style.blink ? "retro-lcd__cell--blink" : undefined,
    cell.isSelected ? "retro-lcd__cell--selected" : undefined
  );

type RetroScreenDisplayProps = {
  mode: RetroLcdProps["mode"];
  renderModel: RetroLcdRenderModel;
  displayColorMode: RetroLcdDisplayColorMode;
  displaySurfaceMode: RetroLcdDisplaySurfaceMode;
  screenRef: RefObject<HTMLDivElement | null>;
  probeRef: RefObject<HTMLSpanElement | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
  onViewportClick: () => void;
  onViewportFocus?: FocusEventHandler<HTMLDivElement>;
  onViewportBlur?: FocusEventHandler<HTMLDivElement>;
  onViewportPaste?: ClipboardEventHandler<HTMLDivElement>;
  onViewportKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  onViewportKeyUp?: KeyboardEventHandler<HTMLDivElement>;
  onViewportMouseDown?: MouseEventHandler<HTMLDivElement>;
  onViewportMouseMove?: MouseEventHandler<HTMLDivElement>;
  onViewportMouseUp?: MouseEventHandler<HTMLDivElement>;
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
  onViewportMouseDown,
  onViewportMouseMove,
  onViewportMouseUp,
  onViewportDoubleClick,
  onViewportContextMenu,
  onViewportWheel,
  viewportTabIndex,
  children
}: RetroScreenDisplayProps) {
  return (
    <div className="retro-lcd__screen">
      <div
        ref={viewportRef}
        className="retro-lcd__viewport"
        onClick={onViewportClick}
        onFocus={onViewportFocus}
        onBlur={onViewportBlur}
        onPaste={onViewportPaste}
        onKeyDown={onViewportKeyDown}
        onKeyUp={onViewportKeyUp}
        onMouseDown={onViewportMouseDown}
        onMouseMove={onViewportMouseMove}
        onMouseUp={onViewportMouseUp}
        onDoubleClick={onViewportDoubleClick}
        onContextMenu={onViewportContextMenu}
        onWheel={onViewportWheel}
        tabIndex={viewportTabIndex}
      >
        <div
          ref={screenRef}
          className={joinClassNames(
            "retro-lcd__grid",
            renderModel.isDimmed ? "retro-lcd__grid--dimmed" : undefined
          )}
        >
          <span ref={probeRef} className="retro-lcd__probe" aria-hidden="true">
            M
          </span>
          <div className="retro-lcd__body" aria-live={mode === "terminal" ? "polite" : undefined}>
            {renderModel.cells
              ? renderModel.cells.map((line, rowIndex) => (
                  <div className="retro-lcd__line" key={`cells-${rowIndex}`}>
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
                ))
              : renderModel.lines.map((line, index) => (
                  <div className="retro-lcd__line" key={`${index}-${line}`}>
                    {getLineDisplayText(line)}
                  </div>
                ))}
          </div>
          {renderModel.cursor ? (
            <div
              className="retro-lcd__cursor"
              data-cursor-mode={renderModel.cursor.mode}
              style={
                {
                  "--retro-lcd-cursor-row": renderModel.cursor.row,
                  "--retro-lcd-cursor-col": renderModel.cursor.col
                } as CSSProperties
              }
              aria-hidden="true"
            />
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
