import type { Meta, StoryObj } from "@storybook/react-vite";
import { RetroScreen } from "../react/RetroScreen";
import {
  AnsiSurfaceStory,
  BadAppleAnsiStory,
  ControlCharacterReplayDemoStory,
  ControlCharacterReplayStory,
  DisplayBufferStory
} from "./RetroScreen.stories";

const meta = {
  title: "RetroScreen/Display Buffer",
  component: RetroScreen,
  parameters: {
    controls: {
      disable: true
    }
  }
} satisfies Meta<typeof RetroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AnsiSurface: Story = {
  name: "ANSI Surface",
  render: () => <AnsiSurfaceStory />
};

export const ControlCharacterReplay: Story = {
  name: "Control Character Replay",
  render: () => <ControlCharacterReplayStory />
};

export const DisplayBuffer: Story = {
  name: "Display Buffer",
  render: () => <DisplayBufferStory />
};

export const BadAppleAnsi: Story = {
  name: "Bad Apple ANSI",
  render: () => <BadAppleAnsiStory />
};

export const ControlCharacterReplayCapture: Story = {
  name: "Control Character Replay Capture",
  render: () => <ControlCharacterReplayDemoStory />
};
