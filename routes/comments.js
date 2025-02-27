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
    const { content, parentCommentId } = req.body;
    const postId = req.params.postId;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const commentData = {
      user: req.user.id,
      post: postId,
      content
    };

    // If this is a reply to another comment
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
      commentData.parentComment = parentCommentId;
    }

    // Create comment
    const comment = await Comment.create(commentData);

    // If this is a reply, add it to parent comment's replies
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: comment._id }
      });
    }

    // Add comment to post
    post.comments.push(comment._id);
    await post.save();

    // Return populated comment
    const populatedComment = await Comment.findById(comment._id)
      .populate('user', 'username')
      .populate({
        path: 'replies',
        populate: {
          path: 'user',
          select: 'username'
        }
      });

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get comments for a post
// @route   GET /api/comments/post/:postId
// @access  Public
router.get('/post/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    
    // Get all top-level comments (comments without a parent)
    const comments = await Comment.find({ post: postId, parentComment: null })
      .populate('user', 'username')
      .populate({
        path: 'replies',
        populate: {
          path: 'user',
          select: 'username'
        }
      })
      .sort({ createdAt: -1 });

    res.json(comments);
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
    const populatedComment = await Comment.findById(comment._id).populate('user', 'username');

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
    const populatedComment = await Comment.findById(comment._id).populate('user', 'username');

    res.json(populatedComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Delete a comment
// @route   DELETE /api/comments/:commentId
// @access  Private
router.delete('/:commentId', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment
    if (comment.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    // Remove comment from parent's replies if it's a reply
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: comment._id }
      });
    }

    // Remove comment from post's comments
    if (comment.post) {
      await Post.findByIdAndUpdate(comment.post, {
        $pull: { comments: comment._id }
      });
    }

    // Delete all replies recursively
    async function deleteReplies(commentId) {
      const replies = await Comment.find({ parentComment: commentId });
      for (const reply of replies) {
        await deleteReplies(reply._id);
        await Comment.findByIdAndDelete(reply._id);
      }
    }

    await deleteReplies(comment._id);
    await comment.remove();

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
