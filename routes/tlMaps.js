const express = require('express');
const router = express.Router();
const TLMap = require('../models/TLMap');
const { protect, optionalAuth } = require('../middleware/auth');
const Comment = require('../models/Comment');

/**
 * Sanitize tldraw snapshot on the server.
 * 
 * IMPORTANT: tldraw's getSnapshot returns { document, session } where:
 * - document: { store: { [id]: record }, schema: {...} }
 * - session: { store: { [id]: record }, schema: {...} }
 * 
 * The store is a FLAT object mapping record IDs to records.
 * DO NOT wrap it in a { records: ... } object - that breaks loading!
 */
const sanitizeSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  
  let safe;
  try {
    safe = JSON.parse(JSON.stringify(snapshot));
  } catch (e) {
    return snapshot;
  }

  // Helper to ensure meta exists on all records in a store
  const ensureRecordMeta = (store) => {
    if (!store || typeof store !== 'object') return;
    
    for (const [id, record] of Object.entries(store)) {
      if (record && typeof record === 'object') {
        // Ensure meta exists
        if (record.meta === undefined || record.meta === null) {
          record.meta = {};
        }
        // Ensure typeName exists based on ID prefix
        if (record.typeName === undefined) {
          const prefix = id.split(':')[0];
          const typeMap = {
            'document': 'document',
            'page': 'page',
            'shape': 'shape',
            'asset': 'asset',
            'instance': 'instance',
            'instance_page_state': 'instance_page_state',
            'pointer': 'pointer',
            'camera': 'camera',
            'binding': 'binding',
          };
          if (typeMap[prefix]) {
            record.typeName = typeMap[prefix];
          }
        }
      }
    }
  };

  // Patch document store records
  if (safe.document?.store) {
    ensureRecordMeta(safe.document.store);
  }

  // Patch session store records
  if (safe.session?.store) {
    ensureRecordMeta(safe.session.store);
  }

  return safe;
};

// @desc    Create a new TL map
// @route   POST /api/tl-maps
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, snapshot, isPrivate } = req.body;

    if (!snapshot) {
      return res.status(400).json({ message: 'Snapshot data is required' });
    }

    const tlMap = new TLMap({
      user: req.user.id,
      name: name || 'Untitled Map',
      snapshot: sanitizeSnapshot(snapshot),
      isPrivate: isPrivate || false
    });

    const savedMap = await tlMap.save();
    console.log(`[TL-MAPS] Created new TL map: ${savedMap._id}`);
    
    res.status(201).json(savedMap);
  } catch (error) {
    console.error('Error creating TL map:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Get all TL maps for current user
// @route   GET /api/tl-maps
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const maps = await TLMap.find({ user: req.user.id })
      .select('name isPrivate lastSaved createdAt updatedAt user comments')
      .populate('user', 'username badge')
      .sort({ updatedAt: -1 })
      .lean();

    const ids = maps.map((m) => m._id);
    const commentCounts = await Comment.aggregate([
      { $match: { tlMap: { $in: ids } } },
      { $group: { _id: '$tlMap', count: { $sum: 1 } } }
    ]);
    const countsMap = new Map(commentCounts.map((c) => [String(c._id), c.count]));

    const response = maps.map((m) => ({
      ...m,
      commentsCount: countsMap.get(String(m._id)) || 0,
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching TL maps:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Get a single TL map by ID
// @route   GET /api/tl-maps/:id
// @access  Private/Public (based on map visibility)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const map = await TLMap.findById(req.params.id)
      .populate('user', 'username badge')
      .lean();

    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }

    // Check if map is private and user is not the owner
    if (map.isPrivate) {
      if (!req.user || map.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'This map is private',
          isPrivate: true
        });
      }
    }

    const commentsCount = await Comment.countDocuments({ tlMap: map._id });

    res.json({
      ...map,
      snapshot: sanitizeSnapshot(map.snapshot),
      commentsCount,
    });
  } catch (error) {
    console.error('Error fetching TL map:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Map not found' });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Update a TL map
// @route   PUT /api/tl-maps/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    let map = await TLMap.findById(req.params.id);

    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }

    // Check if user owns the map
    if (map.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to update this map' });
    }

    const { name, snapshot, isPrivate } = req.body;

    // Update fields
    if (name !== undefined) map.name = name;
    if (snapshot !== undefined) map.snapshot = sanitizeSnapshot(snapshot);
    if (typeof isPrivate === 'boolean') map.isPrivate = isPrivate;
    map.lastSaved = Date.now();

    const updatedMap = await map.save();
    console.log(`[TL-MAPS] Updated TL map: ${updatedMap._id}`);

    res.json(updatedMap);
  } catch (error) {
    console.error('Error updating TL map:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Map not found' });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Delete a TL map
// @route   DELETE /api/tl-maps/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const map = await TLMap.findById(req.params.id);

    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }

    // Check if user is admin or owns the map
    if (!req.user.isAdmin && map.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this map' });
    }

    await TLMap.findByIdAndDelete(req.params.id);
    console.log(`[TL-MAPS] Deleted TL map: ${req.params.id}`);

    res.json({ message: 'TL Map removed' });
  } catch (error) {
    console.error('Error deleting TL map:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Map not found' });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
