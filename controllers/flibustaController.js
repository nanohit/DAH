const FlibustaService = require('../services/flibusta/FlibustaService');
const VKStorageService = require('../services/vk/VKStorageService');
const Book = require('../models/Book');
const asyncHandler = require('../middleware/async.js');

const flibustaService = new FlibustaService();
const vkStorage = new VKStorageService();

// @desc    Request download links from Flibusta
// @route   POST /api/books/:id/request-download-links
// @access  Private
exports.requestDownloadLinks = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  
  if (!book) {
    return res.status(404).json({ message: 'Book not found' });
  }

  try {
    // Update status to checking
    book.flibustaStatus = 'checking';
    await book.save();

    // Search for book variants
    const searchResults = await flibustaService.searchBooks(book.title);

    if (searchResults.length === 0) {
      book.flibustaStatus = 'not_found';
      book.flibustaLastChecked = new Date();
      await book.save();
      return res.status(404).json({ 
        message: 'No variants found on Flibusta',
        note: 'Try searching with the Russian title if available'
      });
    }

    // Map results to our schema format
    const variants = searchResults.map(result => ({
      title: result.title,
      author: result.author.name,
      formats: result.formats,
      sourceId: result.id
    }));

    // Store variants in the book document
    book.flibustaVariants = variants;
    book.flibustaStatus = 'found';
    book.flibustaLastChecked = new Date();
    await book.save();

    res.json({
      message: 'Book variants found',
      variants,
      note: 'Please verify the correct variant as titles might be in Russian'
    });
  } catch (error) {
    // Reset status on error
    book.flibustaStatus = 'not_checked';
    await book.save();

    // Provide more specific error message for connection issues
    if (error.message.includes('Failed to connect to Flibusta')) {
      return res.status(503).json({ 
        message: error.message,
        note: 'This might be a temporary connection issue or region restriction'
      });
    }

    throw error;
  }
});

// @desc    Get available variants for a book
// @route   GET /api/books/:id/download-variants
// @access  Private
exports.getDownloadVariants = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  
  if (!book) {
    return res.status(404).json({ message: 'Book not found' });
  }

  if (book.flibustaStatus === 'not_checked') {
    return res.status(400).json({ message: 'Download links not yet requested' });
  }

  if (book.flibustaStatus === 'checking') {
    return res.status(202).json({ message: 'Still checking for variants' });
  }

  if (book.flibustaStatus === 'not_found') {
    return res.status(404).json({ message: 'No variants found on Flibusta' });
  }

  // Check VK documents status if they exist
  if (book.vkDocuments && book.vkDocuments.length > 0) {
    for (const doc of book.vkDocuments) {
      if (doc.status === 'active' && Date.now() - doc.lastChecked > 24 * 60 * 60 * 1000) {
        // Check if document still exists in VK if not checked in last 24 hours
        const exists = await vkStorage.checkDocument(doc.ownerId, doc.docId);
        doc.status = exists ? 'active' : 'deleted';
        doc.lastChecked = new Date();
      }
    }
    await book.save();
  }

  res.json({
    status: book.flibustaStatus,
    lastChecked: book.flibustaLastChecked,
    variants: book.flibustaVariants,
    vkDocuments: book.vkDocuments?.filter(doc => doc.status === 'active') || []
  });
});

