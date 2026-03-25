import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { getGitHubCookieFromBrowser } from "./github-cookie-browser.mjs";

const rootDir = resolve(new URL("..", import.meta.url).pathname);
const repositoryId = process.env.GITHUB_REPOSITORY_ID ?? "1183359000";
const repositorySlug = process.env.GITHUB_REPOSITORY ?? "smysnk/react-retro-display-tty-ansi-ascii";
const readmeAssetBranch = process.env.README_ASSET_BRANCH ?? "main";

const readmeFile = resolve(rootDir, "README.md");

const videoEntries = [
  {
    title: "Feature Tour Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii.mp4")
  },
  {
    title: "Quiet Output Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-quiet-output.mp4")
  },
  {
    title: "Editable Drafting Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-editable-drafting.mp4")
  },
  {
    title: "Terminal Output Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-terminal-output.mp4")
  },
  {
    title: "Prompt Interaction Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-prompt-loop.mp4")
  },
  {
    title: "White Rabbit Signal Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-white-rabbit-signal.mp4")
  },
  {
    title: "Matrix Code Rain Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-matrix-code-rain.mp4")
  },
  {
    title: "Bad Apple ANSI Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-bad-apple-ansi.mp4")
  },
  {
    title: "Display Color Modes Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-display-color-modes.mp4")
  },
  {
    title: "Light And Dark Hosts Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-light-dark-hosts.mp4")
  },
  {
    title: "Control Character Replay Demo",
    file: resolve(
      rootDir,
      "docs/assets/react-retro-display-tty-ansi-ascii-control-character-replay.mp4"
    )
  },
  {
    title: "Auto Resize Probe Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-auto-resize-probe.mp4")
  },
  {
    title: "Resizable Panel Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-resizable-panel.mp4")
  },
  {
    title: "Live Tty Terminal Bridge Demo",
    file: resolve(rootDir, "docs/assets/react-retro-display-tty-ansi-ascii-live-tty-terminal-bridge.mp4")
  }
];

const readmeVideoOnlyFilters = [
  ...(process.env.README_VIDEO_ONLY ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  ...process.argv
    .filter((argument) => argument.startsWith("--only="))
    .map((argument) => argument.slice("--only=".length).trim().toLowerCase())
    .filter(Boolean)
];

const selectedVideoEntries = readmeVideoOnlyFilters.length > 0
  ? videoEntries.filter((entry) => {
      const matchValues = [entry.title, entry.file, basename(entry.file)].map((value) =>
        value.toLowerCase()
      );

      return readmeVideoOnlyFilters.some((filter) =>
        matchValues.some((value) => value.includes(filter))
      );
    })
  : videoEntries;

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  origin: "https://github.com",
  referer: "https://github.com/"
};

const filterHeaders = (headers) =>
  Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined && value !== null));

const buildReadmePreviewUrl = (filePath) => {
  const previewFileName = basename(filePath).replace(/\.mp4$/u, ".webp");
  return `https://raw.githubusercontent.com/${repositorySlug}/${readmeAssetBranch}/docs/assets/${previewFileName}`;
};

const buildPreviewLink = (href, previewUrl, title) => `[![${title}](${previewUrl})](${href})`;

