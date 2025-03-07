const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

// Debug middleware
app.use((req, res, next) => {
  console.log(`\n=== Request Debug ===`);
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// CORS configuration
const allowedOrigins = [
  'https://dah-omega.vercel.app',
  'https://dah.vercel.app',
  'https://dah-git-main-nanohit.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://dah-tyxc.onrender.com',
  'https://alphy.tech',
  'https://www.alphy.tech'
];

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || process.env.NODE_ENV === 'development') {
      console.log('Allowing request with no origin or in development mode');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log(`Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));

// Add a debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    headers: req.headers,
    origin: req.get('origin'),
    host: req.get('host'),
    url: req.url,
    method: req.method
  });
});

// Body parsing middleware
app.use(express.json());

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const bookRoutes = require('./routes/booksRouter');
const uploadRoutes = require('./routes/upload');
const userRoutes = require('./routes/users');

// Debug route registration
console.log('\n=== Route Registration ===');
console.log('Registering /api/auth routes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);

// Log registered routes
console.log('\n=== Registered Routes ===');
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`${Object.keys(r.route.methods).join(', ').toUpperCase()}\t${r.route.path}`);
  } else if (r.name === 'router') {
    console.log(`Router: ${r.regexp}`);
  }
});

// Add root route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'DAH Backend API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware - should be after all routes
app.use((err, req, res, next) => {
  console.error('\n=== Error Handler ===');
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`\n=== Server Started ===`);
  console.log(`Server running on port ${PORT}`);
});