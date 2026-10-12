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
