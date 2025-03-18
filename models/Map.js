const mongoose = require('mongoose');

// Book data schema for element
const BookDataSchema = new mongoose.Schema({
  key: String,
  _id: String,
  title: String,
  author: [String],
  thumbnail: String,
  highResThumbnail: String,
  description: String,
  source: {
    type: String,
    enum: ['openlib', 'google', 'alphy'],
  },
  flibustaStatus: {
    type: String,
    enum: ['not_checked', 'checking', 'found', 'not_found', 'uploaded']
  },
  completed: {
    type: Boolean,
    default: false,
    required: true
  },
  flibustaVariants: [{
    title: String,
    author: String,
    sourceId: String,
    formats: [{
      format: String,
      url: String
    }]
  }]
}, { 
  _id: false, 
  minimize: false, // Prevent Mongoose from removing empty objects
  strict: false,   // Allow fields that aren't in the schema
  id: false        // Don't create an id field
});

// Line data schema for element
const LineDataSchema = new mongoose.Schema({
  startX: Number,
  startY: Number,
  endX: Number,
  endY: Number,
  isDraggingStart: Boolean,
  isDraggingEnd: Boolean
}, { _id: false });

// Image data schema for element
const ImageDataSchema = new mongoose.Schema({
  url: String,
  alt: String
}, { _id: false });

// Link data schema for element
const LinkDataSchema = new mongoose.Schema({
  url: String,
  title: String,
  previewUrl: String,
  description: String,
  siteName: String,
  favicon: String,
  displayUrl: String,
  image: String,
  youtubeVideoId: String
}, { _id: false });

// Map element schema
const MapElementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['element', 'book', 'line', 'image', 'link'],
    required: true 
  },
  left: { type: Number, required: true },
  top: { type: Number, required: true },
  width: Number,
  height: Number,
  text: { type: String, required: true },
  orientation: {
    type: String,
    enum: ['horizontal', 'vertical'],
    required: true
  },
  bookData: BookDataSchema,
  lineData: LineDataSchema,
  imageData: ImageDataSchema,
  linkData: LinkDataSchema
}, { _id: false });

// Connection schema
const ConnectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
  startPoint: {
    type: String,
    enum: ['top', 'right', 'bottom', 'left']
  },
  endPoint: {
    type: String,
    enum: ['top', 'right', 'bottom', 'left']
  }
}, { _id: false });

// Main Map schema
const MapSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a map name'],
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  elements: [MapElementSchema],
  connections: [ConnectionSchema],
  canvasPosition: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  scale: {
    type: Number,
    default: 1
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
  ],
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

// Add a pre-save hook to check for books with completed status
MapSchema.pre('save', function(next) {
  console.log('[MODEL] Pre-save hook triggered');
  
  try {
    // Check for books with completed status
    const booksWithCompletedStatus = this.elements.filter(el => 
      el.type === 'book' && el.bookData && el.bookData.completed === true
    );
    
    if (booksWithCompletedStatus.length > 0) {
      console.log(`[MODEL] Pre-save: Found ${booksWithCompletedStatus.length} books marked as completed`);
      console.log(`[MODEL] Pre-save: First completed book:`, JSON.stringify(booksWithCompletedStatus[0].bookData, null, 2));
      
      // Explicitly ensure the completed field is set and paths are marked as modified
      booksWithCompletedStatus.forEach(book => {
        const idx = this.elements.indexOf(book);
        if (idx >= 0) {
          // Ensure the field value is explicitly Boolean true
          this.elements[idx].bookData.completed = true;
          
          // Mark the path as modified to ensure Mongoose saves it
          this.markModified(`elements.${idx}.bookData`);
          this.markModified(`elements.${idx}.bookData.completed`);
          
          console.log(`[MODEL] Pre-save: Marked element ${idx} as modified with completed=${this.elements[idx].bookData.completed}`);
        }
      });
    } else {
      console.log('[MODEL] Pre-save: No books with completed status found');
    }
  } catch (err) {
    console.error('[MODEL] Error in pre-save hook:', err);
  }
  
  next();
});

// Add a post-save hook to verify if the completed status was preserved
MapSchema.post('save', function(doc) {
  console.log('[MODEL] Post-save hook triggered');
  
  try {
    // Check if the completed status was preserved
    const booksWithCompletedStatus = doc.elements.filter(el => 
      el.type === 'book' && el.bookData && el.bookData.completed === true
    );
    
    if (booksWithCompletedStatus.length > 0) {
      console.log(`[MODEL] Post-save: Preserved ${booksWithCompletedStatus.length} books with completed status`);
      console.log('[MODEL] Post-save: First completed book:', JSON.stringify(booksWithCompletedStatus[0].bookData, null, 2));
    } else {
      console.log('[MODEL] Post-save: No books with completed status found');
      
      // Check if any book elements exist that might have lost their status
      const allBookElements = doc.elements.filter(el => el.type === 'book' && el.bookData);
      if (allBookElements.length > 0) {
        console.log(`[MODEL] Post-save: Found ${allBookElements.length} book elements, but none with completed status`);
        console.log('[MODEL] Post-save: First book element:', JSON.stringify(allBookElements[0].bookData, null, 2));
      }
    }
  } catch (err) {
    console.error('[MODEL] Error in post-save hook:', err);
  }
});

// Add a toJSON transform function to ensure the completed field is included
MapSchema.set('toJSON', {
  transform: function(doc, ret) {
    console.log('[MODEL] toJSON transform called');
    
    // Ensure the completed field is included for all book elements
    if (ret.elements) {
      ret.elements.forEach(element => {
        if (element.type === 'book' && element.bookData) {
          // Make sure completed is explicitly defined
          if (element.bookData.completed === undefined) {
            element.bookData.completed = false;
            console.log(`[MODEL] toJSON: Setting default completed=false for book ${element.id}`);
          } else if (element.bookData.completed === true) {
            console.log(`[MODEL] toJSON: Found completed=true for book ${element.id}`);
          }
        }
      });
    }
    return ret;
  }
});

module.exports = mongoose.model('Map', MapSchema); 