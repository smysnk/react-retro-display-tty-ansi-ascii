import { getGitHubCookieFromBrowser } from "./github-cookie-browser.mjs";

const printUsage = () => {
  console.log(`Usage:
  yarn readme:videos:cookie

This launches a browser window for github.com using a persistent automation profile.
If that profile is already signed in, it prints the GitHub Cookie header immediately.
Otherwise it waits for you to sign in, then prints the Cookie header.

Optional environment variables:
  GITHUB_COOKIE_USER_DATA_DIR   Override the persistent browser profile path
  GITHUB_COOKIE_WAIT_TIMEOUT_MS Override the login wait timeout in milliseconds`);
};

const main = async () => {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const cookieHeader = await getGitHubCookieFromBrowser();
  process.stdout.write(cookieHeader);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
