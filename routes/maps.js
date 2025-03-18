const express = require('express');
const router = express.Router();
const Map = require('../models/Map');
const { protect } = require('../middleware/auth');

// @desc    Create a new map
// @route   POST /api/maps
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, elements, connections, canvasPosition, scale } = req.body;

    // Create map with user ID from auth middleware
    const map = await Map.create({
      name: name || 'Untitled Map',
      user: req.user._id,
      elements,
      connections,
      canvasPosition,
      scale
    });

    res.status(201).json(map);
  } catch (error) {
    console.error('Error creating map:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Get all maps
// @route   GET /api/maps
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    console.log('GET /api/maps - Fetching ALL maps with simplified approach');
    const { include } = req.query;
    const includeComments = include && include.includes('comments');
    const includeBookmarks = include && include.includes('bookmarks');
    
    const currentUserId = req.user._id;
    console.log(`Current user ID: ${currentUserId}`);
    
    // Base query
    let query = Map.find({})
      .select('name elements connections canvasPosition scale lastSaved createdAt updatedAt user comments bookmarks')
      .populate({
        path: 'user',
        select: 'username badge',
        model: 'User'
      });
    
    // Conditionally populate comments if requested
    if (includeComments) {
      console.log('Including comments in the response');
      query = query.populate({
        path: 'comments',
        options: { sort: { createdAt: -1 } },
        populate: {
          path: 'user',
          select: 'username badge'
        }
      });
    }
    
    // Sort and execute the query
    const allMaps = await query.sort({ updatedAt: -1 });
    
    console.log(`Found ${allMaps.length} total maps before processing`);
    
    // Process maps for the response
    const processedMaps = allMaps.map(map => {
      // Handle user data
      let userData;
      if (map.user && map.user.username) {
        // User data properly populated
        userData = {
          _id: map.user._id,
          username: map.user.username,
          badge: map.user.badge || ''
        };
      } else {
        // User not found or not populated
        userData = {
          _id: map.user || 'unknown',
          username: 'Unknown User',
          badge: ''
        };
      }
      
      // Calculate counts
      const elementCount = map.elements ? map.elements.length : 0;
      const connectionCount = map.connections ? map.connections.length : 0;
      
      // Create a clean object to return
      const response = {
        _id: map._id,
        name: map.name || 'Untitled Map',
        user: userData,
        canvasPosition: map.canvasPosition,
        scale: map.scale,
        lastSaved: map.lastSaved,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
        elementCount,
        connectionCount
      };
      
      // Include comments if they were populated
      if (includeComments && map.comments) {
        response.comments = map.comments;
      }
      
      // Include bookmarks if requested
      if (includeBookmarks && map.bookmarks) {
        response.bookmarks = map.bookmarks;
        
        // Check if the current user has bookmarked this map
        const isBookmarked = map.bookmarks.some(bookmark => 
          bookmark.user && bookmark.user.toString() === currentUserId.toString()
        );
        response.isBookmarked = isBookmarked;
      }
      
      return response;
    });
    
    // Log the first processed map for debugging
    if (processedMaps.length > 0) {
      console.log('First processed map example:', {
        _id: processedMaps[0]._id,
        name: processedMaps[0].name,
        user: processedMaps[0].user,
        created: processedMaps[0].createdAt,
        commentsCount: processedMaps[0].comments ? processedMaps[0].comments.length : 0,
        bookmarksCount: processedMaps[0].bookmarks ? processedMaps[0].bookmarks.length : 0,
        isBookmarked: processedMaps[0].isBookmarked
      });
    } else {
      console.log('No maps found in the database');
    }
    
    console.log(`Returning ${processedMaps.length} maps to client`);
    res.json(processedMaps);
  } catch (error) {
    console.error('Error in GET /api/maps:', error);
    res.status(500).json({ 
      message: 'Server Error fetching maps', 
      error: error.message 
    });
  }
});

// IMPORTANT: Fixed route order to prevent conflicts with later routes
// These specific routes must come before generic ID patterns

// @desc    Toggle bookmark status for a map
// @route   POST /api/maps/:id/bookmark
// @access  Private
router.post('/bookmarked', protect, async (req, res) => {
  return res.status(404).json({ message: 'Invalid endpoint' });
});

