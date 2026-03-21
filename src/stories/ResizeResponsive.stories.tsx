import type { Meta, StoryObj } from "@storybook/react-vite";
import { RetroScreen } from "../react/RetroScreen";
import {
  AutoResizeProbeDemoStory,
  AutoResizeProbeStory,
  ResizablePanelDemoStory,
  ResizablePanelLeadingEdgesStory,
  ResizablePanelStory,
  ResponsivePanelStory
} from "./RetroScreen.stories";

const meta = {
  title: "RetroScreen/Responsive",
  component: RetroScreen,
  parameters: {
    controls: {
      disable: true
    }
  }
} satisfies Meta<typeof RetroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ResponsivePanel: Story = {
  name: "Responsive Panel",
  render: () => <ResponsivePanelStory />
};

export const ResizablePanel: Story = {
  name: "Resizable Panel",
  render: () => <ResizablePanelStory />
};

export const ResizablePanelLeadingEdges: Story = {
  name: "Resizable Panel Leading Edges",
  render: () => <ResizablePanelLeadingEdgesStory />
};

export const AutoResizeProbe: Story = {
  name: "Auto Resize Probe",
  render: () => <AutoResizeProbeStory />
};

export const ResizablePanelCapture: Story = {
  name: "Resizable Panel Capture",
  render: () => <ResizablePanelDemoStory />
};

export const AutoResizeProbeCapture: Story = {
  name: "Auto Resize Probe Capture",
  render: () => <AutoResizeProbeDemoStory />
};
