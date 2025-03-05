// Debug logging for route registration
console.log('Registering auth routes...');

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

// Log all requests to auth routes
router.use((req, res, next) => {
  console.log('\n=== Auth Route Request ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Debug helper
const logObject = (prefix, obj) => {
  console.log(`${prefix}:`, JSON.stringify(obj, null, 2));
};

// @desc    Test route
// @route   GET /api/auth/test
// @access  Public
router.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Auth routes are working' });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  console.log('\n=== /me Route Debug ===');
  console.log('1. User from middleware:', {
    exists: !!req.user,
    id: req.user?._id,
    username: req.user?.username
  });
  
  try {
    console.log('2. Attempting database query with ID:', req.user._id);
    const user = await User.findById(req.user._id).select('-password');
    console.log('3. Database query result:', user ? {
      found: true,
      id: user._id,
      username: user.username,
      email: user.email
    } : {
      found: false,
      queriedId: req.user._id
    });

    if (!user) {
      console.log('4. User not found in database');
      return res.status(404).json({ 
        message: 'User not found',
        debug: {
          queriedId: req.user._id,
          tokenData: req.user
        }
      });
    }

    console.log('5. Successfully retrieved user data');
    res.json(user);
  } catch (error) {
    console.error('6. Error in /me route:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Server Error',
      error: error.message
    });
  }
});

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
    console.log('Fetching all users with password field...');
    const users = await User.find().select('+password');
    console.log(`Found ${users.length} users`);
    users.forEach(user => {
      console.log(`User ${user.username}:`, {
        _id: user._id,
        username: user.username,
        email: user.email,
        hasPassword: !!user.password,
        passwordLength: user.password ? user.password.length : 0,
        password: user.password,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// @desc    Register a user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Check existing user
    const userExists = await User.findOne({ 
      $or: [
        { email },
        { username }
      ]
    });
    
    if (userExists) {
      const field = userExists.email === email ? 'email' : 'username';
      return res.status(400).json({ message: `User with this ${field} already exists` });
    }

    // Create user document
    const user = await User.create({
      username,
      email,
      password,
      registrationIp: ip,
      lastIp: ip,
      isAdmin: false
    });

    // Return user data with token
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
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
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Please provide login credentials' });
    }

    // Check for user by email or username
    const user = await User.findOne({
      $or: [
        { email: login },
        { username: login }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server Error' });
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

// @desc    Update user password
// @route   PUT /api/auth/users/:id/password
// @access  Public (for development)
router.put('/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = password;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Delete a user
// @route   DELETE /api/auth/users/:id
// @access  Public (for development)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.deleteOne();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update user admin status and badge
// @route   POST /api/auth/update-user-role
// @access  Public (for development)
router.post('/update-user-role', async (req, res) => {
  try {
    const { username, password, isAdmin, badge } = req.body;

    // Find user by username
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Update user
    user.isAdmin = isAdmin;
    user.badge = badge;
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      badge: user.badge
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Log all registered routes
console.log('\n=== Registered Auth Routes ===');
router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`${Object.keys(r.route.methods).join(', ').toUpperCase()}\t${r.route.path}`);
  }
});

module.exports = router; 