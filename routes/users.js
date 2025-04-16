const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Map = require('../models/Map');
const { protect } = require('../middleware/auth');

// @desc    Get user by username
// @route   GET /api/users/:username
// @access  Public
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password -email -isAdmin -lastIp -registrationIp');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get user's posts
// @route   GET /api/users/:username/posts
// @access  Public
router.get('/:username/posts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    
    const user = await User.findOne({ username: req.params.username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Define a recursive population function for nested replies
    const populateRepliesRecursively = (depth = 0) => {
      const maxDepth = 5; // Safety limit to prevent infinite recursion
      if (depth >= maxDepth) return null;
      
      return {
        path: 'replies',
        populate: [
          {
            path: 'user',
            select: 'username badge'
          },
          populateRepliesRecursively(depth + 1)
        ].filter(Boolean) // Filter out null values at max depth
      };
    };

    console.log('Debug - Fetching posts for user:', user.username);
    
    const posts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .populate('author', 'username badge')
      .populate({
        path: 'comments',
        populate: [
          {
            path: 'user',
            select: 'username badge'
          },
          populateRepliesRecursively(0) // Use recursive population
        ]
      })
      .limit(limit)
      .skip(skip);
      
    // Log comment structure for debugging
    if (posts.length > 0 && posts[0].comments.length > 0) {
      console.log(`Debug - First post has ${posts[0].comments.length} comments`);
      posts[0].comments.forEach((comment, idx) => {
        if (comment.replies && comment.replies.length > 0) {
          console.log(`Debug - Comment ${idx} has ${comment.replies.length} direct replies`);
          const nestedReplies = comment.replies.filter(reply => reply.replies && reply.replies.length > 0);
          if (nestedReplies.length > 0) {
            console.log(`Debug - Comment ${idx} has ${nestedReplies.length} replies with nested replies`);
          }
        }
      });
    }

    // Get total count of user's posts
    const total = await Post.countDocuments({ author: user._id });

    res.json({
      posts,
      total,
      hasMore: total > skip + limit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get user's maps
// @route   GET /api/users/:username/maps
// @access  Public
router.get('/:username/maps', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    
    const user = await User.findOne({ username: req.params.username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const maps = await Map.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'username badge')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username badge'
        }
      })
      .limit(limit)
      .skip(skip);

    // Calculate element and connection counts for each map
    const processedMaps = maps.map(map => ({
      ...map.toObject(),
      elementCount: map.elements ? map.elements.length : 0,
      connectionCount: map.connections ? map.connections.length : 0
    }));

    // Get total count of user's maps
    const total = await Map.countDocuments({ user: user._id });

    res.json({
      maps: processedMaps,
      total,
      hasMore: total > skip + limit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Update user's bio
// @route   PATCH /api/users/:id/bio
// @access  Private
router.patch('/:id/bio', protect, async (req, res) => {
  try {
    // Check if user is updating their own bio
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized to update this bio' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { bio: req.body.bio },
      { new: true }
    ).select('-password -email -isAdmin -lastIp -registrationIp');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Update user's badge
// @route   PATCH /api/users/:id/badge
// @access  Private
router.patch('/:id/badge', protect, async (req, res) => {
  try {
    // Check if user is updating their own badge
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized to update this badge' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { badge: req.body.badge },
      { new: true }
    ).select('-password -email -isAdmin -lastIp -registrationIp');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 