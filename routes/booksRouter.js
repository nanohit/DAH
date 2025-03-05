const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const { protect, admin } = require('../middleware/auth');
const { requestDownloadLinks, getDownloadVariants, selectVariant, searchBooks, getVariantDetails, getDownloadLink } = require('../controllers/flibustaController');

// Flibusta routes - must be before other routes
router.get('/flibusta/search', searchBooks);
router.get('/flibusta/variant/:id', getVariantDetails);
router.get('/flibusta/download/:id/:format', getDownloadLink);

// @desc    Get all books
// @route   GET /api/books
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    let sortOptions = { createdAt: -1 };
    
    if (search) {
      // Use regex to match title only, case insensitive
      query = { 
        title: { 
          $regex: search, 
          $options: 'i' 
        }
      };
    }

    const books = await Book.find(query)
      .select('title author description coverImage publishedYear addedBy comments')
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

    // Get total count for pagination
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

// @desc    Get single book by ID
// @route   GET /api/books/:id
// @access  Public
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

// @desc    Create a new book
// @route   POST /api/books
// @access  Private
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
      addedBy: req.user.id
    });

    res.status(201).json(book);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update a book
// @route   PUT /api/books/:id
// @access  Private/Admin
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

// @desc    Delete a book
// @route   DELETE /api/books/:id
// @access  Private/Admin
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

// @desc    Like a book
// @route   PUT /api/books/:id/like
// @access  Private
router.put('/:id/like', protect, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if the book has already been liked by this user
    if (book.likes.some(like => like.toString() === req.user.id)) {
      // Remove the like
      book.likes = book.likes.filter(like => like.toString() !== req.user.id);
    } else {
      // Add the like
      book.likes.push(req.user.id);
    }

    await book.save();

    res.json(book.likes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Request download links from Flibusta
// @route   POST /api/books/:id/request-download-links
// @access  Private
router.post('/:id/request-download-links', protect, requestDownloadLinks);

// @desc    Get available variants for a book
// @route   GET /api/books/:id/download-variants
// @access  Private
router.get('/:id/download-variants', protect, getDownloadVariants);

// @desc    Select and save a specific variant
// @route   POST /api/books/:id/select-variant
// @access  Private
router.post('/:id/select-variant', protect, selectVariant);

module.exports = router; 