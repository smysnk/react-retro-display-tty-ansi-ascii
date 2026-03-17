import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const moduleDir =
  typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(moduleDir, "../..");
const srcDir = resolve(rootDir, "src");

const walkFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const nextPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(nextPath);
      }

      return nextPath;
    })
  );

  return files.flat();
};

const extractImports = (source: string) =>
  Array.from(
    source.matchAll(/(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g),
    (match) => match[1]
  );

const runtimeSourceFiles = async () =>
  (await walkFiles(srcDir)).filter(
    (filePath) =>
      /\.(ts|tsx)$/u.test(filePath) &&
      !filePath.endsWith(".test.ts") &&
      !filePath.endsWith(".test.tsx") &&
      !filePath.includes("/stories/")
  );

describe("terminal architecture guardrails", () => {
  it("keeps React and browser-only dependencies out of core runtime modules", async () => {
    const coreFiles = (await runtimeSourceFiles()).filter(
      (filePath) =>
        filePath.includes("/src/core/terminal/") || filePath.includes("/src/core/geometry/")
    );
    const violations: string[] = [];

    for (const filePath of coreFiles) {
      const imports = extractImports(await readFile(filePath, "utf8"));

      for (const dependency of imports) {
        if (
          dependency === "react" ||
          dependency.startsWith("@storybook/") ||
          dependency === "playwright-core" ||
          dependency.startsWith("@testing-library/")
        ) {
          violations.push(`${relative(rootDir, filePath)} -> ${dependency}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps xterm and conformance-only dependencies out of production React modules", async () => {
    const reactFiles = (await runtimeSourceFiles()).filter((filePath) => filePath.includes("/src/react/"));
    const violations: string[] = [];

    for (const filePath of reactFiles) {
      const imports = extractImports(await readFile(filePath, "utf8"));

      for (const dependency of imports) {
        if (
          dependency === "@xterm/headless" ||
          dependency.includes("/conformance/") ||
          dependency.endsWith("/conformance")
        ) {
          violations.push(`${relative(rootDir, filePath)} -> ${dependency}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("limits the xterm oracle dependency to conformance-only modules", async () => {
    const files = await runtimeSourceFiles();
    const violations: string[] = [];

    for (const filePath of files) {
      const imports = extractImports(await readFile(filePath, "utf8"));

      if (imports.includes("@xterm/headless") && !filePath.includes("/src/core/terminal/conformance/")) {
        violations.push(relative(rootDir, filePath));
      }
    }

    expect(violations).toEqual([]);
  });
});
