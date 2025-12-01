const asyncHandler = require('../middleware/async');
const {
  enqueueSearchJob,
  enqueueDownloadJob,
  enqueueWarmupJob,
} = require('../queues/zlibraryQueue');

const ZLIBRARY_WORKER_URL =
  process.env.ZLIBRARY_PROXY_URL || 'https://zlibrary-proxy.alphy-flibusta.workers.dev';

const encodeForWorker = (url) => {
  if (!url) return null;
  return Buffer.from(url, 'utf8').toString('base64url');
};

const mapQueueError = (error) => {
  if (!error) {
    return { message: 'Unknown worker error' };
  }

  if (typeof error.message === 'string') {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object') {
        return {
          message: parsed.message || 'Worker error',
          code: parsed.code,
          details: parsed.details,
        };
      }
    } catch {
      // Message was not JSON – fall through.
    }
  }

  return {
    message: error.message || 'Worker error',
    code: error.code,
  };
};

const statusFromQueueError = (code) => {
  switch (code) {
    case 'ZLIB_DAILY_LIMIT':
      return 429;
    case 'QUEUE_WAIT_TIMEOUT':
      return 504;
    case 'ECONNREFUSED':
    case 'EAI_AGAIN':
    case 'ECONNRESET':
      return 503;
    default:
      return 500;
  }
};

exports.searchZLibrary = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a search query',
    });
  }

  try {
    const results = await enqueueSearchJob(query);

    const formatted = results.map((item) => ({
      id: item.id,
      title: item.title,
      author: item.author,
      language: item.language,
      year: item.year,
      cover: item.cover,
      size: item.filesize,
      source: 'zlibrary',
      formats: [
        {
          id: `${item.downloadId}-${item.extension || 'file'}`,
          format: (item.extension || '').toUpperCase() || 'EPUB',
          size: item.filesize,
          language: item.language,
          source: 'zlibrary',
          token: item.downloadToken,
          downloadPath: item.downloadPath,
        },
      ],
    }));

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    const mappedError = mapQueueError(error);
    console.error('Z-Library search queue error:', error);

    const status = statusFromQueueError(mappedError.code);

    res.status(status).json({
      success: false,
      error: mappedError.message || 'Failed to search Z-Library',
      code: mappedError.code,
      details: mappedError.details,
    });
  }
});

exports.getZLibraryDownloadLink = asyncHandler(async (req, res) => {
  const { bookId, token } = req.params;

  if (!bookId || !token) {
    return res.status(400).json({
      success: false,
      error: 'Book ID and token are required',
    });
  }

  const sanitizedId = bookId.replace(/[^a-zA-Z0-9_-]/g, '');
  const sanitizedToken = token.replace(/[^a-zA-Z0-9_-]/g, '');
  const downloadPath = `/dl/${sanitizedId}/${sanitizedToken}`;

  try {
    const { location, filename, expiresAt } = await enqueueDownloadJob(downloadPath);
    if (!location) {
      return res.status(500).json({
        success: false,
        error: 'Unable to resolve download link',
      });
    }

    if (!ZLIBRARY_WORKER_URL) {
      return res.status(500).json({
        success: false,
        error: 'ZLIBRARY_PROXY_URL is not configured',
      });
    }

    const encodedTarget = encodeForWorker(location);
    const workerUrl = `${ZLIBRARY_WORKER_URL.replace(/\/$/, '')}/download/${encodedTarget}`;

    res.json({
      success: true,
      data: {
        downloadUrl: workerUrl,
        filename,
        expiresAt,
        originalUrl: location,
      },
    });
  } catch (error) {
    const mappedError = mapQueueError(error);
    console.error('Z-Library download link queue error:', error);
    if (mappedError.code === 'ZLIB_DAILY_LIMIT') {
      return res.status(429).json({
        success: false,
        error: mappedError.message || 'Z-Library daily limit reached. Please try again later.',
        code: 'ZLIB_DAILY_LIMIT',
        details: mappedError.details,
      });
    }

    const status = statusFromQueueError(mappedError.code);
    res.status(status).json({
      success: false,
      error: mappedError.message || 'Failed to create download link',
      code: mappedError.code,
      details: mappedError.details,
    });
  }
});

exports.warmupZLibrary = asyncHandler(async (req, res) => {
  try {
    const payload = await enqueueWarmupJob();
    res.json({ success: true, message: 'Z-Library session ready', data: payload });
  } catch (error) {
    const mappedError = mapQueueError(error);
    console.error('Z-Library warmup queue error:', error);
    const status = statusFromQueueError(mappedError.code);
    res.status(status).json({
      success: false,
      error: mappedError.message || 'Failed to warm up Z-Library session',
      code: mappedError.code,
      details: mappedError.details,
    });
  }
});


