const asyncHandler = require('../middleware/async');
const liber3Service = require('../services/liber3/Liber3Service');

// @desc    Search Liber3 (IPFS-backed) catalog
// @route   GET /api/books/liber3/search
// @access  Public
exports.searchLiber3 = asyncHandler(async (req, res) => {
  const query = (req.query.query || req.query.q || '').toString().trim();
  if (!query) {
    return res.status(400).json({ success: false, message: 'Query is required' });
  }

  try {
    const results = await liber3Service.search(query);
    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error('Liber3 search failed:', error.message);
    res.status(502).json({
      success: false,
      message: 'Failed to search Liber3',
      error: error.message,
    });
  }
});

