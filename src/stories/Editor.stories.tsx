import type { Meta, StoryObj } from "@storybook/react-vite";
import { RetroScreen } from "../react/RetroScreen";
import {
  EditableNotebookStory,
  EditorSelectionLabStory,
  EditorSelectionReadOnlyStory,
  EditorSelectionWrappedStory,
  EditorWordSelectionLabStory
} from "./RetroScreen.stories";

const meta = {
  title: "RetroScreen/Editor",
  component: RetroScreen,
  parameters: {
    controls: {
      disable: true
    }
  }
} satisfies Meta<typeof RetroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EditableNotebook: Story = {
  render: () => <EditableNotebookStory />
};

export const EditorSelectionLab: Story = {
  render: () => <EditorSelectionLabStory />
};

export const EditorSelectionWrapped: Story = {
  render: () => <EditorSelectionWrappedStory />
};

export const EditorWordSelectionLab: Story = {
  render: () => <EditorWordSelectionLabStory />
};

export const EditorSelectionReadOnly: Story = {
  render: () => <EditorSelectionReadOnlyStory />
};
