/**
 * Standalone Cron Worker for Docker or Linux systemd service.
 * Run with: npx tsx scripts/cron-worker.ts
 */
import { runCron } from "../src/server/cron/engine";

console.log("=== ERAM TRACKER CRON WORKER STARTED ===");

async function tick() {
  console.log(`[${new Date().toISOString()}] Running cron cycle...`);
  const res = await runCron("all");
  console.log(`Result:`, JSON.stringify(res, null, 2));
}

// Initial run
tick().catch(console.error);

// Loop every 60 seconds
setInterval(() => {
  tick().catch(console.error);
}, 60 * 1000);