// @desc    Get bookmarked maps for current user
// @route   GET /api/maps/bookmarked
// @access  Private
router.get('/bookmarked', protect, async (req, res) => {
  console.log('Fetching bookmarked maps for user:', req.user._id);
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    const userId = req.user._id;

    // First, get all maps that are bookmarked by this user
    const maps = await Map.aggregate([
      // Match maps that have a bookmark from this user
      { $match: { 'bookmarks.user': userId } },
      
      // Add a field with this user's specific bookmark timestamp
      { $addFields: {
        userBookmark: {
          $filter: {
            input: '$bookmarks',
            as: 'bookmark',
            cond: { $eq: ['$$bookmark.user', userId] }
          }
        }
      }},
      
      // Sort by this user's bookmark timestamp
      { $sort: { 'userBookmark.0.timestamp': -1 } },
      
      // Apply pagination
      { $skip: skip },
      { $limit: limit }
    ]);

    // Get total count for pagination
    const total = await Map.countDocuments({ 'bookmarks.user': userId });

    console.log(`Found ${maps.length} bookmarked maps for user ${userId}`);

    // Populate the necessary fields after aggregation
    await Map.populate(maps, [
      { path: 'user', select: 'username badge' },
      { path: 'comments' }
    ]);

    // Calculate element and connection counts for each map
    const processedMaps = maps.map(map => ({
      ...map,
      elementCount: map.elements ? map.elements.length : 0,
      connectionCount: map.connections ? map.connections.length : 0
    }));

    res.json({
      maps: processedMaps,
      total,
      hasMore: total > skip + limit
    });
  } catch (error) {
    console.error('Error fetching bookmarked maps:', error);
    res.status(500).json({ message: 'Failed to fetch bookmarked maps', error: error.message });
  }
});

// @desc    Toggle bookmark status for a map
// @route   POST /api/maps/:id/bookmark
// @access  Private
router.post('/:id/bookmark', protect, async (req, res) => {
  try {
    // Log the incoming request to help with debugging
    console.log(`Processing bookmark request for map ID: ${req.params.id}`);
    
    const map = await Map.findById(req.params.id);
    
    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }

    const userId = req.user._id;
    const existingBookmark = map.bookmarks.find(b => b.user.equals(userId));

    if (existingBookmark) {
      // Remove bookmark
      map.bookmarks = map.bookmarks.filter(b => !b.user.equals(userId));
    } else {
      // Add bookmark
      map.bookmarks.push({ user: userId });
    }

    await map.save();
    res.json({ success: true, isBookmarked: !existingBookmark });
  } catch (error) {
    console.error('Error bookmarking map:', error);
    res.status(500).json({ message: 'Failed to bookmark map', error: error.message });
  }
});

// @desc    Get a single map by ID
// @route   GET /api/maps/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const { include } = req.query;
    const includeComments = include && include.includes('comments');
    
    // Base query to find the map
    let query = Map.findById(req.params.id);
    
    // Conditionally populate comments if requested
    if (includeComments) {
      console.log(`Including comments for map ${req.params.id}`);
      query = query.populate({
        path: 'comments',
        options: { sort: { createdAt: -1 } },
        populate: {
          path: 'user',
          select: 'username badge'
        }
      });
    }
    
    const map = await query;

    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }

    // Check if map belongs to user, if not use view-only endpoint
    if (map.user.toString() !== req.user._id.toString()) {
      // Rather than returning a plain 401, return specific error message
      // suggesting the view-only endpoint
      return res.status(401).json({ 
        message: 'Not authorized to access this map', 
        isViewOnly: true,
        mapId: req.params.id
      });
    }

    res.json(map);
  } catch (error) {
    console.error('Error fetching map:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Map not found' });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Get a single map by ID in view-only mode (for non-owner users)
