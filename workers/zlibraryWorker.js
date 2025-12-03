require('dotenv').config();

const { Worker, QueueEvents } = require('bullmq');
const { buildBullmqBaseOptions, queueNames } = require('../config/queue');
const { JOB_NAMES } = require('../queues/zlibraryJobNames');
const ZLibraryService = require('../services/zlibrary/ZLibraryService');

const SERVICE_NAME = process.env.WORKER_NAME || `zlibrary-worker-${process.pid}`;
const baseOptions = buildBullmqBaseOptions();

function serializeWorkerError(error) {
  if (!(error instanceof Error)) {
    return new Error(String(error || 'Worker error'));
  }
  try {
    const payload = {
      message: error.message,
      code: error.code,
      details: error.details,
      name: error.name,
    };
    const wrapped = new Error(JSON.stringify(payload));
    wrapped.name = error.code || error.name || 'WorkerError';
    return wrapped;
  } catch {
    return error;
  }
}

async function handleJob(job) {
  try {
    switch (job.name) {
      case JOB_NAMES.SEARCH: {
        const query = typeof job.data?.query === 'string' ? job.data.query.trim() : '';
        if (!query) {
          throw new Error('Search query is required');
        }
        return ZLibraryService.searchBooks(query);
      }
      case JOB_NAMES.DOWNLOAD: {
        const downloadPath = job.data?.downloadPath;
        if (!downloadPath) {
          throw new Error('Download path is required');
        }
        return ZLibraryService.resolveDownload(downloadPath);
      }
      case JOB_NAMES.WARMUP: {
        await ZLibraryService.warmup();
        return { success: true, warmedAt: new Date().toISOString() };
      }
      case JOB_NAMES.RESET: {
        await ZLibraryService.resetBrowser();
        return { success: true, resetAt: new Date().toISOString() };
      }
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  } catch (error) {
    // On critical navigation/browser errors, reset the browser for next job
    const msg = error?.message || '';
    if (
      msg.includes('Navigation timeout') ||
      msg.includes('net::ERR_') ||
      msg.includes('Protocol error') ||
      msg.includes('Target closed') ||
      msg.includes('Session closed') ||
      msg.includes('browser has disconnected')
    ) {
      console.warn(`[${SERVICE_NAME}] Critical browser error detected, resetting browser...`);
      await ZLibraryService.resetBrowser().catch((e) =>
        console.error(`[${SERVICE_NAME}] Failed to reset browser:`, e.message)
      );
    }
    throw serializeWorkerError(error);
  }
}

async function startWorker() {
  const queueEvents = new QueueEvents(queueNames.zlibrary, baseOptions);
  queueEvents.on('error', (err) => {
    console.error(`[${SERVICE_NAME}] QueueEvents error:`, err);
  });
  await queueEvents.waitUntilReady();
  console.log(`[${SERVICE_NAME}] Queue events ready for ${queueNames.zlibrary}`);

  const worker = new Worker(queueNames.zlibrary, handleJob, {
    ...baseOptions,
    concurrency: 1,
  });

  worker.on('ready', () => {
    console.log(`[${SERVICE_NAME}] Worker ready and waiting for jobs`);
  });

  worker.on('completed', (job) => {
    console.log(`[${SERVICE_NAME}] Job completed`, { jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, err) => {
    console.error(`[${SERVICE_NAME}] Job failed`, {
      jobId: job?.id,
      name: job?.name,
      error: err?.message,
    });
  });

  const shutdown = async (signal) => {
    console.log(`[${SERVICE_NAME}] Shutting down due to ${signal}`);
    await worker.close();
    await queueEvents.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startWorker().catch((err) => {
  console.error(`[${SERVICE_NAME}] Failed to start worker`, err);
  process.exit(1);
});


