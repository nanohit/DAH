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
app.use(cors({
  origin: ['https://dah-omega.vercel.app', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
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

// Debug route registration
console.log('\n=== Route Registration ===');
console.log('Registering /api/auth routes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/upload', uploadRoutes);

// Log registered routes
console.log('\n=== Registered Routes ===');
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`${Object.keys(r.route.methods).join(', ').toUpperCase()}\t${r.route.path}`);
  } else if (r.name === 'router') {
    console.log(`Router: ${r.regexp}`);
  }
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