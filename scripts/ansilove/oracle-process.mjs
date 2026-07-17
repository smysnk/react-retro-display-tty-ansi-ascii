import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

export const run = (command, args, { cwd, env = {}, allowFailure = false } = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      const result = {
        code: code ?? -1,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      };

      if (!allowFailure && result.code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed (${result.code}${signal ? `, ${signal}` : ""})\n${result.stdout}${result.stderr}`
          )
        );
        return;
      }

      resolvePromise(result);
    });
  });

export const sha256File = async (filePath) =>
  createHash("sha256").update(await readFile(filePath)).digest("hex");
