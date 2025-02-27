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
        const postData = {
            ...req.body,
            author: req.user._id
        };

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
        await post.save();
        await post.populate('author', 'username');
        res.status(201).send(post);
    } catch (error) {
        res.status(400).send(error);
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
        const post = await Post.findOne({ _id: req.params.id, author: req.user._id });
        
        if (!post) {
            return res.status(404).send();
        }

        const updates = Object.keys(req.body);
        const allowedUpdates = ['headline', 'text'];
        const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).send({ error: 'Invalid updates!' });
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
        await post.save();
        await post.populate('author', 'username');
        res.send(post);
    } catch (error) {
        res.status(400).send(error);
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