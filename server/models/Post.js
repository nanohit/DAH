const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    headline: {
        type: String,
        required: true,
        trim: true
    },
    text: {
        type: String,
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Post', postSchema);
