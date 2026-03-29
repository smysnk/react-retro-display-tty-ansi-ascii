import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const require = createRequire(import.meta.url);
const getAbsolutePath = (packageName: string) =>
  dirname(require.resolve(join(packageName, "package.json")));
const resolveStorybookBasePath = () => {
  const configuredBasePath = process.env.STORYBOOK_BASE_PATH ?? "/";

  if (configuredBasePath === "/") {
    return configuredBasePath;
  }

  return configuredBasePath.endsWith("/") ? configuredBasePath : `${configuredBasePath}/`;
};
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const config: StorybookConfig = {
  stories: [
    "../src/stories/RetroScreen.stories.tsx",
    "../src/stories/Apple2Basic.stories.tsx",
    "../src/stories/AnsiDisplayBuffer.stories.tsx",
    "../src/stories/Editor.stories.tsx",
    "../src/stories/ResizeResponsive.stories.tsx",
    "../src/stories/RetroScreenCapture.stories.tsx"
  ],
  addons: [getAbsolutePath("@storybook/addon-docs")],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  features: {
    onboarding: false
  },
  docs: {
    autodocs: "tag"
  },
  async viteFinal(existingConfig) {
    return mergeConfig(existingConfig, {
      base: resolveStorybookBasePath(),
      resolve: {
        preserveSymlinks: false
      },
      server: {
        fs: {
          strict: true,
          allow: [workspaceRoot]
        },
        watch: {
          followSymlinks: false,
          ignored: [
            "**/.git/**",
            "**/node_modules/**",
            "**/storybook-static/**",
            "**/.test-results/**",
            "**/docs/assets/**",
            "**/references/**"
          ]
        }
      }
    });
  }
};

export default config;
