import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Grok Voice relay uses ws through @vercel/functions upgradeWebSocket().
  serverExternalPackages: ["ws"],
};

export default nextConfig;
