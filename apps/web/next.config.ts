import type { NextConfig } from "next";

const nextConfig: NextConfig = {transpilePackages: ["@diratrack/database", "@diratrack/domain", "@diratrack/shared-ui"]};
export default nextConfig;
