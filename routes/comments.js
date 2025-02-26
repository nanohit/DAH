const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Book = require('../models/Book');
const { protect } = require('../middleware/auth');

// @desc    Add comment to a post
// @route   POST /api/comments/post/:postId
// @access  Private
router.post('/post/:postId', protect, async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.postId;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Create comment
    const comment = await Comment.create({
      user: req.user.id,
      post: postId,
      content
    });

    // Add comment to post
    post.comments.push(comment._id);
    await post.save();

    // Return populated comment
    const populatedComment = await Comment.findById(comment._id).populate('user', 'username profilePicture');

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Add comment to a book
// @route   POST /api/comments/book/:bookId
// @access  Private
router.post('/book/:bookId', protect, async (req, res) => {
  try {
    const { content } = req.body;
    const bookId = req.params.bookId;

    // Check if book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Create comment
    const comment = await Comment.create({
      user: req.user.id,
      book: bookId,
      content
    });

    // Add comment to book
    book.comments.push(comment._id);
    await book.save();

    // Return populated comment
    const populatedComment = await Comment.findById(comment._id).populate('user', 'username profilePicture');

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update a comment
// @route   PUT /api/comments/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { content } = req.body;
    
    let comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment owner
    if (comment.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to update this comment' });
    }

    comment.content = content;
    await comment.save();

    // Return populated comment
    const populatedComment = await Comment.findById(comment._id).populate('user', 'username profilePicture');

    res.json(populatedComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment owner
    if (comment.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this comment' });
    }

    // Remove comment from post or book
    if (comment.post) {
      await Post.findByIdAndUpdate(comment.post, {
        $pull: { comments: comment._id }
      });
    } else if (comment.book) {
      await Book.findByIdAndUpdate(comment.book, {
        $pull: { comments: comment._id }
      });
    }

    await comment.deleteOne();

    res.json({ message: 'Comment removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Like a comment
// @route   PUT /api/comments/:id/like
// @access  Private
router.put('/:id/like', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if the comment has already been liked by this user
    if (comment.likes.some(like => like.toString() === req.user.id)) {
      // Remove the like
      comment.likes = comment.likes.filter(like => like.toString() !== req.user.id);
    } else {
      // Add the like
      comment.likes.push(req.user.id);
    }

    await comment.save();

    res.json(comment.likes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
