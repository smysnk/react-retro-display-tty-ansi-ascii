import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright-core";

const rootDir = resolve(new URL("..", import.meta.url).pathname);
const staticDir = resolve(rootDir, "storybook-static");
const outputDir = resolve(rootDir, "docs/assets");
const outputWebpFile = resolve(outputDir, "react-retro-display-tty-ansi.webp");
const outputMp4File = resolve(outputDir, "react-retro-display-tty-ansi.mp4");
const quietOutputWebpFile = resolve(outputDir, "react-retro-display-tty-ansi-quiet-output.webp");
const quietOutputMp4File = resolve(outputDir, "react-retro-display-tty-ansi-quiet-output.mp4");
const editableModeWebpFile = resolve(
  outputDir,
  "react-retro-display-tty-ansi-editable-drafting.webp"
);
const editableModeMp4File = resolve(
  outputDir,
  "react-retro-display-tty-ansi-editable-drafting.mp4"
);
const terminalModeWebpFile = resolve(
  outputDir,
  "react-retro-display-tty-ansi-terminal-output.webp"
);
const terminalModeMp4File = resolve(
  outputDir,
  "react-retro-display-tty-ansi-terminal-output.mp4"
);
const promptModeWebpFile = resolve(outputDir, "react-retro-display-tty-ansi-prompt-loop.webp");
const promptModeMp4File = resolve(outputDir, "react-retro-display-tty-ansi-prompt-loop.mp4");
const displayColorModesWebpFile = resolve(
  outputDir,
  "react-retro-display-tty-ansi-display-color-modes.webp"
);
const displayColorModesMp4File = resolve(
  outputDir,
  "react-retro-display-tty-ansi-display-color-modes.mp4"
);
const controlCharacterReplayWebpFile = resolve(
  outputDir,
  "react-retro-display-tty-ansi-control-character-replay.webp"
);
const controlCharacterReplayMp4File = resolve(
  outputDir,
  "react-retro-display-tty-ansi-control-character-replay.mp4"
);
const autoResizeProbeWebpFile = resolve(
  outputDir,
  "react-retro-display-tty-ansi-auto-resize-probe.webp"
);
const autoResizeProbeMp4File = resolve(
  outputDir,
  "react-retro-display-tty-ansi-auto-resize-probe.mp4"
);
const lightDarkHostsWebpFile = resolve(
  outputDir,
  "react-retro-display-tty-ansi-light-dark-hosts.webp"
);
const lightDarkHostsMp4File = resolve(
  outputDir,
  "react-retro-display-tty-ansi-light-dark-hosts.mp4"
);
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number.parseInt(process.env.STORYBOOK_CAPTURE_PORT ?? "6111", 10);
const featureTourFps = Number.parseInt(process.env.STORYBOOK_CAPTURE_FPS ?? "14", 10);
const featureTourDurationMs = Number.parseInt(
  process.env.STORYBOOK_CAPTURE_DURATION_MS ?? "30000",
  10
);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

const ensureReadable = async (target, label) => {
  try {
    await access(target);
  } catch {
    throw new Error(`${label} not found at ${target}`);
  }
};

const resolveRequestFile = async (requestPath) => {
  const stripped = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = normalize(stripped).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = resolve(staticDir, `.${safePath}`);

  if (!candidate.startsWith(staticDir)) {
    throw new Error("Blocked path traversal attempt.");
  }

  const details = await stat(candidate).catch(() => null);

  if (details?.isDirectory()) {
    return resolve(candidate, "index.html");
  }

  if (details?.isFile()) {
    return candidate;
  }

  throw new Error(`Missing asset: ${requestPath}`);
};

const createStaticServer = () =>
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const filePath = await resolveRequestFile(url.pathname);
      const contentType = mimeTypes.get(extname(filePath)) ?? "application/octet-stream";

      response.writeHead(200, { "content-type": contentType });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : "Not found");
    }
  });

const runImg2Webp = async ({ framesDir, fps, outputFile }) => {
  const duration = Math.max(40, Math.round(1000 / fps));
  const frameFiles = (await readdir(framesDir))
    .filter((file) => file.endsWith(".png"))
    .sort((left, right) => left.localeCompare(right));
  const args = ["-loop", "0", "-kmin", "9", "-kmax", "17", "-mixed"];

  for (const [index, frameFile] of frameFiles.entries()) {
    if (index > 0) {
      args.push("-d", String(duration));
    }

    args.push("-lossy", "-q", "82", "-m", "6", join(framesDir, frameFile));
  }

  args.push("-o", outputFile);

  const result = spawnSync("img2webp", args, {
    cwd: rootDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error("img2webp failed to encode the animated webp.");
  }
};

const runFfmpegMp4 = ({ framesDir, fps, outputFile }) => {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      join(framesDir, "frame-%04d.png"),
      "-vf",
      "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-crf",
      "18",
      outputFile
    ],
    {
      cwd: rootDir,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error("ffmpeg failed to encode the mp4 demo.");
  }
};

