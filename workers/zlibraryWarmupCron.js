require('dotenv').config();

const { enqueueWarmupJob } = require('../queues/zlibraryQueue');

async function runWarmup() {
  try {
    const result = await enqueueWarmupJob();
    console.log('[zlibrary-cron] Warmup dispatched', result);
    process.exit(0);
  } catch (error) {
    console.error('[zlibrary-cron] Failed to dispatch warmup job', error);
    process.exit(1);
  }
}

runWarmup();


