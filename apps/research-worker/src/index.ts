import "dotenv/config";

const pollInterval = Number(process.env.RESEARCH_WORKER_POLL_INTERVAL_MS ?? 5000);
if (!Number.isFinite(pollInterval) || pollInterval < 1000) throw new Error("RESEARCH_WORKER_POLL_INTERVAL_MS must be at least 1000");
console.log(`[research-worker] started; polling every ${pollInterval}ms`);
const interval = setInterval(() => console.log("[research-worker] waiting for jobs"), pollInterval);
function shutdown(signal: string) { console.log(`[research-worker] received ${signal}; shutting down`); clearInterval(interval); process.exit(0); }
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
