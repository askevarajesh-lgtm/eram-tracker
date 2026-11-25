import { runCron } from "./engine";

let initialized = false;
let isRunning = false;
let lastMorningDate = "";
let lastEveningDate = "";

/**
 * Starts the internal in-process cron timer.
 * Runs minute checks every 60s, and daily checks at scheduled hours.
 */
export function startCronScheduler() {
  if (initialized) return;
  initialized = true;

  console.log("[CRON] In-process cron scheduler initialized.");

  // Run initial scan on startup (after 5 seconds delay so server finishes booting)
  setTimeout(async () => {
    try {
      console.log("[CRON] Running initial startup check...");
      await runCron("minute");
    } catch (e) {
      console.error("[CRON] Startup check error:", e);
    }
  }, 5000);

  // Setup periodic 60-second ticker
  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const now = new Date();
      const curDate = now.toISOString().slice(0, 10);
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // 1. Every minute check
      await runCron("minute");

      // 2. Morning daily run (at 08:30 AM or first time after 08:30)
      if (hours >= 8 && minutes >= 30 && lastMorningDate !== curDate) {
        lastMorningDate = curDate;
        console.log(`[CRON] Triggering morning daily job for ${curDate}`);
        await runCron("morning");
      }

      // 3. Evening standup check (at 17:00 or first time after 17:00)
      if (hours >= 17 && lastEveningDate !== curDate) {
        lastEveningDate = curDate;
        console.log(`[CRON] Triggering evening standup job for ${curDate}`);
        await runCron("evening");
      }
    } catch (err) {
      console.error("[CRON] Scheduler tick error:", err);
    } finally {
      isRunning = false;
    }
  }, 60 * 1000);
}
