import { config } from "dotenv";
import type { NextConfig } from "next";

config({ path: new URL("../../.env", import.meta.url), quiet: true });

const nextConfig: NextConfig = {transpilePackages: ["@diratrack/database", "@diratrack/domain", "@diratrack/shared-ui", "@diratrack/source-adapters"]};
export default nextConfig;
