import type { Preview } from "@storybook/react-vite";
import "../src/styles/retro-screen.css";
import "../src/stories/storybook.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      expanded: true
    },
    backgrounds: {
      disable: true
    },
    options: {
      storySort: {
        order: ["RetroScreen"]
      }
    }
  }
};

export default preview;
