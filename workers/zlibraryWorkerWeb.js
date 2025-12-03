require('dotenv').config();

const express = require('express');
const ZLibraryService = require('../services/zlibrary/ZLibraryService');

// Start the BullMQ worker logic in the same process.
require('./zlibraryWorker');

const app = express();
const PORT = process.env.PORT || 10000;
const WORKER_NAME = process.env.WORKER_NAME || 'zlibrary-worker';

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    worker: WORKER_NAME,
    consecutiveFailures: ZLibraryService.consecutiveFailures || 0,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Z-Library worker service online',
    worker: WORKER_NAME,
  });
});

// Force browser reset endpoint
app.post('/reset', async (req, res) => {
  try {
    console.log(`[${WORKER_NAME}] Manual browser reset triggered via /reset endpoint`);
    await ZLibraryService.resetBrowser();
    res.json({ success: true, message: 'Browser reset complete', worker: WORKER_NAME });
  } catch (error) {
    console.error(`[${WORKER_NAME}] Reset failed:`, error.message);
    res.status(500).json({ success: false, error: error.message, worker: WORKER_NAME });
  }
});

// Also support GET for easier testing
app.get('/reset', async (req, res) => {
  try {
    console.log(`[${WORKER_NAME}] Manual browser reset triggered via GET /reset endpoint`);
    await ZLibraryService.resetBrowser();
    res.json({ success: true, message: 'Browser reset complete', worker: WORKER_NAME });
  } catch (error) {
    console.error(`[${WORKER_NAME}] Reset failed:`, error.message);
    res.status(500).json({ success: false, error: error.message, worker: WORKER_NAME });
  }
});

app.listen(PORT, () => {
  console.log(`[${WORKER_NAME}] Health server listening on port ${PORT}`);
});


