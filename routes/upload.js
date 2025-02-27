const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage } = require('../utils/imageUpload');
const { protect } = require('../middleware/auth');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Route to handle image upload
router.post('/', protect, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        const result = await uploadImage(req.file.buffer);

        if (result.success) {
            res.json({
                success: true,
                imageUrl: result.imageUrl,
                deleteUrl: result.deleteUrl
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to upload image',
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error in upload route:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router; 