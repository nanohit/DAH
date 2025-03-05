const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Book = require('../models/Book');
const { protect } = require('../middleware/auth');

// Recursive population function for nested replies
const populateReplies = (depth = 0) => {
  const maxDepth = 10; // Safety limit to prevent infinite recursion
  if (depth >= maxDepth) return null;

  return {
    path: 'replies',
    populate: [
      {
        path: 'user',
        select: 'username'
      },
      populateReplies(depth + 1)
    ].filter(Boolean)
  };
};

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

    // Create comment data
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

    // Add comment to post if it's a top-level comment
    if (!parentCommentId) {
      post.comments.push(comment._id);
      await post.save();
    }

    // Return populated comment with nested replies
    const populatedComment = await Comment.findById(comment._id)
      .populate('user', 'username')
      .populate(populateReplies());

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
    
    // Get only top-level comments (no parent)
    const comments = await Comment.find({ 
      post: postId,
      parentComment: null 
    })
    .populate('user', 'username')
    .populate(populateReplies())
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

    // Check if user is the comment owner or admin
    if (comment.user.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'User not authorized' });
    }

    comment.content = content;
    await comment.save();

    comment = await comment.populate('user', 'username');

    res.json(comment);
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

    // Check if user is the comment owner or admin
    if (comment.user.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'User not authorized' });
    }

    // If this is a top-level comment, remove it from the post's comments
    if (!comment.parentComment) {
      if (comment.post) {
        await Post.findByIdAndUpdate(comment.post, {
          $pull: { comments: comment._id }
        });
      }
    } else {
      // If this is a reply, remove it from parent comment's replies
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: comment._id }
      });
    }

    // Delete all replies if this is a parent comment
    if (comment.replies && comment.replies.length > 0) {
      await Comment.deleteMany({ _id: { $in: comment.replies } });
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

// Like a comment
router.post('/:commentId/like', protect, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check if user already liked the comment
        const alreadyLiked = comment.likes.includes(req.user._id);
        // Check if user already disliked the comment
        const alreadyDisliked = comment.dislikes.includes(req.user._id);

        if (alreadyLiked) {
            // Unlike the comment
            comment.likes = comment.likes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            // Like the comment and remove from dislikes if present
            comment.likes.push(req.user._id);
            if (alreadyDisliked) {
                comment.dislikes = comment.dislikes.filter(id => id.toString() !== req.user._id.toString());
            }
        }

        await comment.save();
        res.json({ likes: comment.likes.length, dislikes: comment.dislikes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Dislike a comment
router.post('/:commentId/dislike', protect, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check if user already disliked the comment
        const alreadyDisliked = comment.dislikes.includes(req.user._id);
        // Check if user already liked the comment
        const alreadyLiked = comment.likes.includes(req.user._id);

        if (alreadyDisliked) {
            // Remove dislike
            comment.dislikes = comment.dislikes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            // Add dislike and remove from likes if present
            comment.dislikes.push(req.user._id);
            if (alreadyLiked) {
                comment.likes = comment.likes.filter(id => id.toString() !== req.user._id.toString());
            }
        }

        await comment.save();
        res.json({ likes: comment.likes.length, dislikes: comment.dislikes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
