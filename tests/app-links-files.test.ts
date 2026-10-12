import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve("scripts/generate-app-links.mjs");
const fingerprint = Array(32).fill("AA").join(":");

test("association generator scopes this app to /open", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ansar-links-"));
  try {
    const env = { ...process.env, ANSAR_APPLE_TEAM_ID: "ABCDE12345", ANSAR_PLAY_SHA256: fingerprint };
    const result = spawnSync(process.execPath, [script], { cwd, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const dir = join(cwd, "public/.well-known");
    const apple = JSON.parse(readFileSync(join(dir, "apple-app-site-association"), "utf8"));
    const android = JSON.parse(readFileSync(join(dir, "assetlinks.json"), "utf8"));
    assert.deepEqual(apple.applinks.details, [{ appID: "ABCDE12345.com.alansar", paths: ["/open"] }]);
    assert.equal(android[0].target.package_name, "sa.alansar");
    assert.deepEqual(android[0].target.sha256_cert_fingerprints, [fingerprint]);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("invalid identifiers never create an association file", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ansar-links-"));
  try {
    const result = spawnSync(process.execPath, [script], {
      cwd, env: { ...process.env, ANSAR_APPLE_TEAM_ID: "invalid", ANSAR_PLAY_SHA256: fingerprint }, encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(join(cwd, "public/.well-known/assetlinks.json")), false);
    assert.equal(existsSync(join(cwd, "public/.well-known/apple-app-site-association")), false);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
