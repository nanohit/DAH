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
  map: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Map'
  },
  tlMap: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TLMap'
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
  ],
  dislikes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ]
}, {
  timestamps: true
});

// Ensure a comment belongs to either a post, book, or map, but not multiple
CommentSchema.pre('validate', function(next) {
  const hasPost = this.post != null;
  const hasBook = this.book != null;
  const hasMap = this.map != null;
  const hasTlMap = this.tlMap != null;
  
  const sourceCount = (hasPost ? 1 : 0) + (hasBook ? 1 : 0) + (hasMap ? 1 : 0) + (hasTlMap ? 1 : 0);
  
  if (sourceCount !== 1) {
    next(new Error('Comment must belong to exactly one of: post, book, map, or canvas map'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Comment', CommentSchema);
