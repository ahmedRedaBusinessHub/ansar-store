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
