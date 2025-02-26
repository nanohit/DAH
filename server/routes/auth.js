const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const mongoose = require('mongoose');

// @desc    Get all users (including passwords for development)
// @route   GET /api/auth/users
// @access  Public (for development)
router.get('/users', async (req, res) => {
  try {
    console.log('1. Starting users query');
    
    // Test regular find
    const normalUsers = await User.find();
    console.log('2. Normal query result:', JSON.stringify(normalUsers[0], null, 2));
    
    // Test lean query
    const leanUsers = await User.find().lean();
    console.log('3. Lean query result:', JSON.stringify(leanUsers[0], null, 2));
    
    // Test explicit projection
    const projectedUsers = await User.find().select('+password');
    console.log('4. Projected query result:', JSON.stringify(projectedUsers[0], null, 2));
    
    // Test direct MongoDB query
    const db = mongoose.connection;
    const directUsers = await db.collection('users').find().toArray();
    console.log('5. Direct MongoDB result:', JSON.stringify(directUsers[0], null, 2));
    
    res.json(directUsers); // Temporarily use direct MongoDB results
  } catch (error) {
    console.error('Users query error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Register a user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Get IP address
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password, // Now stored as plain text
      registrationIp: ip,
      lastIp: ip
    });

    // Convert to plain object to ensure password is included
    const userObject = user.toObject();

    res.status(201).json({
      ...userObject,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
});

// @desc    Login user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if password matches (plain text comparison)
    if (password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Convert to plain object to ensure password is included
    const userObject = user.toObject();

    res.json({
      ...userObject,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = router; 