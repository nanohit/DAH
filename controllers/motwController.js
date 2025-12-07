const asyncHandler = require('../middleware/async');
const motwService = require('../services/motw/MemoryOfTheWorldService');

// @desc    Search Memory of the World library
// @route   GET /api/books/motw/search
// @access  Public
exports.searchMotw = asyncHandler(async (req, res) => {
  const query = (req.query.query || req.query.q || '').toString().trim();
  const field = (req.query.field || 'title').toString().trim() || 'title';

  if (!query) {
    return res.status(400).json({ success: false, message: 'Query is required' });
  }

  const results = await motwService.search(query, field);
  res.json({
    success: true,
    count: results.length,
    data: results,
  });
});

