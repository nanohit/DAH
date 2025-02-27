const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book'
  },
  content: {
    type: String,
    required: [true, 'Please add a comment'],
    trim: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ]
}, {
  timestamps: true
});

// Ensure a comment belongs to either a post or a book, but not both
CommentSchema.pre('validate', function(next) {
  if ((this.post && this.book) || (!this.post && !this.book)) {
    next(new Error('Comment must belong to either a post or a book, but not both'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Comment', CommentSchema);
