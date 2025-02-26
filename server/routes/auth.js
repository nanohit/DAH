const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const mongoose = require('mongoose');

// Debug helper
const logObject = (prefix, obj) => {
  console.log(`${prefix}:`, JSON.stringify(obj, null, 2));
};

// WARNING: DEVELOPMENT ONLY ROUTE
// This route exposes plain text passwords and should NEVER be used in production
// @desc    Get all users (including passwords for development)
// @route   GET /api/auth/users
// @access  Public (for development)
router.get('/users', async (req, res) => {
  try {
    console.log('\n=== GET /users Debug Log ===');
    console.warn('WARNING: Exposing plain text passwords - Development Only!');
    
    // Get raw MongoDB data with explicit password inclusion
    const users = await User.find()
      .select('+password')  // Explicitly include password
      .lean()  // Convert to plain JavaScript objects
      .exec();

    logObject('Users with passwords', users);
    res.json(users);
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
    console.log('\n=== POST /register Debug Log ===');
    logObject('1. Request body', req.body);
    
    const { username, email, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Check existing user
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log('User already exists for email:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user document
    const userData = {
      username,
      email,
      password,
      registrationIp: ip,
      lastIp: ip
    };
    logObject('2. User data to be saved', userData);

    // Create user
    const user = await User.create(userData);
    logObject('3. Created user document', user);

    // Verify storage
    const savedUser = await User.findById(user._id);
    logObject('4. User after save (findById)', savedUser);

    // Direct MongoDB verification
    const db = mongoose.connection;
    const rawUser = await db.collection('users').findOne({ _id: user._id });
    logObject('5. Raw user from MongoDB', rawUser);

    res.status(201).json({
      ...rawUser,
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