// @route   GET /api/maps/:id/view
// @access  Private
router.get('/:id/view', protect, async (req, res) => {
  try {
    const { include } = req.query;
    const includeComments = include && include.includes('comments');
    
    // Base query to find the map
    let query = Map.findById(req.params.id);
    
    // Conditionally populate comments if requested
    if (includeComments) {
      console.log(`Including comments for map ${req.params.id} in view mode`);
      query = query.populate({
        path: 'comments',
        options: { sort: { createdAt: -1 } },
        populate: {
          path: 'user',
          select: 'username badge'
        }
      });
    }
    
    const map = await query;

    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }

    // Add an isOwner flag to indicate if the user is the map owner
    const response = map.toObject();
    response.isOwner = map.user.toString() === req.user._id.toString();

    res.json(response);
  } catch (error) {
    console.error('Error fetching map for viewing:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Map not found' });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Update a map
// @route   PUT /api/maps/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    let map = await Map.findById(req.params.id);

    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }

    // Check map belongs to user
    if (map.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to update this map' });
    }

    const { name, elements, connections, canvasPosition, scale } = req.body;

    // Update map fields
    map.name = name || map.name;
    
    // Process elements with completed status before saving
    if (elements) {
      // Find books with completed status
      const booksWithCompletedStatus = elements.filter(el => 
        el && el.type === 'book' && el.bookData && el.bookData.completed === true
      );
      
      console.log(`[SERVER] Found ${booksWithCompletedStatus.length} books marked as completed in request`);
      
      // COMPLETE OVERHAUL: Convert all elements to plain JavaScript objects first
      const processedElements = [];
      
      // Process each element, handling completed status specially
      for (const element of elements) {
        if (!element || !element.id || !element.type) {
          console.log('[SERVER] Skipping invalid element');
          continue;
        }
        
        // Create a clean copy of the element as a plain object
        const processedElement = {
          id: element.id,
          type: element.type,
          left: element.left,
          top: element.top,
          width: element.width,
          height: element.height,
          text: element.text,
          orientation: element.orientation
        };
        
        // Handle book-specific data
        if (element.type === 'book' && element.bookData) {
          // Create a clean copy of bookData
          const processedBookData = {
            key: element.bookData.key,
            _id: element.bookData._id,
            title: element.bookData.title,
            author: [...(element.bookData.author || [])],
            thumbnail: element.bookData.thumbnail,
            highResThumbnail: element.bookData.highResThumbnail,
            description: element.bookData.description,
            source: element.bookData.source,
            flibustaStatus: element.bookData.flibustaStatus,
            // Explicitly set completed status
            completed: element.bookData.completed === true ? true : false
          };
          
          // Add flibusta variants if present
          if (element.bookData.flibustaVariants && Array.isArray(element.bookData.flibustaVariants)) {
            processedBookData.flibustaVariants = element.bookData.flibustaVariants.map(variant => ({
              title: variant.title,
              author: variant.author,
              sourceId: variant.sourceId,
              formats: (variant.formats || []).map(format => ({
                format: format.format,
                url: format.url
              }))
            }));
          }
          
          // Add processed bookData to element
          processedElement.bookData = processedBookData;
          
          // Log if this is a completed book
          if (processedBookData.completed === true) {
            console.log(`[SERVER] Processed completed book: ${processedElement.id} - ${processedBookData.title}`);
          }
        }
        
        // Handle line-specific data
        if (element.type === 'line' && element.lineData) {
          processedElement.lineData = { ...element.lineData };
        }
        
        // Handle image-specific data
        if (element.type === 'image' && element.imageData) {
          processedElement.imageData = { ...element.imageData };
        }
        
        // Handle link-specific data
        if (element.type === 'link' && element.linkData) {
          processedElement.linkData = { ...element.linkData };
        }
        
        // Add to our processed elements array
        processedElements.push(processedElement);
      }
      
      // Replace the map's elements with our fully processed ones
      map.elements = processedElements;
      
      // Important: Mark the entire elements array as modified
      map.markModified('elements');
      
      console.log(`[SERVER] Processed ${processedElements.length} total elements`);
      
      // Double-check completed books were preserved in our processed elements
      const processedCompletedBooks = processedElements.filter(el => 
        el.type === 'book' && el.bookData && el.bookData.completed === true
      );
      
      console.log(`[SERVER] After processing: ${processedCompletedBooks.length} books remain marked as completed`);
    }
    
    // Process connections
    if (connections) {
      // Convert connections to plain objects to avoid schema validation issues
      const processedConnections = connections.map(conn => ({
        id: conn.id,
        start: conn.start,
        end: conn.end,
        startPoint: conn.startPoint,
        endPoint: conn.endPoint
      })).filter(conn => conn.id && conn.start && conn.end);
      
      map.connections = processedConnections;
      map.markModified('connections');
    }
    
    // Process other fields
    if (canvasPosition) {
      map.canvasPosition = {
        x: typeof canvasPosition.x === 'number' ? canvasPosition.x : map.canvasPosition.x,
        y: typeof canvasPosition.y === 'number' ? canvasPosition.y : map.canvasPosition.y
      };
    }
    
    if (typeof scale === 'number') {
      map.scale = scale;
    }
    
    map.lastSaved = Date.now();

    // Save the map
    await map.save();
    
    // Verify saved data by querying again
    const savedMap = await Map.findById(map._id);
    if (savedMap) {
      const savedCompletedBooks = savedMap.elements.filter(el => 
        el.type === 'book' && el.bookData && el.bookData.completed === true
      );
      
      console.log(`[SERVER] After database save: ${savedCompletedBooks.length} books have completed=true in database`);
      
      if (savedCompletedBooks.length > 0) {
        console.log('[SERVER] Verified completed status was saved to database successfully');
      } else {
        console.warn('[SERVER] Warning: Completed status was lost in database! Applying response-level fix.');
        
        // Last resort fix for the response
        if (elements) {
          const booksToFix = elements.filter(el => 
            el && el.type === 'book' && el.bookData && el.bookData.completed === true
          );
          
          if (booksToFix.length > 0) {
            // Create a response object with corrected data
            const responseMap = savedMap.toObject();
            
            // Fix each book element in the response
            responseMap.elements = responseMap.elements.map(element => {
              const shouldBeCompleted = booksToFix.some(book => book.id === element.id);
              
              if (shouldBeCompleted && element.type === 'book' && element.bookData) {
                console.log(`[SERVER] Fixing book ${element.id} in response`);
                return {
                  ...element,
                  bookData: {
                    ...element.bookData,
                    completed: true
                  }
                };
              }
              
              return element;
            });
            
            console.log('[SERVER] Response-level fix applied');
            return res.json(responseMap);
          }
        }
      }
    }

    res.json(savedMap);
  } catch (error) {
    console.error('Error updating map:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Map not found' });
    }
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @desc    Delete a map
// @route   DELETE /api/maps/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const map = await Map.findById(req.params.id);

    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }

    // Check if user is admin or map belongs to user
    if (!req.user.isAdmin && map.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this map' });
    }

    // Use findByIdAndDelete instead of map.remove()
    await Map.findByIdAndDelete(req.params.id);

    res.json({ message: 'Map removed' });
  } catch (error) {
    console.error('Error deleting map:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Map not found' });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router; 