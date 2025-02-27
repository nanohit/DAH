const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const auth = require('../middleware/auth');

// Create a new post
router.post('/', auth, async (req, res) => {
    try {
        const post = new Post({
            ...req.body,
            author: req.user._id
        });
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
router.patch('/:id', auth, async (req, res) => {
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

        updates.forEach((update) => post[update] = req.body[update]);
        await post.save();
        await post.populate('author', 'username');
        res.send(post);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Delete a post
router.delete('/:id', auth, async (req, res) => {
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
