const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const { uploadImage } = require('../utils/imageUpload');
const jwt = require('jsonwebtoken');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Create a new post with optional image
router.post('/', protect, upload.single('image'), async (req, res) => {
    try {
        console.log('\n=== Create Post Debug ===');
        console.log('Request headers:', req.headers);
        console.log('Request file:', req.file ? {
            fieldname: req.file.fieldname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            buffer: req.file.buffer ? 'Buffer exists' : 'No buffer'
        } : 'No file');
        console.log('Request body:', req.body);
        
        const postData = {
            ...req.body,
            author: req.user._id
        };
        
        console.log('Post data before image:', postData);

        // If there's an image, upload it to ImgBB
        if (req.file) {
            try {
                console.log('Attempting to upload image to ImgBB');
                console.log('Image buffer size:', req.file.buffer.length);
                
                const result = await uploadImage(req.file.buffer);
                console.log('ImgBB upload result:', result);
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                postData.imageUrl = result.imageUrl;
                console.log('Image URL added to post:', postData.imageUrl);
            } catch (error) {
                console.error('Detailed error uploading image:', error);
                console.error('Error stack:', error.stack);
                return res.status(400).json({ 
                    error: 'Failed to upload image',
                    details: error.message
                });
            }
        }

        const post = new Post(postData);
        console.log('Created post instance:', post);
        
        await post.save();
        console.log('Post saved successfully');
        
        await post.populate('author', 'username');
        console.log('Post populated with author');
        
        res.status(201).json(post);
    } catch (error) {
        console.error('Error creating post:', error);
        console.error('Error stack:', error.stack);
        res.status(400).json({ 
            error: 'Failed to create post',
            details: error.message,
            validationErrors: error.errors ? Object.values(error.errors).map(e => e.message) : undefined
        });
    }
});

// Get all posts
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const skip = parseInt(req.query.skip) || 0;

        // Get the user ID from auth token if available
        let userId = null;
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            }
        } catch (error) {
            // Token verification failed, continue without user ID
            console.log('No valid auth token provided');
        }

        const posts = await Post.find({})
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
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        // Get total count for pagination
        const total = await Post.countDocuments();

        res.json({
            posts,
            total,
            hasMore: total > skip + limit
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Update a post
router.patch('/:id', protect, upload.single('image'), async (req, res) => {
    try {
        console.log('=== Update Post Debug ===');
        console.log('Request user:', req.user);
        console.log('Request body:', req.body);
        console.log('Post ID:', req.params.id);

        // Find the post first
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            console.log('Post not found');
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if user is author or admin
        if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            console.log('User not authorized');
            return res.status(403).json({ error: 'Not authorized' });
        }

        const updates = Object.keys(req.body);
        const allowedUpdates = ['headline', 'text'];
        const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

        if (!isValidOperation) {
            console.log('Invalid updates requested:', updates);
            return res.status(400).json({ error: 'Invalid updates!' });
        }

        // If there's a new image, upload it to ImgBB
        if (req.file) {
            try {
                const result = await uploadImage(req.file.buffer);
                if (!result.success) {
                    throw new Error(result.error || 'Failed to upload image');
                }
                post.imageUrl = result.imageUrl;
            } catch (error) {
                console.error('Error uploading image:', error);
                return res.status(400).json({ error: 'Failed to upload image' });
            }
        }

        updates.forEach((update) => post[update] = req.body[update]);
        console.log('Updated post data:', post);

        await post.save();
        console.log('Post saved successfully');

        await post.populate('author', 'username');
        console.log('Post populated with author');

        res.json(post);
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(400).json({ 
            error: error.message,
            details: error.errors ? Object.values(error.errors).map(e => e.message) : undefined
        });
    }
});

// Delete a post
router.delete('/:id', protect, async (req, res) => {
    try {
        // Find the post first
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if user is author or admin
        if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await post.deleteOne();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Toggle bookmark status for a post
router.post('/:id/bookmark', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const userId = req.user._id;
        const existingBookmark = post.bookmarks.find(b => b.user.equals(userId));

        if (existingBookmark) {
            // Remove bookmark
            post.bookmarks = post.bookmarks.filter(b => !b.user.equals(userId));
        } else {
            // Add bookmark
            post.bookmarks.push({ user: userId });
        }

        await post.save();
        res.json({ success: true, isBookmarked: !existingBookmark });
    } catch (error) {
        console.error('Error bookmarking post:', error);
        res.status(500).json({ error: 'Failed to bookmark post' });
    }
});

// Get bookmarked posts for current user
router.get('/bookmarked', protect, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const skip = parseInt(req.query.skip) || 0;
        const userId = req.user._id;

        // First, get all posts that are bookmarked by the user
        const posts = await Post.aggregate([
            // Match posts that have a bookmark from this user
            { $match: { 'bookmarks.user': userId } },
            
            // Add a field with this user's specific bookmark timestamp
            { $addFields: {
                userBookmark: {
                    $filter: {
                        input: '$bookmarks',
                        as: 'bookmark',
                        cond: { $eq: ['$$bookmark.user', userId] }
                    }
                }
            }},
            
            // Sort by this user's bookmark timestamp
            { $sort: { 'userBookmark.0.timestamp': -1 } },
            
            // Apply pagination
            { $skip: skip },
            { $limit: limit }
        ]);

        // Get total count for pagination
        const total = await Post.countDocuments({ 'bookmarks.user': userId });

        // Populate the necessary fields after aggregation
        await Post.populate(posts, [
            { path: 'author', select: 'username' },
            {
                path: 'comments',
                populate: [
                    {
                        path: 'user',
                        select: 'username'
                    },
                    {
                        path: 'replies',
                        populate: {
                            path: 'user',
                            select: 'username'
                        }
                    }
                ]
            }
        ]);

        res.json({
            posts,
            total,
            hasMore: total > skip + limit
        });
    } catch (error) {
        console.error('Error fetching bookmarked posts:', error);
        res.status(500).json({ error: 'Failed to fetch bookmarked posts' });
    }
});

// Like a post
router.post('/:postId/like', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if user already liked the post
        const alreadyLiked = post.likes.includes(req.user._id);
        // Check if user already disliked the post
        const alreadyDisliked = post.dislikes.includes(req.user._id);

        if (alreadyLiked) {
            // Unlike the post
            post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            // Like the post and remove from dislikes if present
            post.likes.push(req.user._id);
            if (alreadyDisliked) {
                post.dislikes = post.dislikes.filter(id => id.toString() !== req.user._id.toString());
            }
        }

        await post.save();
        res.json({ likes: post.likes.length, dislikes: post.dislikes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Dislike a post
router.post('/:postId/dislike', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if user already disliked the post
        const alreadyDisliked = post.dislikes.includes(req.user._id);
        // Check if user already liked the post
        const alreadyLiked = post.likes.includes(req.user._id);

        if (alreadyDisliked) {
            // Remove dislike
            post.dislikes = post.dislikes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            // Add dislike and remove from likes if present
            post.dislikes.push(req.user._id);
            if (alreadyLiked) {
                post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
            }
        }

        await post.save();
        res.json({ likes: post.likes.length, dislikes: post.dislikes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 