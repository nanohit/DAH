const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

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
      password, // The pre-save hook will hash this
      registrationIp: ip,
      lastIp: ip
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
      email: user.email,
      hasPassword: !!user.password,
      passwordLength: user.password?.length
    });

    // Verify storage with password field
    const savedUser = await User.findById(user._id).select('+password');
    console.log('4. Verification query result:', {
      hasUser: !!savedUser,
      hasPassword: savedUser ? !!savedUser.password : false,
      passwordLength: savedUser?.password?.length,
      storedPassword: savedUser?.password
    });

    // For testing purposes, try to match the password immediately after registration
    const loginTest = await savedUser.matchPassword(password);
    console.log('5. Immediate password match test:', loginTest);
    if (!loginTest) {
      console.log('   Failed password match details:');
      console.log('   Original password:', password);
      console.log('   Stored hashed password:', savedUser.password);
      console.log('   Lengths:', {
        originalLength: password.length,
        hashedLength: savedUser.password.length
      });
    }

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
      passwordLength: user.password?.length,
      storedPassword: user.password
    } : 'No user found');
    
    if (!user) {
      console.log('No user found for:', emailOrUsername);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      console.log('No password stored for user');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password match using bcrypt directly
    console.log('5. Attempting password match...');
    console.log('   Entered password:', password);
    console.log('   Stored password:', user.password);
    
    try {
      const isMatch = await bcrypt.compare(password, user.password);
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
    } catch (bcryptError) {
      console.error('Bcrypt compare error:', bcryptError);
      return res.status(500).json({ message: 'Error comparing passwords' });
    }
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