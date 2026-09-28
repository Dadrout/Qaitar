import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: {
    // The CLI child process can lose captured stdout in restricted build
    // environments. The TypeScript compiler API performs the same check
    // without that process boundary.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
