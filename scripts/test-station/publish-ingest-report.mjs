#!/usr/bin/env node

import {
  createIngestPayload,
  normalizeStorageOptions,
  publishIngestPayload
} from "./ingest-report-utils.mjs";

async function main() {
  const reportPath = process.env.TEST_STATION_INGEST_INPUT || "./.test-results/test-station/report.json";
  const endpoint = process.env.TEST_STATION_INGEST_ENDPOINT || "https://test-station.smysnk.com/api/ingest";
  const projectKey = process.env.TEST_STATION_INGEST_PROJECT_KEY || "react-retro-display-tty-ansi";
  const sharedKey = process.env.TEST_STATION_INGEST_SHARED_KEY || "";
  const requireSharedKey = isTruthy(process.env.TEST_STATION_INGEST_REQUIRE_SHARED_KEY || "");

  if (!sharedKey.trim()) {
    if (requireSharedKey) {
      throw new Error("TEST_STATION_INGEST_SHARED_KEY is required for this run but is not configured.");
    }
    process.stdout.write("Skipping test-station ingest: no shared key provided.\n");
    return;
  }

  const payload = createIngestPayload({
    reportPath,
    projectKey,
    buildStartedAt: process.env.TEST_STATION_BUILD_STARTED_AT,
    buildCompletedAt: process.env.TEST_STATION_BUILD_COMPLETED_AT,
    jobStatus: process.env.TEST_STATION_CI_STATUS,
    storage: normalizeStorageOptions({
      bucket: process.env.S3_BUCKET,
      prefix: process.env.S3_STORAGE_PREFIX,
      baseUrl: process.env.S3_PUBLIC_URL
    })
  });

  const response = await publishIngestPayload({
    endpoint,
    sharedKey,
    payload
  });

  process.stdout.write(`Published ${payload.projectKey}:${payload.source.provider}:${payload.source.runId || "manual"} to ${endpoint}\n`);
  if (response?.runId) {
    process.stdout.write(`runId=${response.runId}\n`);
  }
}

function isTruthy(value) {
  return String(value || "").trim().toLowerCase() === "1"
    || String(value || "").trim().toLowerCase() === "true"
    || String(value || "").trim().toLowerCase() === "yes"
    || String(value || "").trim().toLowerCase() === "on";
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
