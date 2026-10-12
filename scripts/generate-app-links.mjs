import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const teamId = process.env.ANSAR_APPLE_TEAM_ID?.trim();
const fingerprint = process.env.ANSAR_PLAY_SHA256?.trim().toUpperCase();
if (!/^[A-Z0-9]{10}$/.test(teamId ?? "")) throw new Error("Invalid ANSAR_APPLE_TEAM_ID");
if (!/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint ?? "")) throw new Error("Invalid ANSAR_PLAY_SHA256");

const dir = resolve("public/.well-known");
await mkdir(dir, { recursive: true });
const apple = { applinks: { apps: [], details: [{ appID: `${teamId}.com.alansar`, paths: ["/open"] }] } };
const android = [{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: { namespace: "android_app", package_name: "sa.alansar", sha256_cert_fingerprints: [fingerprint] },
}];
await writeFile(resolve(dir, "apple-app-site-association"), `${JSON.stringify(apple)}\n`, "utf8");
await writeFile(resolve(dir, "assetlinks.json"), `${JSON.stringify(android)}\n`, "utf8");
