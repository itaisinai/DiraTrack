import "dotenv/config";
import { claimNextResearchJob, closeDatabase, getDatabase, skipUnimplementedResearchJob } from "@diratrack/database";

const pollInterval = Number(process.env.RESEARCH_WORKER_POLL_INTERVAL_MS ?? 5000);
if (!Number.isFinite(pollInterval) || pollInterval < 1000) throw new Error("RESEARCH_WORKER_POLL_INTERVAL_MS must be at least 1000");
const workerId = `local-${process.pid}`;
const db = getDatabase();
let stopping = false;

console.log(`[research-worker] ${workerId} started; polling every ${pollInterval}ms`);

async function poll() {
  if (stopping) return;
  try {
    const job = await claimNextResearchJob(db, workerId);
    if (job) {
      const payload = job.payload as { sourceKey?: string };
      console.log(`[research-worker] ${payload.sourceKey ?? "unknown-source"} has no adapter yet; skipping safely`);
      await skipUnimplementedResearchJob(db, job);
    }
  } catch (error) {
    console.error("[research-worker] poll failed", error);
  } finally {
    if (!stopping) setTimeout(poll, pollInterval);
  }
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[research-worker] received ${signal}; shutting down`);
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
void poll();
