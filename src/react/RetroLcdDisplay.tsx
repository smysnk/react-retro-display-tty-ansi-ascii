import type { CSSProperties, ReactNode, RefObject } from "react";
import type { RetroLcdCell } from "../core/terminal/types";
import type { RetroLcdDisplayColorMode, RetroLcdProps } from "../core/types";
import {
  getCellCharacter,
  getLineDisplayText,
  type RetroLcdRenderModel
} from "./retro-lcd-render-model";
import { getCellPresentationStyle } from "./retro-lcd-display-color";

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const getCellClassName = (cell: RetroLcdCell) =>
  joinClassNames(
    "retro-lcd__cell",
    cell.style.intensity === "bold" ? "retro-lcd__cell--bold" : undefined,
    cell.style.intensity === "faint" ? "retro-lcd__cell--faint" : undefined,
    cell.style.inverse ? "retro-lcd__cell--inverse" : undefined,
    cell.style.conceal ? "retro-lcd__cell--conceal" : undefined,
    cell.style.blink ? "retro-lcd__cell--blink" : undefined
  );

type RetroLcdDisplayProps = {
  mode: RetroLcdProps["mode"];
  renderModel: RetroLcdRenderModel;
  displayColorMode: RetroLcdDisplayColorMode;
  screenRef: RefObject<HTMLDivElement | null>;
  probeRef: RefObject<HTMLSpanElement | null>;
  onViewportClick: () => void;
  children?: ReactNode;
};

export function RetroLcdDisplay({
  mode,
  renderModel,
  displayColorMode,
  screenRef,
  probeRef,
  onViewportClick,
  children
}: RetroLcdDisplayProps) {
  return (
    <div className="retro-lcd__screen">
      <div className="retro-lcd__viewport" onClick={onViewportClick}>
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
                        style={getCellPresentationStyle(cell, displayColorMode)}
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
