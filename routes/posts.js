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
        
        await post.populate('author', 'username badge');
        console.log('Post populated with author');
        
        // Get Socket.io instance
        const io = req.app.get('socketio');
        if (io) {
            // Emit a global event that a new post has been created
            io.emit('post-created', post);
            console.log('Socket.io: Emitted post-created event');
        }
        
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
                options: {
                    sort: { createdAt: -1 }
                },
                populate: [
                    {
                        path: 'user',
                        select: 'username badge'
                    },
                    {
                        path: 'replies',
                        options: {
                            sort: { createdAt: -1 }
                        },
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
            console.log('User not authorized to update this post');
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Only allow updating headline, text, or image
        const updates = Object.keys(req.body).filter(
            update => ['headline', 'text'].includes(update)
        );

        if (updates.length === 0 && !req.file) {
            console.log('No valid updates provided');
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        updates.forEach((update) => post[update] = req.body[update]);
        console.log('Updated post data:', post);

        await post.save();
        console.log('Post saved successfully');

        await post.populate('author', 'username badge');
        console.log('Post populated with author');

        // Get Socket.io instance
        const io = req.app.get('socketio');
        if (io) {
            // We need to use the correct room format for Socket.io
            const roomName = `post:${post._id}`;
            console.log(`Socket.io: Emitting post-updated event to room ${roomName}`);
            io.to(roomName).emit('post-updated', post);
        }

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
        
        // Get Socket.io instance
        const io = req.app.get('socketio');
        if (io) {
            // Emit to the specific post room and also globally
            const roomName = `post:${post._id}`;
            console.log(`Socket.io: Emitting post-deleted event to room ${roomName}`);
            io.to(roomName).emit('post-deleted', post._id);
            io.emit('post-deleted', post._id);
        }
        
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Toggle like for a post
router.post('/:id/like', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if post is already liked by user
        const alreadyLiked = post.likes.includes(req.user._id);
        
        if (alreadyLiked) {
            // Unlike the post
            post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            // Add like
            post.likes.push(req.user._id);
            // Remove from dislikes if present
            post.dislikes = post.dislikes.filter(id => id.toString() !== req.user._id.toString());
        }

        await post.save();
        
        // Get Socket.io instance
        const io = req.app.get('socketio');
        if (io) {
            // Emit to the specific post room with correct room name format
            const roomName = `post:${post._id}`;
            console.log(`Socket.io: Emitting post-liked event to room ${roomName}`);
            io.to(roomName).emit('post-liked', {
                postId: post._id,
                likes: post.likes,
                dislikes: post.dislikes,
                userId: req.user._id
            });
        }
        
        res.json({ likes: post.likes.length, dislikes: post.dislikes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Toggle dislike for a post
router.post('/:id/dislike', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if post is already disliked by user
        const alreadyDisliked = post.dislikes.includes(req.user._id);
        
        if (alreadyDisliked) {
            // Un-dislike the post
            post.dislikes = post.dislikes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            // Add dislike
            post.dislikes.push(req.user._id);
            // Remove from likes if present
            post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
        }

        await post.save();
        
        // Get Socket.io instance
        const io = req.app.get('socketio');
        if (io) {
            // Emit to the specific post room with correct room name format
            const roomName = `post:${post._id}`;
            console.log(`Socket.io: Emitting post-disliked event to room ${roomName}`);
            io.to(roomName).emit('post-disliked', {
                postId: post._id,
                likes: post.likes,
                dislikes: post.dislikes,
                userId: req.user._id
            });
        }
        
        res.json({ likes: post.likes.length, dislikes: post.dislikes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Toggle bookmark status for a post
router.post('/:id/bookmark', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if post is already bookmarked by user
        const bookmarkIndex = post.bookmarks.findIndex(bookmark => 
            bookmark.user.toString() === req.user._id.toString()
        );
        
        if (bookmarkIndex > -1) {
            // Remove bookmark
            post.bookmarks.splice(bookmarkIndex, 1);
        } else {
            // Add bookmark
            post.bookmarks.push({
                user: req.user._id,
                timestamp: new Date()
            });
        }

        await post.save();
        
        // Get Socket.io instance
        const io = req.app.get('socketio');
        if (io) {
            // Emit to the specific post room with correct room name format
            const roomName = `post:${post._id}`;
            console.log(`Socket.io: Emitting post-bookmarked event to room ${roomName}`);
            io.to(roomName).emit('post-bookmarked', {
                postId: post._id,
                bookmarks: post.bookmarks,
                userId: req.user._id
            });
        }
        
        res.json({ bookmarks: post.bookmarks });
    } catch (error) {
        res.status(500).json({ message: error.message });
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
            { path: 'author', select: 'username badge' },
            {
                path: 'comments',
                options: {
                    sort: { createdAt: -1 }
                },
                populate: [
                    {
                        path: 'user',
                        select: 'username badge'
                    },
                    {
                        path: 'replies',
                        options: {
                            sort: { createdAt: -1 }
                        },
                        populate: {
                            path: 'user',
                            select: 'username badge'
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

module.exports = router; 