import type { Meta, StoryObj } from "@storybook/react-vite";
import badAppleAnsiUrl from "./assets/bad-apple.ans?url";
import { BadAppleAnsiPlayback } from "../../examples/readme/ansi-art-playback/BadAppleAnsiPlayback";
import { AutoResizeProbe } from "../../examples/readme/auto-resize-probe/AutoResizeProbe";
import { ControlCharacterReplay } from "../../examples/readme/control-character-replay/ControlCharacterReplay";
import { DisplayColorModes } from "../../examples/readme/display-color-modes/DisplayColorModes";
import { EditableDrafting } from "../../examples/readme/editable-drafting/EditableDrafting";
import { StatusCard } from "../../examples/readme/getting-started/StatusCard";
import { LightDarkSurfaces } from "../../examples/readme/light-dark-surfaces/LightDarkSurfaces";
import { MatrixCodeRainScreen } from "../../examples/readme/matrix-code-rain/MatrixCodeRain";
import { MidjourneyVortexScreen } from "../../examples/readme/midjourney-vortex/MidjourneyVortex";
import { PromptInteraction } from "../../examples/readme/prompt-interaction/PromptInteraction";
import { QuietOutput } from "../../examples/readme/quiet-output/QuietOutput";
import { ResizablePanel } from "../../examples/readme/resizable-panel/ResizablePanel";
import { WhiteRabbitSignal } from "../../examples/readme/signal-intercept/WhiteRabbitSignal";
import { TerminalOutput } from "../../examples/readme/terminal-output/TerminalOutput";
import { TouchDemo } from "../../examples/readme/touch-input/TouchDemo";
import { RetroScreen } from "../react/RetroScreen";

const meta = {
  title: "README Examples",
  component: RetroScreen,
  parameters: {
    controls: { disable: true },
    docs: { disable: true }
  }
} satisfies Meta<typeof RetroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GettingStarted: Story = { render: () => <StatusCard /> };
export const TouchInput: Story = { render: () => <TouchDemo /> };
export const Resizable: Story = { render: () => <ResizablePanel /> };
export const Quiet: Story = { render: () => <QuietOutput /> };
export const SignalIntercept: Story = { render: () => <WhiteRabbitSignal /> };
export const MatrixRain: Story = { render: () => <MatrixCodeRainScreen /> };
export const Editable: Story = { render: () => <EditableDrafting /> };
export const Terminal: Story = { render: () => <TerminalOutput /> };
export const Prompt: Story = { render: () => <PromptInteraction /> };
export const DisplayColors: Story = { render: () => <DisplayColorModes /> };
export const ControlCharacters: Story = { render: () => <ControlCharacterReplay /> };
export const AutoResize: Story = { render: () => <AutoResizeProbe /> };
export const LightDark: Story = { render: () => <LightDarkSurfaces /> };
export const Midjourney: Story = { render: () => <MidjourneyVortexScreen /> };
export const AnsiArt: Story = {
  render: () => <BadAppleAnsiPlayback assetUrl={badAppleAnsiUrl} />
};
