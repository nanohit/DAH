const express = require('express');
const router = express.Router();
const flibustaRouter = express.Router({ mergeParams: true }); // Create a Flibusta router that can access parent params
const Book = require('../models/Book');
const { protect, admin } = require('../middleware/auth');
const { requestDownloadLinks, getDownloadVariants, selectVariant, searchBooks, getVariantDetails, getDownloadLink } = require('../controllers/flibustaController');

// At the top after imports
console.log('\n=== BOOKS ROUTER INITIALIZATION ===');

// Debug logging middleware
router.use((req, res, next) => {
  console.log('\n=== Books Router Request ===');
  console.log('Full URL:', req.originalUrl);
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Params:', req.params);
  console.log('Body:', req.body);
  next();
});

// Flibusta router middleware
flibustaRouter.use((req, res, next) => {
  console.log('\n=== Flibusta Router Request ===');
  console.log('Full URL:', req.originalUrl);
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Params:', req.params);
  console.log('Body:', req.body);
  next();
});

// Before registering routes
console.log('\n=== Registering Routes ===');

// Before the confirm-download-links route
console.log('\nRegistering confirm-download-links route with pattern: /:id/confirm-download-links');

// Flibusta search routes
router.get('/flibusta/search', searchBooks);
router.get('/flibusta/variant/:id', getVariantDetails);
router.get('/flibusta/download/:id/:format', getDownloadLink);

// Book-specific Flibusta routes
flibustaRouter.post('/request-download-links', protect, requestDownloadLinks);
flibustaRouter.get('/download-variants', protect, getDownloadVariants);
flibustaRouter.post('/select-variant', protect, selectVariant);

// Save and clear Flibusta data
flibustaRouter.post('/save-flibusta', protect, async (req, res) => {
  console.log('\n=== Save Flibusta Links Handler ===');
  console.log('Full URL:', req.originalUrl);
  console.log('Book ID:', req.params.id);
  console.log('Request body:', req.body);
  
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      console.log('Book not found:', req.params.id);
      return res.status(404).json({ message: 'Book not found' });
    }

    const { variant } = req.body;
    console.log('Updating book with variant:', variant);

    // Update Flibusta fields
    book.flibustaStatus = 'uploaded';
    book.flibustaLastChecked = new Date();
    book.flibustaVariants = [variant];

    await book.save();
    console.log('Book updated successfully');

    // Return the updated book with populated fields
    const updatedBook = await Book.findById(book._id)
      .populate('addedBy', 'username')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      });

    res.json(updatedBook);
  } catch (error) {
    console.error('Error saving Flibusta data:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

flibustaRouter.post('/clear-flibusta', protect, async (req, res) => {
  console.log('\n=== Clear Flibusta Links Handler ===');
  console.log('Full URL:', req.originalUrl);
  console.log('Book ID:', req.params.id);
  
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      console.log('Book not found:', req.params.id);
      return res.status(404).json({ message: 'Book not found' });
    }

    // Clear Flibusta fields
    book.flibustaStatus = 'not_checked';
    book.flibustaLastChecked = new Date();
    book.flibustaVariants = [];

    await book.save();
    console.log('Book Flibusta data cleared successfully');

    // Return the updated book with populated fields
    const updatedBook = await Book.findById(book._id)
      .populate('addedBy', 'username')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      });

    res.json(updatedBook);
  } catch (error) {
    console.error('Error clearing Flibusta data:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Mount the Flibusta router for book-specific routes
router.use('/:id', flibustaRouter);

// Generic routes
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    let sortOptions = { createdAt: -1 };
    
    if (search) {
      query = { 
        title: { 
          $regex: search, 
          $options: 'i' 
        }
      };
    }

    const books = await Book.find(query)
      .select('title author description coverImage publishedYear addedBy comments flibustaStatus flibustaVariants flibustaLastChecked')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
      .populate('addedBy', 'username')
      .populate({
        path: 'comments',
        options: { limit: 5 },
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      });

    const total = await Book.countDocuments(query);

    res.json({
      books,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { title, author, description, coverImage, publishedYear, genres } = req.body;
    
    const book = await Book.create({
      title,
      author,
      description,
      coverImage,
      publishedYear,
      genres,
      addedBy: req.user.id,
      flibustaStatus: 'not_checked'  // Add default Flibusta status
    });

    res.status(201).json(book);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Generic /:id routes come last
router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
      .populate('addedBy', 'username')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      });

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { title, author, description, coverImage, publishedYear, genres } = req.body;
    
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    book.title = title || book.title;
    book.author = author || book.author;
    book.description = description || book.description;
    book.coverImage = coverImage || book.coverImage;
    book.publishedYear = publishedYear || book.publishedYear;
    book.genres = genres || book.genres;

    const updatedBook = await book.save();
    res.json(updatedBook);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    await book.deleteOne();
    res.json({ message: 'Book removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Log all registered routes
console.log('\n=== Books Router Routes ===');
router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`${Object.keys(r.route.methods).join(', ').toUpperCase()}\t${r.route.path}`);
  } else if (r.name === 'router') {
    console.log('Mounted router at:', r.regexp);
  }
});

module.exports = router; 