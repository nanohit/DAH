const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    headline: {
        type: String,
        required: true,
        trim: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    imageUrl: {
        type: String,
        trim: true
    },
    vkPhotoId: {
        type: String,
        trim: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Post', postSchema); 