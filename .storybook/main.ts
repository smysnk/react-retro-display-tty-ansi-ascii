import { dirname, join } from "node:path";
import { createRequire } from "node:module";
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

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [getAbsolutePath("@storybook/addon-docs")],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  docs: {
    autodocs: "tag"
  },
  async viteFinal(existingConfig) {
    return mergeConfig(existingConfig, {
      base: resolveStorybookBasePath()
    });
  }
};

export default config;
