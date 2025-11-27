const asyncHandler = require('../middleware/async');
const ZLibraryService = require('../services/zlibrary/ZLibraryService');

const ZLIBRARY_WORKER_URL =
  process.env.ZLIBRARY_PROXY_URL || 'https://zlibrary-proxy.alphy-flibusta.workers.dev';

const encodeForWorker = (url) => {
  if (!url) return null;
  return Buffer.from(url, 'utf8').toString('base64url');
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
    const results = await ZLibraryService.searchBooks(query);

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
    console.error('Z-Library search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search Z-Library',
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
    const { location, filename, expiresAt } = await ZLibraryService.resolveDownload(downloadPath);
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
    console.error('Z-Library download link error:', error);
    if (error.code === 'ZLIB_DAILY_LIMIT') {
      return res.status(429).json({
        success: false,
        error: error.message || 'Z-Library daily limit reached. Please try again later.',
        code: 'ZLIB_DAILY_LIMIT',
        details: error.details,
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create download link',
    });
  }
});

exports.warmupZLibrary = asyncHandler(async (req, res) => {
  try {
    await ZLibraryService.warmup();
    res.json({ success: true, message: 'Z-Library session ready' });
  } catch (error) {
    console.error('Z-Library warmup error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to warm up Z-Library session',
    });
  }
});


