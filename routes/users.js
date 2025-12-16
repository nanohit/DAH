const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Map = require('../models/Map');
const BookDownloadProfile = require('../models/BookDownloadProfile');
const { protect } = require('../middleware/auth');

// ============ Online Count Logic ============
// Generates a pseudo-random "online users" count based on Moscow time
// Updates at 8:00, 12:00, 19:00, and 0:00 Moscow time
// True random is selected at 9:00 Moscow time

const ONLINE_SEED_KEY = 'online_count_seed';
let onlineCountState = {
  baseCount: null,
  lastUpdateHour: null,
  lastUpdateDate: null,
  seed: null,
};

const getMoscowHour = () => {
  const now = new Date();
  // Moscow is UTC+3
  const moscowOffset = 3 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const moscowMinutes = utcMinutes + moscowOffset;
  return Math.floor(moscowMinutes / 60) % 24;
};

const getMoscowDate = () => {
  const now = new Date();
  const moscowOffset = 3 * 60 * 60 * 1000; // 3 hours in ms
  const moscowTime = new Date(now.getTime() + moscowOffset);
  return moscowTime.toISOString().slice(0, 10); // YYYY-MM-DD
};

const getRandomInRange = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getOnlineCount = () => {
  const moscowHour = getMoscowHour();
  const moscowDate = getMoscowDate();
  
  // Update times: 8, 12, 19, 0 (9 is special - true random)
  const updateHours = [0, 8, 9, 12, 19];
  
  // Find which update period we're in
  let currentPeriodHour = 0;
  for (const hour of updateHours) {
    if (moscowHour >= hour) {
      currentPeriodHour = hour;
    }
  }
  
  // Check if we need to update
  const needsUpdate = 
    onlineCountState.baseCount === null ||
    onlineCountState.lastUpdateDate !== moscowDate ||
    onlineCountState.lastUpdateHour !== currentPeriodHour;
  
  if (needsUpdate) {
    if (currentPeriodHour === 9 || onlineCountState.baseCount === null) {
      // True random at 9:00 or initial load
      onlineCountState.baseCount = getRandomInRange(23, 70);
    } else {
      // Random within ±50 of previous count
      const prevCount = onlineCountState.baseCount || 100;
      const min = Math.max(23, prevCount - 50);
      const max = Math.min(70, prevCount + 50);
      onlineCountState.baseCount = getRandomInRange(min, max);
    }
    onlineCountState.lastUpdateHour = currentPeriodHour;
    onlineCountState.lastUpdateDate = moscowDate;
    onlineCountState.seed = Math.random();
  } else if (onlineCountState.baseCount > 70) {
    // Clamp and refresh if an old oversized value lingers
    onlineCountState.baseCount = getRandomInRange(23, 70);
    onlineCountState.lastUpdateHour = currentPeriodHour;
    onlineCountState.lastUpdateDate = moscowDate;
    onlineCountState.seed = Math.random();
  }

  // Final clamp before returning to guarantee max 70 immediately
  if (onlineCountState.baseCount > 70) {
    onlineCountState.baseCount = getRandomInRange(23, 70);
    onlineCountState.lastUpdateHour = currentPeriodHour;
    onlineCountState.lastUpdateDate = moscowDate;
    onlineCountState.seed = Math.random();
  }
  
  return onlineCountState.baseCount;
};

// @desc    Get online user count
// @route   GET /api/users/stats/online
// @access  Public
router.get('/stats/online', (req, res) => {
  const baseCount = getOnlineCount();
  res.json({ count: baseCount });
});

// @desc    Get popular books (nano's downloads)
// @route   GET /api/users/stats/popular-books
// @access  Public
router.get('/stats/popular-books', async (req, res) => {
  try {
    // Find nano user
    const nanoUser = await User.findOne({ username: 'nano' });
    if (!nanoUser) {
      return res.json({ books: [] });
    }
    
    // Find nano's download profile
    const profile = await BookDownloadProfile.findOne({ user: nanoUser._id });
    if (!profile || !profile.downloads || profile.downloads.length === 0) {
      return res.json({ books: [] });
    }
    
    // Get up to 24 random books from nano's downloads
    const downloads = profile.downloads.slice(0, 100); // Get up to 100
    const shuffled = downloads.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 24);
    
    const books = selected.map((d, idx) => ({
      id: d._id ? d._id.toString() : `popular-${idx}`,
      title: d.title,
      author: d.author,
    }));
    
    res.json({ books });
  } catch (err) {
    console.error('Error fetching popular books:', err);
    res.status(500).json({ books: [] });
  }
});

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