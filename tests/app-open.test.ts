import test from "node:test";
import assert from "node:assert/strict";
import { detectDevice, STORE_URLS } from "../lib/app-open";

test("platform routing keeps iPadOS on iOS and desktop on the site", () => {
  assert.equal(detectDevice("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5), "android");
  assert.equal(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", "iPhone", 5), "ios");
  assert.equal(detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 5), "ios");
  assert.equal(detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 0), "other");
  assert.equal(detectDevice("unknown", "unknown", 0), "other");
  assert.equal(STORE_URLS.ios, "https://apps.apple.com/app/id6761245973");
  assert.equal(STORE_URLS.android, "https://play.google.com/store/apps/details?id=sa.alansar");
});
