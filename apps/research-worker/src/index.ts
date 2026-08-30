import "dotenv/config";
import { claimNextResearchJob, closeDatabase, completeResearchJob, failResearchJob, getDatabase, getResearchContext, skipUnimplementedResearchJob } from "@diratrack/database";
import { getSourceAdapter } from "@diratrack/source-adapters";

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
      const sourceKey = payload.sourceKey ?? "unknown-source";
      const adapter = getSourceAdapter(sourceKey);
      if (!adapter) {
        console.log(`[research-worker] ${sourceKey} has no adapter yet; skipping safely`);
        await skipUnimplementedResearchJob(db, job);
      } else {
        console.log(`[research-worker] searching ${sourceKey}`);
        try {
          const context = await getResearchContext(db, job.projectId);
          if (!context) throw new Error("Project not found for research job");
          const discoveries = await adapter.discover(context);
          await completeResearchJob(db, job, discoveries);
          console.log(`[research-worker] ${sourceKey} completed with ${discoveries.length} result(s)`);
        } catch (error) {
          console.error(`[research-worker] ${sourceKey} failed`, error);
          await failResearchJob(db, job, error);
        }
      }
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
