import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emite dist/standalone/server.js -- servidor Node para container/EasyPanel.
  output: "standalone",
};

export default nextConfig;
