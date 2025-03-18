const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Book = require('../models/Book');
const Map = require('../models/Map');
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
        select: 'username badge'
      },
      populateReplies(depth + 1)
    ].filter(Boolean)
  };
};

// @desc    Get comments for a map
// @route   GET /api/comments/map/:mapId
// @access  Public
router.get('/map/:mapId', async (req, res) => {
  try {
    console.log(`Fetching comments for map: ${req.params.mapId}`);
    const mapId = req.params.mapId;
    
    // Get only top-level comments (no parent)
    const comments = await Comment.find({ 
      map: mapId,
      parentComment: null 
    })
    .populate('user', 'username badge')
    .populate(populateReplies())
    .sort({ createdAt: -1 });

    console.log(`Found ${comments.length} comments for map ${mapId}`);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching map comments:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Add comment to a map
// @route   POST /api/comments/map/:mapId
// @access  Private
router.post('/map/:mapId', protect, async (req, res) => {
  try {
    console.log(`Adding comment to map: ${req.params.mapId}`);
    console.log('User from auth middleware:', req.user ? {
      id: req.user._id || req.user.id,
      username: req.user.username
    } : 'No user found');
    console.log('Request body:', req.body);
    
    const { content, parentCommentId } = req.body;
    const mapId = req.params.mapId;

    // Check if map exists
    const map = await Map.findById(mapId);
    if (!map) {
      console.log(`Map not found with ID: ${mapId}`);
      return res.status(404).json({ message: 'Map not found' });
    }
    
    console.log('Map found:', {
      id: map._id,
      name: map.name,
      user: map.user
    });

    // Create comment data
    const commentData = {
      user: req.user._id, // Using _id instead of id to ensure consistency
      map: mapId,
      content
    };
    
    console.log('Comment data to be created:', commentData);

    // If this is a reply to another comment
    if (parentCommentId) {
      console.log(`Checking parent comment: ${parentCommentId}`);
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        console.log(`Parent comment not found: ${parentCommentId}`);
        return res.status(404).json({ message: 'Parent comment not found' });
      }
      commentData.parentComment = parentCommentId;
      console.log(`Parent comment found, adding to comment data`);
    }

    // Create comment
    console.log('Creating new comment with data:', commentData);
    const comment = await Comment.create(commentData);
    console.log('Comment created successfully:', comment._id);

    // If this is a reply, add it to parent comment's replies
    if (parentCommentId) {
      console.log(`Adding new comment to parent's replies`);
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: comment._id }
      });
      console.log(`Updated parent comment with new reply`);
    }

    // Add comment to map if it's a top-level comment
    if (!parentCommentId) {
      console.log(`Adding comment to map's comments array`);
      map.comments.push(comment._id);
      await map.save();
      console.log(`Updated map with new comment`);
    }

    // Return populated comment with nested replies
    console.log(`Populating comment for response`);
    const populatedComment = await Comment.findById(comment._id)
      .populate('user', 'username badge')
      .populate(populateReplies());
    
    console.log(`Sending populated comment in response`);
    res.status(201).json(populatedComment);
  } catch (error) {
    console.error('Error adding map comment:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors));
    }
    res.status(500).json({ 
      message: 'Server Error',
      error: error.message 
    });
  }
});

// @desc    Get comments for a post
// @route   GET /api/comments/post/:postId
// @access  Public
router.get('/post/:postId', async (req, res) => {
  try {
    console.log(`Fetching comments for post: ${req.params.postId}`);
    const postId = req.params.postId;
    
    // Get only top-level comments (no parent)
    const comments = await Comment.find({ 
      post: postId,
      parentComment: null 
    })
    .populate('user', 'username badge')
    .populate(populateReplies())
    .sort({ createdAt: -1 });

    console.log(`Found ${comments.length} comments for post ${postId}`);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching post comments:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Add comment to a post
// @route   POST /api/comments/post/:postId
// @access  Private
router.post('/post/:postId', protect, async (req, res) => {
  try {
    console.log(`Adding comment to post: ${req.params.postId}`);
    console.log('User from auth middleware:', req.user ? {
      id: req.user._id || req.user.id,
      username: req.user.username
    } : 'No user found');
    console.log('Request body:', req.body);
    
    const { content, parentCommentId } = req.body;
    const postId = req.params.postId;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      console.log(`Post not found with ID: ${postId}`);
      return res.status(404).json({ message: 'Post not found' });
    }
    
    console.log('Post found:', {
      id: post._id,
      headline: post.headline,
      author: post.author
    });

    // Create comment data
    const commentData = {
      content,
      user: req.user._id,
      post: postId
    };

    // If this is a reply, add the parent comment reference
    if (parentCommentId) {
      console.log(`This is a reply to comment: ${parentCommentId}`);
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        console.log(`Parent comment not found with ID: ${parentCommentId}`);
        return res.status(404).json({ message: 'Parent comment not found' });
      }
      commentData.parentComment = parentCommentId;
    }

    // Create and save the comment
    const comment = new Comment(commentData);
    await comment.save();
    console.log('Comment saved successfully with ID:', comment._id);

    // Add to post's comments array if it's a top-level comment
    if (!parentCommentId) {
      post.comments.push(comment._id);
      await post.save();
      console.log('Comment added to post.comments array');
    }

    // Populate the user info before returning
    await comment.populate('user', 'username badge');
    
    // If it's a reply, also populate the replies array
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(
        parentCommentId,
        { $push: { replies: comment._id } },
        { new: true }
      );
      console.log('Reply added to parent comment.replies array');
    }

    // Get Socket.io instance and emit events
    const io = req.app.get('socketio');
    if (io) {
      const roomName = `post:${postId}`;
      console.log(`Socket.io: Emitting comment-created event to room ${roomName}`);
      io.to(roomName).emit('comment-created', {
        comment,
        parentCommentId
      });
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding comment:', error);
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

// Update a comment
router.patch('/:id', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is the comment author or admin
    if (comment.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update fields
    if (req.body.content) {
      comment.content = req.body.content;
    }
    
    await comment.save();
    await comment.populate('user', 'username badge');
    
    // Get Socket.io instance and emit events
    const io = req.app.get('socketio');
    if (io) {
      // Find which post this comment belongs to
      const postId = comment.post;
      if (postId) {
        const roomName = `post:${postId}`;
        console.log(`Socket.io: Emitting comment-updated event to room ${roomName}`);
        io.to(roomName).emit('comment-updated', comment);
      }
    }
    
    res.json(comment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Delete a comment
router.delete('/:id', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is the comment author or admin
    if (comment.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Store postId for socket event before deleting
    const postId = comment.post;
    const commentId = comment._id;
    const parentComment = comment.parentComment;
    
    // If it's a parent comment, remove all its replies too
    if (!comment.parentComment) {
      await Comment.deleteMany({ parentComment: commentId });
    } else {
      // If it's a reply, remove it from parent's replies array
      await Comment.findByIdAndUpdate(
        comment.parentComment,
        { $pull: { replies: commentId } }
      );
    }
    
    // Remove from post's comments array if it's a top-level comment
    if (!comment.parentComment && postId) {
      await Post.findByIdAndUpdate(
        postId,
        { $pull: { comments: commentId } }
      );
    }
    
    await comment.deleteOne();
    
    // Get Socket.io instance and emit events
    const io = req.app.get('socketio');
    if (io && postId) {
      const roomName = `post:${postId}`;
      console.log(`Socket.io: Emitting comment-deleted event to room ${roomName}`);
      io.to(roomName).emit('comment-deleted', {
        commentId,
        parentCommentId: parentComment
      });
    }
    
    res.json({ message: 'Comment removed' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
