import type { RetroScreenRenderModel } from "./retro-screen-render-model";

export function RetroScreenAccessibleText({
  renderModel
}: {
  renderModel: RetroScreenRenderModel;
}) {
  return (
    <pre className="retro-screen__accessible-text" data-retro-screen-accessible-text="true">
      {renderModel.lines.join("\n")}
    </pre>
  );
}
