export type Device = "android" | "ios" | "other";

export const STORE_URLS = {
  ios: "https://apps.apple.com/app/id6761245973",
  android: "https://play.google.com/store/apps/details?id=sa.alansar",
} as const;

export function detectDevice(userAgent: string, platform: string, maxTouchPoints: number): Device {
  if (/android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (platform === "MacIntel" && maxTouchPoints > 1) return "ios";
  return "other";
}

// Android: Chrome opens the installed app, or follows the fallback to Play when it is missing.
// iOS: custom scheme only; the page falls back to the App Store when the app does not take over.
export function appLaunchUrl(device: Exclude<Device, "other">): string {
  if (device === "android") {
    return `intent://open#Intent;scheme=alansar;package=sa.alansar;S.browser_fallback_url=${encodeURIComponent(STORE_URLS.android)};end`;
  }
  return "alansar://open";
}

// Product pages: opens /products/{id} in the installed app, or Google Play when the app is missing.
export function androidProductIntentUrl(productId: string): string {
  return `intent://products/${productId}#Intent;scheme=alansar;package=sa.alansar;S.browser_fallback_url=${encodeURIComponent(STORE_URLS.android)};end`;
}

// Home-page download section: the visitor's own store, or both before detection runs and on desktop.
export function storeBadgesFor(device: Device | null): Exclude<Device, "other">[] {
  return device === "ios" || device === "android" ? [device] : ["ios", "android"];
}

// Match pages (used once the phase-B app release is live, spec 2026-10-12 web-match-tickets):
// opens /matches/{id} in the installed app, or Google Play when the app is missing.
export function androidMatchIntentUrl(matchId: string): string {
  return `intent://matches/${matchId}#Intent;scheme=alansar;package=sa.alansar;S.browser_fallback_url=${encodeURIComponent(STORE_URLS.android)};end`;
}
