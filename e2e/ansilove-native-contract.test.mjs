import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  ansiloveJsVendorPath,
  oracleLockPath
} from "../scripts/ansilove/oracle-paths.mjs";
import { runNativeAnsilove } from "../scripts/ansilove/native-oracle.mjs";

const encoder = new TextEncoder();
const ansiBytes = encoder.encode("\u001b[31;44mA\u001b[0mB");

const createSauceFixture = ({ columns = 10, rows = 2, flags = 13 } = {}) => {
  const payload = encoder.encode("\u001b[31mSAUCE");
  const record = Buffer.alloc(128, 0x20);
  record.write("SAUCE00", 0, "ascii");
  record.write("Oracle fixture", 7, "ascii");
  record.write("Codex", 42, "ascii");
  record.write("React Retro", 62, "ascii");
  record.write("20260717", 82, "ascii");
  record.writeUInt32LE(payload.length, 90);
  record[94] = 1;
  record[95] = 1;
  record.writeUInt16LE(columns, 96);
  record.writeUInt16LE(rows, 98);
  record[104] = 0;
  record[105] = flags;
  record.write("IBM VGA", 106, "ascii");

  return Buffer.concat([payload, Buffer.from([0x1a]), record]);
};

test("vendored Ansilove.js matches the pinned source hash", async () => {
  const lock = JSON.parse(await readFile(oracleLockPath, "utf8"));
  const hash = createHash("sha256")
    .update(await readFile(ansiloveJsVendorPath))
    .digest("hex");

  assert.equal(hash, lock.ansiloveJs.sha256);
});

test("native oracle honors explicit ANSI geometry and normalizes indexed PNG to RGBA", async () => {
  const result = await runNativeAnsilove({
    bytes: ansiBytes,
    args: ["-t", "ans", "-c", "4", "-f", "80x25", "-b", "8"]
  });

  assert.equal(result.code, 0);
  assert.equal(result.rgba?.width, 32);
  assert.equal(result.rgba?.height, 16);
  assert.equal(result.rgba?.data.length, 32 * 16 * 4);
  assert.equal(result.rgba?.source.colorType, 3);
  assert.equal(result.rgba?.source.bitDepth, 4);
  assert.ok(new Set(result.rgba?.data).size > 2);
});

test("native oracle applies 9-bit width and unknown-suffix ANSI fallback", async () => {
  const result = await runNativeAnsilove({
    bytes: ansiBytes,
    extension: "asc",
    args: ["-c", "4", "-f", "80x25", "-b", "9"]
  });

  assert.equal(result.code, 0);
  assert.equal(result.rgba?.width, 36);
  assert.match(result.stdout, /Bits: 9/);
  assert.match(result.stdout, /Columns: 4/);
});

test("native CLI contract maps SAUCE width, iCE, 9-bit, DOS, and font hints", async () => {
  const result = await runNativeAnsilove({
    bytes: createSauceFixture(),
    args: ["-S"]
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /SAUCE info used for rendering hints/);
  assert.match(result.stdout, /iCE Colors: enabled/);
  assert.match(result.stdout, /Font: 80x25/);
  assert.match(result.stdout, /Bits: 9/);
  assert.match(result.stdout, /Columns: 10/);
  assert.equal(result.rgba?.width, 90);
  assert.ok((result.rgba?.height ?? 0) > 16);
});

test("native CLI failures retain actionable diagnostics", async () => {
  const result = await runNativeAnsilove({
    bytes: ansiBytes,
    args: ["-b", "7"],
    allowFailure: true
  });

  assert.notEqual(result.code, 0);
  assert.match(`${result.stdout}${result.stderr}`, /bits.*8 or 9/i);
  assert.equal(result.png, null);
});
