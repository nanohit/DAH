const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

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
    
    // Get users with explicit password fields and all other fields
    const users = await User.find()
      .select('+password')
      .lean();
    
    // Log for debugging
    console.log('Found users:', users.length);
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`, {
        _id: user._id,
        username: user.username,
        email: user.email,
        hasPassword: !!user.password,
        passwordLength: user.password?.length,
        password: user.password,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    });

    // Send response with full user data
    res.json({
      count: users.length,
      users: users.map(user => ({
        ...user,
        hasPassword: !!user.password,
        passwordLength: user.password?.length
      }))
    });
  } catch (error) {
    console.error('Users query error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
});

// @desc    Register a user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    console.log('\n=== POST /register Debug Log ===');
    console.log('1. Raw request body:', {
      ...req.body,
      password: req.body.password ? `[${req.body.password.length} chars]` : '[MISSING]'
    });
    
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
      lastIp: ip,
      isAdmin: false
    };
    console.log('2. User data to be saved:', {
      ...userData,
      password: `[${userData.password.length} chars]`
    });

    // Create user (this will trigger the pre-save hook)
    const user = await User.create(userData);
    console.log('3. Created user document:', {
      _id: user._id,
      username: user.username,
      email: user.email
    });

    // Verify storage with password field
    const savedUser = await User.findById(user._id).select('+password');
    console.log('4. Verification query result:', {
      hasUser: !!savedUser,
      hasPassword: !!savedUser?.password,
      passwordLength: savedUser?.password?.length,
      storedPassword: savedUser?.password
    });

    // For testing purposes, try to match the password immediately after registration
    const loginTest = await savedUser.matchPassword(password);
    console.log('5. Immediate password match test:', loginTest);

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
});

// @desc    Login user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    console.log('\n=== POST /login Debug Log ===');
    console.log('1. Headers:', {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    });
    console.log('2. Raw Body:', {
      ...req.body,
      password: req.body.password ? `[${req.body.password.length} chars]` : '[MISSING]'
    });
    
    const { emailOrUsername, password } = req.body;
    console.log('3. Extracted credentials:', { 
      emailOrUsername, 
      password: password ? `[${password.length} chars]` : '[MISSING]'
    });

    if (!emailOrUsername || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ message: 'Please provide both email/username and password' });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername },
        { username: emailOrUsername }
      ]
    }).select('+password');
    
    console.log('4. User lookup:', user ? {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      matchedBy: user.email === emailOrUsername ? 'email' : 'username',
      hasPassword: !!user.password,
      passwordLength: user.password?.length
    } : 'No user found');
    
    if (!user) {
      console.log('No user found for:', emailOrUsername);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      console.log('No password stored for user');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password match using matchPassword method
    console.log('5. Attempting password match...');
    const isMatch = await user.matchPassword(password);
    console.log('6. Password match result:', isMatch);

    if (!isMatch) {
      console.log('Password match failed');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('7. Login successful, generating token...');
    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
});

// @desc    Get raw user data from MongoDB (DEVELOPMENT ONLY)
// @route   GET /api/auth/dev/user/:username
// @access  Public (for development)
router.get('/dev/user/:username', async (req, res) => {
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
    
    // Get user data without any filtering
    const user = await db.collection('users').findOne({ username: req.params.username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Raw user data:', JSON.stringify(user, null, 2));
    
    res.json({
      debug: {
        dbName,
        collection: 'users'
      },
      user: user
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

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = router; 