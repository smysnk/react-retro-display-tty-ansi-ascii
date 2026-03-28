import type { Preview } from "@storybook/react-vite";
import { RetroScreenDocsPage } from "./RetroScreenDocsPage";
import { projectAnnotations } from "./projectAnnotations";
import "../src/styles/retro-screen.css";
import "../src/stories/storybook.css";

const preview: Preview = {
  ...projectAnnotations,
  parameters: {
    ...projectAnnotations.parameters,
    docs: {
      page: RetroScreenDocsPage
    }
  }
};

export default preview;
