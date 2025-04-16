const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a book title'],
    trim: true
  },
  author: {
    type: String,
    required: [true, 'Please add an author'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    trim: true
  },
  coverImage: {
    type: String,
    default: 'https://via.placeholder.com/300x400?text=No+Cover'
  },
  publishedYear: {
    type: Number
  },
  genres: [
    {
      type: String,
      trim: true
    }
  ],
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  comments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment'
    }
  ],
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  // New fields for download links
  downloadLinks: {
    epub: String,
    pdf: String,
    online: String
  },
  flibustaStatus: {
    type: String,
    enum: ['not_checked', 'checking', 'found', 'not_found', 'uploaded'],
    default: 'not_checked'
  },
  flibustaLastChecked: {
    type: Date
  },
  flibustaVariants: [{
    title: String,
    author: String,
    formats: [{
      format: String,
      url: String
    }],
    sourceId: String
  }],
  // VK Storage fields
  vkDocuments: [{
    format: {
      type: String,
      enum: ['epub', 'fb2', 'mobi', 'pdf']
    },
    docId: String,
    ownerId: String,
    url: String,
    directUrl: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    lastChecked: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'deleted', 'error'],
      default: 'active'
    }
  }],
  // Add bookmarks array to the Book schema
  bookmarks: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Add text index for efficient text search with weights
BookSchema.index({ 
  title: 'text'
}, {
  name: "BookTitleIndex"
});

// Add compound index for sorting and filtering
BookSchema.index({ 
  createdAt: -1,
  publishedYear: -1 
});

module.exports = mongoose.model('Book', BookSchema);
