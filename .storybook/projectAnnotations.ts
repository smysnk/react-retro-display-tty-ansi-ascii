import type { Preview } from "@storybook/react-vite";

export const projectAnnotations: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      expanded: true
    },
    docs: {
      defaultName: "Overview"
    },
    backgrounds: {
      disable: true
    },
    options: {
      storySort: {
        order: [
          "RetroScreen",
          ["Overview", "*"],
          "Display Buffer",
          "Editor",
          "Responsive",
          "Capture"
        ]
      }
    }
  }
};
