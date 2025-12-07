const express = require('express');
const router = express.Router();
const TLMap = require('../models/TLMap');
const { protect, optionalAuth } = require('../middleware/auth');

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
      name: name || 'Untitled TL Map',
      snapshot,
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
      .select('name isPrivate lastSaved createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json(maps);
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
      .populate('user', 'username badge');

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

    res.json(map);
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
    if (snapshot !== undefined) map.snapshot = snapshot;
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
