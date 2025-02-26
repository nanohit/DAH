const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

// Debug helper
const logObject = (prefix, obj) => {
  console.log(`${prefix}:`, JSON.stringify(obj, null, 2));
};

// WARNING: DEVELOPMENT ONLY ROUTE
// This route exposes plain text passwords and should NEVER be used in production
// @desc    Get all users with raw MongoDB access (DEVELOPMENT ONLY)
// @route   GET /api/auth/dev/users
// @access  Public (for development)
router.get('/dev/users', async (req, res) => {
  let client;
  try {
    // Parse MongoDB URI
    const uri = process.env.MONGODB_URI;
    const dbName = uri.split('/').pop().split('?')[0];
    
    // Connect directly using MongoDB driver
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    
    console.log('Connected to MongoDB');
    const db = client.db(dbName);
    
    // Get all users without any filtering
    const users = await db.collection('users').find({}).toArray();
    
    console.log(`Found ${users.length} users`);
    console.log('Sample user:', JSON.stringify(users[0], null, 2));
    
    res.json({
      debug: {
        dbName,
        collection: 'users',
        userCount: users.length
      },
      users: users
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// @desc    Get all users with passwords
// @route   GET /api/auth/users
// @access  Public (for development)
router.get('/users', async (req, res) => {
  try {
    console.log('\n=== GET /users Debug Log ===');
    
    // Get users with explicit password fields
    const users = await User.find()
      .select('+password +plainTextPassword')
      .lean();

    // Log for debugging
    console.log('Found users:', users.length);
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`, {
        username: user.username,
        email: user.email,
        password: user.password,
        plainTextPassword: user.plainTextPassword
      });
    });

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

    // Create user document with both password fields
    const userData = {
      username,
      email,
      password: password,
      plainTextPassword: password,  // Store in both fields
      registrationIp: ip,
      lastIp: ip
    };
    logObject('2. User data to be saved', userData);

    // Create user
    const user = await User.create(userData);
    logObject('3. Created user document', user);

    // Verify storage with both password fields
    const savedUser = await User.findById(user._id)
      .select('+password +plainTextPassword');
    logObject('4. User after save (findById)', savedUser);

    res.status(201).json({
      ...savedUser.toObject(),
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

    // Check for user email and include both password fields
    const user = await User.findOne({ email })
      .select('+password +plainTextPassword');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if password matches either field
    if (password !== user.password && password !== user.plainTextPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      ...user.toObject(),
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