const captures = [
  {
    name: "feature tour",
    storyId: "retroscreen--feature-tour",
    selector: "[data-feature-tour-root='true']",
    waitMs: 300,
    fps: featureTourFps,
    durationMs: featureTourDurationMs,
    outputs: [
      { type: "webp", file: outputWebpFile },
      { type: "mp4", file: outputMp4File }
    ]
  },
  {
    name: "quiet output",
    storyId: "retroscreen--quiet-output-demo",
    selector: "[data-demo-capture='quiet-output']",
    waitMs: 220,
    fps: 16,
    durationMs: 5200,
    outputs: [
      { type: "webp", file: quietOutputWebpFile },
      { type: "mp4", file: quietOutputMp4File }
    ]
  },
  {
    name: "editable drafting",
    storyId: "retroscreen--editable-mode-demo",
    selector: "[data-demo-capture='editable-drafting']",
    waitMs: 220,
    fps: 16,
    durationMs: 7600,
    outputs: [
      { type: "webp", file: editableModeWebpFile },
      { type: "mp4", file: editableModeMp4File }
    ]
  },
  {
    name: "terminal output",
    storyId: "retroscreen--terminal-mode-demo",
    selector: "[data-demo-capture='terminal-output']",
    waitMs: 220,
    fps: 15,
    durationMs: 6200,
    outputs: [
      { type: "webp", file: terminalModeWebpFile },
      { type: "mp4", file: terminalModeMp4File }
    ]
  },
  {
    name: "prompt loop",
    storyId: "retroscreen--prompt-mode-demo",
    selector: "[data-demo-capture='prompt-interaction']",
    waitMs: 220,
    fps: 15,
    durationMs: 9000,
    outputs: [
      { type: "webp", file: promptModeWebpFile },
      { type: "mp4", file: promptModeMp4File }
    ]
  },
  {
    name: "display color modes",
    storyId: "retroscreen--display-color-modes-demo",
    selector: "[data-demo-capture='display-color-modes']",
    waitMs: 180,
    fps: 16,
    durationMs: 9800,
    outputs: [
      { type: "webp", file: displayColorModesWebpFile },
      { type: "mp4", file: displayColorModesMp4File }
    ]
  },
  {
    name: "light and dark hosts",
    storyId: "retroscreen--light-dark-hosts-demo",
    selector: "[data-demo-capture='light-dark-hosts']",
    waitMs: 180,
    fps: 16,
    durationMs: 10400,
    outputs: [
      { type: "webp", file: lightDarkHostsWebpFile },
      { type: "mp4", file: lightDarkHostsMp4File }
    ]
  },
  {
    name: "control character replay",
    storyId: "retroscreen--control-character-replay-demo",
    selector: "[data-demo-capture='control-character-replay']",
    waitMs: 180,
    fps: 16,
    durationMs: 10800,
    outputs: [
      { type: "webp", file: controlCharacterReplayWebpFile },
      { type: "mp4", file: controlCharacterReplayMp4File }
    ]
  },
  {
    name: "auto resize probe",
    storyId: "retroscreen--auto-resize-probe-demo",
    selector: "[data-demo-capture='auto-resize-probe']",
    waitMs: 240,
    fps: 16,
    durationMs: 10400,
    outputs: [
      { type: "webp", file: autoResizeProbeWebpFile },
      { type: "mp4", file: autoResizeProbeMp4File }
    ]
  }
];

const captureStoryFrames = async (page, capture) => {
  const frameDir = await mkdtemp(join(tmpdir(), "retro-display-frames-"));
  const frameCount = Math.max(1, Math.ceil((capture.durationMs / 1000) * capture.fps));

  try {
    await page.goto(
      `http://127.0.0.1:${port}/iframe.html?id=${capture.storyId}&viewMode=story`,
      { waitUntil: "networkidle" }
    );
    await page.waitForSelector(capture.selector);
    await page.waitForTimeout(capture.waitMs);

    const target = page.locator(capture.selector);

    for (let index = 0; index < frameCount; index += 1) {
      const framePath = join(frameDir, `frame-${String(index).padStart(4, "0")}.png`);
      await target.screenshot({ path: framePath });

      if (index < frameCount - 1) {
        await page.waitForTimeout(1000 / capture.fps);
      }
    }

    return { frameDir, frameCount };
  } catch (error) {
    await rm(frameDir, { recursive: true, force: true });
    throw error;
  }
};

const encodeCapture = async (capture, framesDir, frameCount) => {
  for (const output of capture.outputs) {
    if (output.type === "webp") {
      await runImg2Webp({
        framesDir,
        fps: capture.fps,
        outputFile: output.file
      });
    } else {
      runFfmpegMp4({
        framesDir,
        fps: capture.fps,
        outputFile: output.file
      });
    }

    const encodedAsset = await stat(output.file);
    console.log(
      `Created ${output.file} for ${capture.name} from ${frameCount} frames (${Math.round(
        encodedAsset.size / 1024
      )} KB).`
    );
  }
};

const main = async () => {
  await ensureReadable(staticDir, "storybook-static");
  await ensureReadable(chromePath, "Chrome executable");
  await mkdir(outputDir, { recursive: true });

  const server = createStaticServer();
  await new Promise((resolvePromise) => server.listen(port, resolvePromise));

  let browser;
  let page;

  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true
    });

    page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 920
      },
      deviceScaleFactor: 1
    });

    for (const capture of captures) {
      const { frameDir, frameCount } = await captureStoryFrames(page, capture);

      try {
        await encodeCapture(capture, frameDir, frameCount);
      } finally {
        await rm(frameDir, { recursive: true, force: true });
      }
    }
  } finally {
    await page?.close();
    await browser?.close();
    await new Promise((resolvePromise) => server.close(() => resolvePromise(undefined)));
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
