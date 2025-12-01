require('dotenv').config();

const express = require('express');

// Start the BullMQ worker logic in the same process.
require('./zlibraryWorker');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    worker: process.env.WORKER_NAME || 'zlibrary-worker',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Z-Library worker service online',
    worker: process.env.WORKER_NAME || 'zlibrary-worker',
  });
});

app.listen(PORT, () => {
  console.log(`[${process.env.WORKER_NAME || 'zlibrary-worker'}] Health server listening on port ${PORT}`);
});