const uploadVideo = async (filePath, githubCookie) => {
  const fileName = basename(filePath);
  const fileBuffer = await readFile(filePath);
  const fileInfo = await stat(filePath);
  const file = new File([fileBuffer], fileName, { type: "video/mp4" });

  const policyBody = new FormData();
  policyBody.append("repository_id", String(repositoryId));
  policyBody.append("name", file.name);
  policyBody.append("size", String(fileInfo.size));
  policyBody.append("content_type", file.type);

  const policyResponse = await fetch("https://github.com/upload/policies/assets", {
    method: "POST",
    body: policyBody,
    headers: filterHeaders({
      ...defaultHeaders,
      cookie: githubCookie,
      Accept: "application/json",
      "GitHub-Verified-Fetch": "true",
      "X-Requested-With": "XMLHttpRequest"
    })
  });

  if (!policyResponse.ok) {
    const text = await policyResponse.text();
    throw new Error(
      `Failed to create upload policy for ${fileName}: ${policyResponse.status} ${policyResponse.statusText}\n${text.slice(
        0,
        400
      )}`
    );
  }

  const policy = await policyResponse.json();

  const uploadBody = new FormData();
  for (const [key, value] of Object.entries(policy.form ?? {})) {
    uploadBody.append(key, String(value));
  }
  uploadBody.append("file", file, file.name);

  const uploadResponse = await fetch(policy.upload_url, {
    method: "POST",
    body: uploadBody,
    headers: filterHeaders({
      ...defaultHeaders,
      cookie: githubCookie,
      authenticity_token: policy.same_origin ? policy.upload_authenticity_token : undefined,
      ...policy.header
    })
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(
      `Failed to upload ${fileName}: ${uploadResponse.status} ${uploadResponse.statusText}\n${text.slice(
        0,
        400
      )}`
    );
  }

  const finalizeBody = new FormData();
  finalizeBody.append("authenticity_token", policy.asset_upload_authenticity_token);

  const finalizeResponse = await fetch(new URL(policy.asset_upload_url, "https://github.com/"), {
    method: "PUT",
    body: finalizeBody,
    headers: filterHeaders({
      ...defaultHeaders,
      cookie: githubCookie,
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest"
    })
  });

  if (!finalizeResponse.ok) {
    const text = await finalizeResponse.text();
    throw new Error(
      `Failed to finalize ${fileName}: ${finalizeResponse.status} ${finalizeResponse.statusText}\n${text.slice(
        0,
        400
      )}`
    );
  }

  return policy.asset?.href;
};

const updateReadme = async (uploads) => {
  let readme = await readFile(readmeFile, "utf8");

  for (const { title, href, previewUrl } of uploads) {
    const linkedPreviewPattern = new RegExp(
      String.raw`\[!\[${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\]\([^)]+\)\]\([^)]+\)`,
      "g"
    );
    const videoTagPattern = new RegExp(
      String.raw`<video src="[^"]+"[^>]*title="${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>\n  Your browser does not support the video tag\.\n<\/video>`,
      "g"
    );
    const replacement = buildPreviewLink(href, previewUrl, title);

    readme = readme.replace(linkedPreviewPattern, replacement);
    readme = readme.replace(videoTagPattern, replacement);
  }

  await writeFile(readmeFile, readme);
};

const printUsage = () => {
  console.log(`Usage:
  GITHUB_COOKIE='cookie string from github.com while signed in' yarn readme:videos
  yarn readme:videos
  yarn readme:videos --browser-cookie
  yarn readme:videos --only=editable --only=prompt

This uploads the README demo MP4 files to GitHub user-attachments and rewrites README.md
to use npm-safe animated WebP preview links that point at the uploaded videos.

If GITHUB_COOKIE is not provided, the script can open a browser window, reuse a persistent
GitHub session if one exists, or wait for you to log in before continuing.

Optional environment variables:
  GITHUB_COOKIE_USER_DATA_DIR   Override the persistent browser profile path
  GITHUB_COOKIE_WAIT_TIMEOUT_MS Override the login wait timeout in milliseconds
  README_VIDEO_ONLY             Comma-separated filters for limiting which videos are uploaded`);
};

const main = async () => {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const preferBrowserCookie = process.argv.includes("--browser-cookie");
  const githubCookie =
    !preferBrowserCookie && process.env.GITHUB_COOKIE
      ? process.env.GITHUB_COOKIE
      : await getGitHubCookieFromBrowser({ log: console.log });

  if (selectedVideoEntries.length === 0) {
    throw new Error(
      `No README videos matched the requested filter(s): ${readmeVideoOnlyFilters.join(", ")}`
    );
  }

  const uploads = [];

  for (const entry of selectedVideoEntries) {
    const href = await uploadVideo(entry.file, githubCookie);

    if (!href) {
      throw new Error(`GitHub did not return an attachment URL for ${basename(entry.file)}.`);
    }

    uploads.push({
      title: entry.title,
      href,
      previewUrl: buildReadmePreviewUrl(entry.file)
    });

    console.log(`${entry.title}: ${href}`);
  }

  await updateReadme(uploads);
  console.log(`Updated ${readmeFile} with GitHub user-attachments video URLs.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
