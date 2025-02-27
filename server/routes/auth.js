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
    console.log('1. Raw request body:', req.body);
    
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
      plainTextPassword: password,
      registrationIp: ip,
      lastIp: ip
    };
    console.log('2. User data to be saved:', { ...userData, password: '[HIDDEN]', plainTextPassword: '[HIDDEN]' });

    // Create user
    const user = await User.create(userData);
    console.log('3. Created user document:', {
      _id: user._id,
      username: user.username,
      email: user.email,
      hasPassword: !!user.password,
      hasPlainTextPassword: !!user.plainTextPassword
    });

    // Verify storage with both password fields
    const savedUser = await User.findById(user._id).select('+password +plainTextPassword');
    console.log('4. Verification query result:', {
      hasUser: !!savedUser,
      hasPassword: savedUser ? !!savedUser.password : false,
      hasPlainTextPassword: savedUser ? !!savedUser.plainTextPassword : false,
      passwordLength: savedUser?.password?.length,
      plainTextPasswordLength: savedUser?.plainTextPassword?.length
    });

    // For testing purposes, try to log in immediately after registration
    const loginTest = await User.findOne({ email }).select('+password +plainTextPassword');
    console.log('5. Immediate login test:', {
      hasUser: !!loginTest,
      hasPassword: loginTest ? !!loginTest.password : false,
      hasPlainTextPassword: loginTest ? !!loginTest.plainTextPassword : false,
      passwordsMatch: loginTest ? (loginTest.password === password && loginTest.plainTextPassword === password) : false
    });

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
    console.log('2. Raw Body:', req.body);
    
    const { emailOrUsername, password } = req.body;
    console.log('3. Extracted credentials:', { 
      emailOrUsername, 
      password: password ? '[PRESENT]' : '[MISSING]',
      passwordLength: password?.length
    });

    if (!emailOrUsername || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ message: 'Please provide both email/username and password' });
    }

    // First, try to find the user without password fields
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername },
        { username: emailOrUsername }
      ]
    });
    
    console.log('4. Initial user lookup:', user ? {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      matchedBy: user.email === emailOrUsername ? 'email' : 'username'
    } : 'No user found');
    
    if (!user) {
      console.log('No user found for:', emailOrUsername);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Now fetch the same user with password fields
    const userWithPassword = await User.findById(user._id).select('+password +plainTextPassword');
    console.log('5. User with password fields:', {
      hasUser: !!userWithPassword,
      hasPassword: userWithPassword ? !!userWithPassword.password : false,
      hasPlainTextPassword: userWithPassword ? !!userWithPassword.plainTextPassword : false,
      passwordLength: userWithPassword?.password?.length,
      plainTextPasswordLength: userWithPassword?.plainTextPassword?.length
    });

    if (!userWithPassword) {
      console.log('Failed to fetch user with password fields');
      return res.status(500).json({ message: 'Server Error' });
    }

    // Direct password comparison for debugging
    const directMatch = password === userWithPassword.password || password === userWithPassword.plainTextPassword;
    console.log('6. Direct password comparison:', {
      directMatch,
      providedPasswordLength: password.length,
      storedPasswordLength: userWithPassword.password?.length,
      storedPlainTextPasswordLength: userWithPassword.plainTextPassword?.length
    });

    // Use the matchPassword method as well
    const methodMatch = await userWithPassword.matchPassword(password);
    console.log('7. matchPassword method result:', methodMatch);

    if (!directMatch && !methodMatch) {
      console.log('Password match failed');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin
    };

    console.log('8. Login successful, generating token...');
    const token = generateToken(user._id);

    res.json({
      ...userData,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Stack trace:', error.stack);
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