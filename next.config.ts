import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@google-cloud/storage", "ffmpeg-static", "sharp"],
};

export default nextConfig;
