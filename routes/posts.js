const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const vkUploader = require('../utils/vkImageUploader');

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
        console.log('=== Create Post Debug ===');
        console.log('Request user:', req.user);
        console.log('Request body:', req.body);
        
        const postData = {
            ...req.body,
            author: req.user._id
        };
        
        console.log('Post data to save:', postData);

        // If there's an image, upload it to VK
        if (req.file) {
            try {
                const { url, vkPhotoId } = await vkUploader.uploadImage(req.file.buffer);
                postData.imageUrl = url;
                postData.vkPhotoId = vkPhotoId;
                
                // Verify the photo was saved
                const isPhotoSaved = await vkUploader.verifyPhoto(vkPhotoId);
                if (!isPhotoSaved) {
                    throw new Error('Failed to verify photo upload');
                }
            } catch (error) {
                console.error('Error uploading image to VK:', error);
                return res.status(400).json({ error: 'Failed to upload image' });
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
        res.status(400).json({ 
            error: error.message,
            details: error.errors ? Object.values(error.errors).map(e => e.message) : undefined
        });
    }
});

// Get all posts
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find({})
            .populate('author', 'username')
            .sort({ createdAt: -1 });
        res.send(posts);
    } catch (error) {
        res.status(500).send();
    }
});

// Update a post
router.patch('/:id', protect, upload.single('image'), async (req, res) => {
    try {
        console.log('=== Update Post Debug ===');
        console.log('Request user:', req.user);
        console.log('Request body:', req.body);
        console.log('Post ID:', req.params.id);

        const post = await Post.findOne({ _id: req.params.id, author: req.user._id });
        
        if (!post) {
            console.log('Post not found or user not authorized');
            return res.status(404).json({ error: 'Post not found or not authorized' });
        }

        const updates = Object.keys(req.body);
        const allowedUpdates = ['headline', 'text'];
        const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

        if (!isValidOperation) {
            console.log('Invalid updates requested:', updates);
            return res.status(400).json({ error: 'Invalid updates!' });
        }

        // If there's a new image, upload it to VK
        if (req.file) {
            try {
                const { url, vkPhotoId } = await vkUploader.uploadImage(req.file.buffer);
                post.imageUrl = url;
                post.vkPhotoId = vkPhotoId;
                
                // Verify the photo was saved
                const isPhotoSaved = await vkUploader.verifyPhoto(vkPhotoId);
                if (!isPhotoSaved) {
                    throw new Error('Failed to verify photo upload');
                }
            } catch (error) {
                console.error('Error uploading image to VK:', error);
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
        const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.user._id });
        
        if (!post) {
            return res.status(404).send();
        }
        
        res.send(post);
    } catch (error) {
        res.status(500).send();
    }
});

module.exports = router; 