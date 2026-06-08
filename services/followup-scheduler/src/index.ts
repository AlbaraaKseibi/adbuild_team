import cron from 'node-cron';
import { config } from './config.js';
import { runSweep } from './scheduler.js';

console.log(
  `[followup-scheduler] starting — cron="${config.FOLLOWUP_CRON}", idle=${config.FOLLOWUP_IDLE_HOURS}h, statuses=${config.statuses.join(',')}`,
);

if (!cron.validate(config.FOLLOWUP_CRON)) {
  console.error(`[followup-scheduler] invalid cron expression: ${config.FOLLOWUP_CRON}`);
  process.exit(1);
}

let running = false;
async function tick() {
  if (running) {
    console.log('[followup-scheduler] previous sweep still running — skipping this tick');
    return;
  }
  running = true;
  try {
    await runSweep();
  } catch (err) {
    console.error('[followup-scheduler] sweep error', err);
  } finally {
    running = false;
  }
}

cron.schedule(config.FOLLOWUP_CRON, tick);

if (config.FOLLOWUP_RUN_ON_BOOT) {
  void tick();
}
