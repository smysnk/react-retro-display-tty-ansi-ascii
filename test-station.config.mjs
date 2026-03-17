const rootDir = import.meta.dirname;

export default {
  schemaVersion: "1",
  project: {
    name: "react-retro-display-tty-ansi",
    rootDir,
    outputDir: ".test-results/test-station",
    rawDir: ".test-results/test-station/raw"
  },
  workspaceDiscovery: {
    provider: "manual",
    packages: ["library", "docs", "quality"]
  },
  execution: {
    continueOnError: true,
    defaultCoverage: false
  },
  enrichers: {
    sourceAnalysis: {
      enabled: true
    }
  },
  render: {
    html: true,
    console: true,
    defaultView: "package",
    includeDetailedAnalysisToggle: true
  },
  suites: [
    {
      id: "package-build",
      label: "Package Build",
      adapter: "shell",
      package: "quality",
      cwd: rootDir,
      command: ["yarn", "build"],
      module: "release",
      theme: "build",
      coverage: {
        enabled: false
      }
    },
    {
      id: "library-unit",
      label: "Vitest Suite",
      adapter: "vitest",
      package: "library",
      cwd: rootDir,
      command: ["yarn", "vitest", "run"],
      module: "runtime",
      theme: "react",
      coverage: {
        enabled: true,
        mode: "second-pass"
      }
    },
    {
      id: "storybook-build",
      label: "Storybook Build",
      adapter: "shell",
      package: "docs",
      cwd: rootDir,
      command: ["yarn", "storybook:build"],
      module: "docs",
      theme: "storybook",
      coverage: {
        enabled: false
      }
    }
  ],
  adapters: []
};
