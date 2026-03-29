import type { Preview } from "@storybook/react-vite";

export const projectAnnotations: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      expanded: true
    },
    docs: {
      defaultName: "Docs"
    },
    backgrounds: {
      disable: true
    },
    options: {
      storySort: {
        method: "alphabetical",
        order: [
          "RetroScreen",
          [
            "Docs",
            "Apple II DOS 3.3",
            "Calm Readout",
            "Display Color Modes",
            "Fit Width Locked Frame",
            "Light Dark Hosts",
            "Matrix Code Rain",
            "Midjourney Vortex",
            "Prompt Loop",
            "Terminal Stream",
            "White Rabbit Signal",
            "*",
            "Display Buffer",
            [
              "Docs",
              "ANSI Surface",
              "Bad Apple ANSI",
              "Bad Apple ANSI (Gzip Stream)",
              "Control Character Replay",
              "Control Character Replay Capture",
              "Display Buffer"
            ],
            "Editor",
            [
              "Docs",
              "Editable Notebook",
              "Editor Selection Lab",
              "Editor Selection Read Only",
              "Editor Selection Wrapped",
              "Editor Word Selection Lab"
            ],
            "Responsive",
            [
              "Docs",
              "Auto Resize Probe",
              "Auto Resize Probe Capture",
              "Resizable Panel",
              "Resizable Panel Capture",
              "Resizable Panel Leading Edges",
              "Responsive Panel"
            ],
            "Capture",
            [
              "Docs",
              "Apple II BASIC",
              "Bad Apple ANSI",
              "Bad Apple ANSI (Gzip Stream)",
              "Display Color Modes",
              "Editable Mode",
              "Feature Tour",
              "Light And Dark Hosts",
              "Live Tty Terminal Bridge",
              "Matrix Code Rain",
              "Prompt Mode",
              "Quiet Output",
              "Terminal Mode",
              "White Rabbit Signal"
            ]
          ]
        ]
      }
    }
  }
};
