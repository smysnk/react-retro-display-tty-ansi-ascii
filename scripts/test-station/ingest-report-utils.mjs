import fs from "node:fs";
import path from "node:path";

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

export function createIngestPayload(options = {}) {
  const reportPath = requireNonEmptyString(options.reportPath, "reportPath");
  const projectKey = requireNonEmptyString(options.projectKey, "projectKey");
  const report = options.report || readJson(reportPath);
  const outputDir = path.resolve(options.outputDir || path.dirname(reportPath));
  const storage = normalizeStorageOptions(options.storage);

  return {
    projectKey,
    report: attachArtifactLocations(report, storage),
    source: buildGitHubSourceContext({
      buildStartedAt: options.buildStartedAt,
      buildCompletedAt: options.buildCompletedAt,
      jobStatus: options.jobStatus,
      artifactCount: countOutputFiles(outputDir),
      storage
    }),
    artifacts: collectOutputArtifacts(outputDir, storage)
  };
}

export async function publishIngestPayload(options = {}) {
  const endpoint = requireNonEmptyString(options.endpoint, "endpoint");
  const sharedKey = requireNonEmptyString(options.sharedKey, "sharedKey");
  const payload = options.payload;
  if (!payload || typeof payload !== "object") {
    throw new Error("payload is required");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${sharedKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const body = tryParseJson(text);
  if (!response.ok) {
    const detail = body?.error?.message || body?.message || text || `HTTP ${response.status}`;
    throw new Error(`Ingest publish failed (${response.status}): ${detail}`);
  }

  return body;
}

export function normalizeStorageOptions(storage = {}) {
  return {
    bucket: trimToNull(storage.bucket),
    prefix: normalizeRelativePath(storage.prefix || ""),
    baseUrl: normalizeBaseUrl(storage.baseUrl)
  };
}

export function collectOutputArtifacts(outputDir, storage = {}) {
  return listFilesRecursively(path.resolve(outputDir))
    .map((absolutePath) => toRelativePosixPath(outputDir, absolutePath))
    .sort((left, right) => left.localeCompare(right))
    .map((relativePath) => {
      const locator = createArtifactLocator(relativePath, storage);
      return {
        label: createArtifactLabel(relativePath),
        relativePath,
        href: relativePath,
        kind: "file",
        mediaType: inferMediaType(relativePath),
        storageKey: locator.storageKey,
        sourceUrl: locator.sourceUrl
      };
    });
}

function attachArtifactLocations(report, storage = {}) {
  const cloned = structuredClone(report);
  for (const packageEntry of Array.isArray(cloned?.packages) ? cloned.packages : []) {
    for (const suite of Array.isArray(packageEntry?.suites) ? packageEntry.suites : []) {
      for (const artifact of Array.isArray(suite?.rawArtifacts) ? suite.rawArtifacts : []) {
        if (!artifact?.relativePath) {
          continue;
        }
        const relativePath = path.posix.join("raw", normalizeRelativePath(artifact.relativePath));
        const locator = createArtifactLocator(relativePath, storage);
        artifact.storageKey = locator.storageKey;
        artifact.sourceUrl = locator.sourceUrl;
      }
    }
  }
  return cloned;
}

function buildGitHubSourceContext(options = {}) {
  const event = readGitHubEvent(process.env.GITHUB_EVENT_PATH);
  const serverUrl = trimToNull(process.env.GITHUB_SERVER_URL) || "https://github.com";
  const repository = trimToNull(process.env.GITHUB_REPOSITORY) || trimToNull(event?.repository?.full_name);
  const runId = trimToNull(process.env.GITHUB_RUN_ID);
  const runUrl = repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null;
  const branch = trimToNull(process.env.GITHUB_HEAD_REF)
    || trimToNull(event?.pull_request?.head?.ref)
    || (trimToNull(process.env.GITHUB_REF_TYPE) === "branch" ? trimToNull(process.env.GITHUB_REF_NAME) : null);
  const tag = trimToNull(process.env.GITHUB_REF_TYPE) === "tag" ? trimToNull(process.env.GITHUB_REF_NAME) : null;
  const startedAt = normalizeTimestamp(options.buildStartedAt) || new Date().toISOString();
  const completedAt = normalizeTimestamp(options.buildCompletedAt) || new Date().toISOString();

  return {
    provider: "github-actions",
    runId,
    runUrl,
    repository,
    repositoryUrl: repository ? `${serverUrl}/${repository}` : null,
    branch,
    tag,
    commitSha: trimToNull(process.env.GITHUB_SHA),
    actor: trimToNull(process.env.GITHUB_ACTOR),
    startedAt,
    completedAt,
    buildNumber: parseInteger(process.env.GITHUB_RUN_NUMBER),
    ci: {
      eventName: trimToNull(process.env.GITHUB_EVENT_NAME),
      workflow: trimToNull(process.env.GITHUB_WORKFLOW),
      workflowRef: trimToNull(process.env.GITHUB_WORKFLOW_REF),
      workflowSha: trimToNull(process.env.GITHUB_WORKFLOW_SHA),
      job: trimToNull(process.env.GITHUB_JOB),
      ref: trimToNull(process.env.GITHUB_REF),
      refName: trimToNull(process.env.GITHUB_REF_NAME),
      refType: trimToNull(process.env.GITHUB_REF_TYPE),
      runAttempt: parseInteger(process.env.GITHUB_RUN_ATTEMPT),
      repositoryOwner: trimToNull(process.env.GITHUB_REPOSITORY_OWNER),
      serverUrl,
      status: trimToNull(options.jobStatus),
      buildDurationMs: diffTimestamps(startedAt, completedAt),
      artifactCount: Number.isFinite(options.artifactCount) ? options.artifactCount : null,
      storage: {
        bucket: options.storage?.bucket || null,
        prefix: options.storage?.prefix || null,
        baseUrl: options.storage?.baseUrl || null
      }
    }
  };
}

function readGitHubEvent(eventPath) {
  if (!trimToNull(eventPath) || !fs.existsSync(eventPath)) {
    return {};
  }
  try {
    return readJson(eventPath);
  } catch {
    return {};
  }
}

function listFilesRecursively(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function countOutputFiles(outputDir) {
  if (!fs.existsSync(outputDir)) {
    return 0;
  }
  return listFilesRecursively(outputDir).length;
}

function createArtifactLocator(relativePath, storage = {}) {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const prefix = normalizeRelativePath(storage.prefix || "");
  const objectPath = prefix ? path.posix.join(prefix, normalizedRelativePath) : normalizedRelativePath;
  return {
    storageKey: storage.bucket ? `s3://${storage.bucket}/${objectPath}` : null,
    sourceUrl: storage.baseUrl ? new URL(objectPath, `${storage.baseUrl}/`).toString() : null
  };
}

function createArtifactLabel(relativePath) {
  switch (relativePath) {
    case "report.json":
      return "Normalized report";
    case "modules.json":
      return "Module rollup";
    case "ownership.json":
      return "Ownership rollup";
    case "index.html":
      return "HTML report";
    default:
      return path.posix.basename(relativePath);
  }
}

function inferMediaType(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  switch (extension) {
    case ".json":
      return "application/json";
    case ".html":
      return "text/html";
    case ".txt":
    case ".log":
    case ".out":
    case ".ndjson":
      return "text/plain";
    default:
      return null;
  }
}

function toRelativePosixPath(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

function normalizeRelativePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

function normalizeBaseUrl(value) {
  const trimmed = trimToNull(value);
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

function normalizeTimestamp(value) {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function diffTimestamps(startedAt, completedAt) {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) {
    return null;
  }
  return Math.max(0, completed - started);
}

function parseInteger(value) {
  const normalized = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(normalized) ? normalized : null;
}

function trimToNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function tryParseJson(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function requireNonEmptyString(value, name) {
  const normalized = trimToNull(value);
  if (!normalized) {
    throw new Error(`${name} is required`);
  }
  return normalized;
}
