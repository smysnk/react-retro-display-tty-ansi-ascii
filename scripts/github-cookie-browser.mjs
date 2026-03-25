import { access, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);

const githubUrl = "https://github.com/";
const githubLoginUrl = "https://github.com/login";
const cookieWaitTimeoutMs = Number.parseInt(
  process.env.GITHUB_COOKIE_WAIT_TIMEOUT_MS ?? String(10 * 60 * 1000),
  10
);
const pollIntervalMs = Number.parseInt(process.env.GITHUB_COOKIE_POLL_INTERVAL_MS ?? "1000", 10);
const defaultUserDataDir = process.env.GITHUB_COOKIE_USER_DATA_DIR ?? join(
  homedir(),
  ".react-retro-display-tty-ansi-ascii",
  "github-cookie-profile"
);

const sessionCookieNames = new Set(["user_session", "__Host-user_session_same_site"]);

const sleep = (duration) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

export const detectChromePath = async () => {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "No Chrome or Chromium executable was found. Set CHROME_PATH to use browser-assisted GitHub login."
  );
};

const selectGitHubCookies = (cookies) =>
  cookies
    .filter((cookie) => cookie.domain === "github.com" || cookie.domain === ".github.com")
    .sort((left, right) => left.name.localeCompare(right.name));

const buildCookieHeader = (cookies) => cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

const extractSignedInCookieHeader = (cookies) => {
  const githubCookies = selectGitHubCookies(cookies);
  const byName = new Map(githubCookies.map((cookie) => [cookie.name, cookie.value]));
  const hasSessionCookie = githubCookies.some((cookie) => sessionCookieNames.has(cookie.name));
  const loggedIn = byName.get("logged_in") === "yes" || byName.has("dotcom_user");

  if (!hasSessionCookie || !loggedIn) {
    return null;
  }

  return buildCookieHeader(githubCookies);
};

const getSignedInCookieHeader = async (context) =>
  extractSignedInCookieHeader(await context.cookies(githubUrl));

export const getGitHubCookieFromBrowser = async ({
  userDataDir = defaultUserDataDir,
  timeoutMs = cookieWaitTimeoutMs,
  log = console.error
} = {}) => {
  await mkdir(userDataDir, { recursive: true });

  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    executablePath: await detectChromePath(),
    headless: false,
    viewport: {
      width: 1280,
      height: 960
    }
  });

  const page = browserContext.pages()[0] ?? (await browserContext.newPage());

  try {
    log(`Opening GitHub login flow in a browser window using profile: ${userDataDir}`);
    await page.goto(githubUrl, { waitUntil: "domcontentloaded" });
    await page.bringToFront();

    const initialCookie = await getSignedInCookieHeader(browserContext);
    if (initialCookie) {
      log("GitHub session detected in the browser profile. Reusing it for README video uploads.");
      return initialCookie;
    }

    log("Waiting for a GitHub login to complete in the opened browser window...");
    await page.goto(githubLoginUrl, { waitUntil: "domcontentloaded" });

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const cookieHeader = await getSignedInCookieHeader(browserContext);
      if (cookieHeader) {
        log("GitHub login detected. Captured a fresh cookie header for the upload workflow.");
        return cookieHeader;
      }

      await sleep(pollIntervalMs);
    }

    throw new Error(
      `Timed out waiting for GitHub login after ${Math.round(timeoutMs / 1000)} seconds.`
    );
  } finally {
    await browserContext.close();
  }
};
