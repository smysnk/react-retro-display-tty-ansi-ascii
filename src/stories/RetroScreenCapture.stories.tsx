import type { Meta, StoryObj } from "@storybook/react-vite";
import { RetroScreen } from "../react/RetroScreen";
import {
  DisplayColorModesDemoStory,
  EditableModeDemoStory,
  FeatureTourStory,
  LightDarkHostsDemoStory,
  LiveTtyTerminalBridgeDemoStory,
  PromptModeDemoStory,
  QuietOutputDemoStory,
  TerminalModeDemoStory
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
