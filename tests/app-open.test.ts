import test from "node:test";
import assert from "node:assert/strict";
import { appLaunchUrl, detectDevice, STORE_URLS } from "../lib/app-open";

test("platform routing keeps iPadOS on iOS and desktop on the site", () => {
  assert.equal(detectDevice("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5), "android");
  assert.equal(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", "iPhone", 5), "ios");
  assert.equal(detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 5), "ios");
  assert.equal(detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 0), "other");
  assert.equal(detectDevice("unknown", "unknown", 0), "other");
  assert.equal(STORE_URLS.ios, "https://apps.apple.com/app/id6761245973");
  assert.equal(STORE_URLS.android, "https://play.google.com/store/apps/details?id=sa.alansar");
});

test("launch URLs open the app and fall back to the store", () => {
  assert.equal(
    appLaunchUrl("android"),
    "intent://open#Intent;scheme=alansar;package=sa.alansar;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dsa.alansar;end",
  );
  assert.equal(appLaunchUrl("ios"), "alansar://open");
});