// @desc    Select variant and upload to VK
// @route   POST /api/books/:id/select-variant
// @access  Private
exports.selectVariant = asyncHandler(async (req, res) => {
  const { variantIndex, formats } = req.body;
  
  if (typeof variantIndex !== 'number' || !Array.isArray(formats)) {
    return res.status(400).json({ message: 'Invalid request body' });
  }

  const book = await Book.findById(req.params.id);
  
  if (!book) {
    return res.status(404).json({ message: 'Book not found' });
  }

  if (!book.flibustaVariants || !book.flibustaVariants[variantIndex]) {
    return res.status(404).json({ message: 'Variant not found' });
  }

  const selectedVariant = book.flibustaVariants[variantIndex];
  const uploadResults = [];
  const errors = [];

  try {
    // Process each requested format
    for (const format of formats) {
      const formatInfo = selectedVariant.formats.find(f => f.format === format);
      if (formatInfo) {
        try {
          // Check if we already have this format in VK
          const existingDoc = book.vkDocuments?.find(
            doc => doc.format === format && doc.status === 'active'
          );

          if (existingDoc) {
            // Verify if document still exists in VK
            const exists = await vkStorage.checkDocument(existingDoc.ownerId, existingDoc.docId);
            if (exists) {
              uploadResults.push({
                format,
                ...existingDoc.toObject()
              });
              continue;
            } else {
              existingDoc.status = 'deleted';
            }
          }

          // Upload to VK
          console.log(`Uploading ${format} format to VK...`);
          const fileName = `${book.title} - ${book.author}`;
          const vkDoc = await vkStorage.uploadFromUrl(formatInfo.url, fileName, format);

          // Save VK document info
          book.vkDocuments = book.vkDocuments || [];
          book.vkDocuments.push({
            format,
            docId: vkDoc.id,
            ownerId: vkDoc.ownerId,
            url: vkDoc.url,
            directUrl: vkDoc.directUrl,
            size: vkDoc.size,
            uploadedAt: new Date(),
            lastChecked: new Date(),
            status: 'active'
          });

          uploadResults.push({
            format,
            url: vkDoc.url,
            directUrl: vkDoc.directUrl,
            size: vkDoc.size
          });

        } catch (error) {
          console.error(`Error uploading ${format}:`, error);
          errors.push({ format, error: error.message });
        }
      }
    }

    if (uploadResults.length === 0 && errors.length > 0) {
      return res.status(500).json({ 
        message: 'Failed to upload any formats',
        errors
      });
    }

    // Update book status
    book.flibustaStatus = 'uploaded';
    await book.save();

    res.json({
      message: uploadResults.length === formats.length 
        ? 'All formats uploaded successfully'
        : 'Some formats uploaded successfully',
      uploads: uploadResults,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error processing variant:', error);
    res.status(500).json({ 
      message: 'Failed to process variant',
      error: error.message
    });
  }
});

// @desc    Search for books
// @route   GET /api/books/search
// @access  Public
exports.searchBooks = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a search query'
    });
  }

  try {
    console.log(`\nProcessing search request for: "${query}"`);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Using proxy:', process.env.FLIBUSTA_PROXY || 'none');

    const results = await flibustaService.searchBooks(query);
    console.log(`Found ${results.length} results`);

    // Format results for frontend
    const formattedResults = results.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author.name,
      authorId: book.author.id,
      formats: book.formats.map(f => ({
        id: `${book.id}-${f.format}`,
        format: f.format
      }))
    }));

    res.json({
      success: true,
      count: formattedResults.length,
      data: formattedResults
    });
  } catch (error) {
    console.error('Search error:', error);

    // Handle specific error cases
    if (error.message.includes('empty')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('VPN') || error.message.includes('blocked')) {
      return res.status(503).json({
        success: false,
        error: 'Access to Flibusta is blocked in your region. Please wait while we try to connect through a proxy...',
        code: 'REGION_BLOCKED'
      });
    }

    if (error.code === 'ECONNREFUSED' || error.message.includes('connect to Flibusta')) {
      return res.status(503).json({
        success: false,
        error: 'Having trouble connecting to Flibusta. Please try again in a few moments...',
        code: 'CONNECTION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to search books. Please try again later.',
      code: 'UNKNOWN_ERROR'
    });
  }
});

// @desc    Get specific book variant details with format info
// @route   GET /api/books/variant/:id
// @access  Public
exports.getVariantDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify formats available for this variant
  const formats = ['epub', 'fb2', 'mobi'];
  const availableFormats = [];

  for (const format of formats) {
    try {
      await flibustaService.verifyDownloadLink(id, format);
      availableFormats.push({
        format,
        downloadUrl: `${process.env.FLIBUSTA_PROXY_URL}/${id}/${format}`
      });
    } catch (error) {
      // Format not available, skip it
      continue;
    }
  }

  if (availableFormats.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'No download formats available for this book'
    });
  }

  res.json({
    success: true,
    data: {
      id,
      formats: availableFormats
    }
  });
});

// @desc    Get direct download link
// @route   GET /api/books/download/:id/:format
// @access  Public
exports.getDownloadLink = asyncHandler(async (req, res) => {
  const { id, format } = req.params;

  if (!['epub', 'fb2', 'mobi'].includes(format)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid format requested'
    });
  }

  try {
    // Verify the format is available
    await flibustaService.verifyDownloadLink(id, format);

    // Use the Cloudflare Worker URL
    const downloadUrl = `${process.env.FLIBUSTA_PROXY_URL}/${id}/${format}`;

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    res.json({
      success: true,
      data: {
        downloadUrl,
        format
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(404).json({
      success: false,
      error: `Format ${format} is not available for this book`
    });
  }
}); 