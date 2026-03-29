import type { Meta, StoryObj } from "@storybook/react-vite";
import { RetroScreen } from "../react/RetroScreen";
import { Apple2BasicDemoStory } from "./Apple2Basic.stories";
import {
  BadAppleAnsiDemoStory,
  BadAppleAnsiGzipStreamDemoStory,
  DisplayColorModesDemoStory,
  EditableModeDemoStory,
  FeatureTourStory,
  LightDarkHostsDemoStory,
  LiveTtyTerminalBridgeDemoStory,
  MatrixCodeRainDemoStory,
  PromptModeDemoStory,
  QuietOutputDemoStory,
  TerminalModeDemoStory,
  WhiteRabbitSignalDemoStory
} from "./RetroScreen.stories";

const meta = {
  title: "RetroScreen/Capture",
  component: RetroScreen,
  parameters: {
    controls: {
      disable: true
    },
    docs: {
      disable: true
    }
  }
} satisfies Meta<typeof RetroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FeatureTour: Story = {
  render: () => <FeatureTourStory />
};

export const QuietOutputDemo: Story = {
  name: "Quiet Output",
  render: () => <QuietOutputDemoStory />
};

export const EditableModeDemo: Story = {
  name: "Editable Mode",
  render: () => <EditableModeDemoStory />
};

export const TerminalModeDemo: Story = {
  name: "Terminal Mode",
  render: () => <TerminalModeDemoStory />
};

export const PromptModeDemo: Story = {
  name: "Prompt Mode",
  render: () => <PromptModeDemoStory />
};

export const Apple2BasicDemo: Story = {
  name: "Apple II BASIC",
  render: () => <Apple2BasicDemoStory />
};

export const WhiteRabbitSignalDemo: Story = {
  name: "White Rabbit Signal",
  render: () => <WhiteRabbitSignalDemoStory />
};

export const MatrixCodeRainDemo: Story = {
  name: "Matrix Code Rain",
  render: () => <MatrixCodeRainDemoStory />
};

export const BadAppleAnsi: Story = {
  name: "Bad Apple ANSI",
  render: () => <BadAppleAnsiDemoStory />
};

export const BadAppleAnsiGzipStream: Story = {
  name: "Bad Apple ANSI (Gzip Stream)",
  render: () => <BadAppleAnsiGzipStreamDemoStory />
};

export const DisplayColorModesDemo: Story = {
  name: "Display Color Modes",
  render: () => <DisplayColorModesDemoStory />
};

export const LightDarkHostsDemo: Story = {
  name: "Light And Dark Hosts",
  render: () => <LightDarkHostsDemoStory />
};

export const LiveTtyTerminalBridgeDemo: Story = {
  name: "Live Tty Terminal Bridge",
  render: () => <LiveTtyTerminalBridgeDemoStory />
};
