const mongoose = require('mongoose');

// TLMap schema - stores tldraw canvas state
const TLMapSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a map name'],
    trim: true,
    default: 'Untitled Map'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  // Store the entire tldraw snapshot as a flexible object
  snapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  lastSaved: {
    type: Date,
    default: Date.now
  },
  comments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment'
    }
  ]
}, {
  timestamps: true,
  // Keep empty objects (like tldraw meta) so JSON stays valid
  minimize: false
});

// Add index for user queries
TLMapSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('TLMap', TLMapSchema);
