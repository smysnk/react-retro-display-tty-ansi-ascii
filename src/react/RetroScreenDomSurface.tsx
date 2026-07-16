import type {
  RetroScreenDisplayColorMode,
  RetroScreenDisplaySurfaceMode
} from "../core/types";
import { getCellPresentationStyle } from "./retro-screen-display-color";
import {
  getCellCharacter,
  type RetroScreenRenderCell,
  type RetroScreenRenderModel
} from "./retro-screen-render-model";

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const getCellClassName = (cell: RetroScreenRenderCell, displayIceColors: boolean) =>
  joinClassNames(
    "retro-screen__cell",
    cell.style.bold ? "retro-screen__cell--bold" : undefined,
    cell.style.faint ? "retro-screen__cell--faint" : undefined,
    cell.style.inverse ? "retro-screen__cell--inverse" : undefined,
    cell.style.conceal ? "retro-screen__cell--conceal" : undefined,
    cell.style.blink && !displayIceColors ? "retro-screen__cell--blink" : undefined,
    cell.isSelected ? "retro-screen__cell--selected" : undefined
  );

export function RetroScreenDomSurface({
  renderModel,
  displayColorMode,
  displayIceColors,
  displaySurfaceMode
}: {
  renderModel: RetroScreenRenderModel;
  displayColorMode: RetroScreenDisplayColorMode;
  displayIceColors: boolean;
  displaySurfaceMode: RetroScreenDisplaySurfaceMode;
}) {
  return renderModel.cells.map((line, rowIndex) => (
    <div
      className={joinClassNames("retro-screen__line", "retro-screen__line--cells")}
      key={`cells-${rowIndex}`}
    >
      {line.map((cell, colIndex) => (
        <span
          className={getCellClassName(cell, displayIceColors)}
          key={`${rowIndex}-${colIndex}`}
          data-source-offset={cell.sourceOffset ?? undefined}
          style={getCellPresentationStyle(
            cell,
            displayColorMode,
            displaySurfaceMode,
            displayIceColors
          )}
        >
          {getCellCharacter(cell)}
        </span>
      ))}
    </div>
  ));
}
