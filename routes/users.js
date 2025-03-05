const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
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
          {
            path: 'replies',
            populate: {
              path: 'user',
              select: 'username badge'
            }
          }
        ]
      })
      .limit(limit)
      .skip(skip);

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