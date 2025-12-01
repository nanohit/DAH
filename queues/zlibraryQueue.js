const { Queue, QueueEvents } = require('bullmq');
const { buildBullmqBaseOptions, queueNames } = require('../config/queue');
const { JOB_NAMES } = require('./zlibraryJobNames');

const DEFAULT_SEARCH_TIMEOUT =
  Number(process.env.ZLIBRARY_SEARCH_JOB_TIMEOUT_MS || process.env.ZLIBRARY_JOB_TIMEOUT_MS) || 90_000;
const DEFAULT_DOWNLOAD_TIMEOUT =
  Number(process.env.ZLIBRARY_DOWNLOAD_JOB_TIMEOUT_MS || process.env.ZLIBRARY_JOB_TIMEOUT_MS) || 120_000;
const DEFAULT_WARMUP_TIMEOUT =
  Number(process.env.ZLIBRARY_WARMUP_JOB_TIMEOUT_MS || process.env.ZLIBRARY_JOB_TIMEOUT_MS) || 60_000;

let queueInstance = null;
let queueEventsInstance = null;
let queueEventsReadyPromise = null;

function getQueue() {
  if (!queueInstance) {
    const baseOptions = buildBullmqBaseOptions();
    queueInstance = new Queue(queueNames.zlibrary, {
      ...baseOptions,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600,
          count: 200,
        },
        removeOnFail: {
          age: 24 * 3600,
          count: 500,
        },
        attempts: 1,
      },
    });
  }
  return queueInstance;
}

function getQueueEvents() {
  if (!queueEventsInstance) {
    const baseOptions = buildBullmqBaseOptions();
    queueEventsInstance = new QueueEvents(queueNames.zlibrary, baseOptions);
    queueEventsInstance.on('error', (err) => {
      console.error('[ZLIBRARY QUEUE] QueueEvents error:', err);
    });
    queueEventsReadyPromise = queueEventsInstance.waitUntilReady();
  }
  return queueEventsInstance;
}

async function waitForQueueEventsReady() {
  if (!queueEventsReadyPromise) {
    getQueueEvents();
  }
  return queueEventsReadyPromise;
}

async function addJobAndWait(jobName, data, { timeout, waitTimeout } = {}) {
  const queue = getQueue();
  const queueEvents = getQueueEvents();
  await waitForQueueEventsReady();

  const job = await queue.add(jobName, data, {
    removeOnComplete: {
      age: 3600,
      count: 200,
    },
    removeOnFail: {
      age: 24 * 3600,
      count: 500,
    },
    attempts: 1,
    timeout,
  });

  const effectiveWaitTimeout = waitTimeout || Math.max(timeout || 60_000, 30_000);
  try {
    return await job.waitUntilFinished(queueEvents, effectiveWaitTimeout);
  } catch (error) {
    if (error && typeof error.message === 'string' && error.message.includes('timed out')) {
      error.code = 'QUEUE_WAIT_TIMEOUT';
    }
    throw error;
  }
}

async function enqueueSearchJob(query) {
  return addJobAndWait(
    JOB_NAMES.SEARCH,
    { query: typeof query === 'string' ? query.trim() : '' },
    {
      timeout: DEFAULT_SEARCH_TIMEOUT,
      waitTimeout: DEFAULT_SEARCH_TIMEOUT + 10_000,
    }
  );
}

async function enqueueDownloadJob(downloadPath) {
  return addJobAndWait(
    JOB_NAMES.DOWNLOAD,
    { downloadPath },
    {
      timeout: DEFAULT_DOWNLOAD_TIMEOUT,
      waitTimeout: DEFAULT_DOWNLOAD_TIMEOUT + 10_000,
    }
  );
}

async function enqueueWarmupJob() {
  return addJobAndWait(
    JOB_NAMES.WARMUP,
    {},
    {
      timeout: DEFAULT_WARMUP_TIMEOUT,
      waitTimeout: DEFAULT_WARMUP_TIMEOUT + 5_000,
    }
  );
}

module.exports = {
  enqueueSearchJob,
  enqueueDownloadJob,
  enqueueWarmupJob,
  JOB_NAMES,
};


