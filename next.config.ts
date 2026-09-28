import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" }
    ] }];
  }
};
export default config;
