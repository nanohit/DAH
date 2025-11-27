const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
// Create HTTP server
const server = http.createServer(app);
// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
  
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Enable Socket.io debugging
io.engine.on("connection_error", (err) => {
  console.log("Socket.io connection error:", err.req);      // the request object
  console.log("Socket.io error code:", err.code);     // the error code, for example 1
  console.log("Socket.io error message:", err.message);  // the error message, for example "Session ID unknown"
  console.log("Socket.io error context:", err.context);  // some additional error context
});

// Socket.io connection handler
io.on('connection', (socket) => {
  // Reduce logging frequency - only log every 5th connection for high-traffic apps
  const logFrequency = 5;
  const connectionCount = io.engine.clientsCount || 0;
  if (connectionCount % logFrequency === 0) {
    console.log(`User connected: ${socket.id} (${connectionCount} total connections)`);
  }
  
  // Join room for real-time updates
  socket.on('join-post', (postId) => {
    // Ensure postId is handled correctly - could be a string or an object with postId property
    const roomId = typeof postId === 'object' ? postId.postId : postId;
    if (!roomId) {
      console.log(`Invalid postId format received:`, postId);
      return;
    }
    
    const roomName = `post:${roomId}`;
    console.log(`Socket ${socket.id} joining room: ${roomName}`);
    socket.join(roomName);
    
    // Send a confirmation back to the client
    socket.emit('room-joined', { room: roomName, success: true });
  });
  
  // Leave room when no longer needed
  socket.on('leave-post', (postId) => {
    // Ensure postId is handled correctly - could be a string or an object with postId property  
    const roomId = typeof postId === 'object' ? postId.postId : postId;
    if (!roomId) {
      console.log(`Invalid postId format received:`, postId);
      return;
    }
    
    const roomName = `post:${roomId}`;
    console.log(`Socket ${socket.id} leaving room: ${roomName}`);
    socket.leave(roomName);
  });
  
  // Respond to ping requests - useful for testing
  socket.on('ping', () => {
    console.log(`Ping received from ${socket.id}, sending pong`);
    socket.emit('pong');
  });
  
  socket.on('disconnect', () => {
    // Reduce logging frequency - only log every 5th disconnection
    if (io.engine.clientsCount % logFrequency === 0) {
      console.log(`User disconnected: ${socket.id} (${io.engine.clientsCount} remaining connections)`);
    }
  });
});

// DEBUGGING: Log all event emissions to track when Socket.io events are fired
// Disable for normal operation to reduce log noise
const enableVerboseSocketLogging = false;

// Override emit only if verbose logging is enabled
if (enableVerboseSocketLogging) {
  const originalEmit = io.emit;
  io.emit = function(event, ...args) {
    console.log(`[SOCKET DEBUG] Global emit event: ${event}`, args[0]);
    return originalEmit.apply(this, [event, ...args]);
  };

  // DEBUGGING: Also trace room-specific emissions
  const roomEmit = io.to;
  io.to = function(room) {
    const originalToEmit = roomEmit.apply(this, [room]).emit;
    const roomObj = roomEmit.apply(this, [room]);
    
    roomObj.emit = function(event, ...args) {
      console.log(`[SOCKET DEBUG] Room ${room} emit event: ${event}`, args[0]);
      return originalToEmit.apply(this, [event, ...args]);
    };
    
    return roomObj;
  };
}
else {
  // Use original emit methods without logging wrappers
  console.log('Socket verbose logging disabled for better performance');
}

// Make io accessible in other modules
app.set('socketio', io);

// Debug middleware - disabled by default to reduce log spam
const enableRequestLogging = false;

// Only apply debug middleware if logging is enabled
if (enableRequestLogging) {
  app.use((req, res, next) => {
    console.log(`\n=== Request Debug ===`);
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    console.log('Params:', req.params);
    next();
  });
} else {
  // Simple lightweight logging for critical paths
  app.use((req, res, next) => {
    // Only log API endpoints and skip static assets, etc.
    if (req.url.startsWith('/api/') && req.method !== 'OPTIONS') {
      console.log(`${req.method} ${req.url}`);
    }
    next();
  });
}

// CORS configuration
const allowedOrigins = [
  // Vercel deployments
  'https://dah-omega.vercel.app',
  'https://dah.vercel.app',
  'https://dah-git-main-nanohit.vercel.app',
  'https://alphy.tech',
  'https://www.alphy.tech',
  'https://beta.alphy.tech',
  // Render deployments
  'https://dah-tyxc.onrender.com',
  'https://dah.onrender.com',
  'https://dah-beta.onrender.com',
  'https://dah-beta-xxxxxxxx.onrender.com', // replace with actual Render beta hostname if different
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://localhost:5001'
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

// Add a debug socket test endpoint
app.get('/api/debug/socket-test', (req, res) => {
  const { postId, userId } = req.query;
  const io = req.app.get('socketio');
  
  if (!io) {
    return res.status(500).json({ 
      error: 'Socket.io instance not available',
      message: 'Failed to test socket connection - Socket.io not initialized'
    });
  }
  
  console.log(`\n=== Socket Test Debug ===`);
  console.log(`Testing socket connection for post: ${postId}, user: ${userId}`);
  
  try {
    // Emit to specific room if postId provided
    if (postId) {
      const roomName = `post:${postId}`;
      console.log(`Emitting test event to room ${roomName}`);
      io.to(roomName).emit('socket-test', { 
        message: 'This is a test message from the server',
        timestamp: new Date().toISOString(),
        postId,
        userId
      });
    }
    
    // Also emit globally
    console.log(`Emitting global test event`);
    io.emit('socket-test', { 
      message: 'This is a global test message from the server',
      timestamp: new Date().toISOString(),
      global: true,
      userId
    });
    
    // Get stats on socket connections
    const rooms = io.sockets.adapter.rooms;
    const sids = io.sockets.adapter.sids;
    
    // Count clients in each room
    const roomStats = {};
    for (const [roomName, room] of rooms.entries()) {
      // Skip client IDs (which are also in the rooms Map)
      if (!sids.has(roomName)) {
        roomStats[roomName] = room.size;
      }
    }
    
    res.json({
      success: true,
      message: 'Socket test event emitted',
      timestamp: new Date().toISOString(),
      socketStats: {
        connectedClients: io.engine.clientsCount,
        rooms: roomStats
      }
    });
  } catch (error) {
    console.error('Error in socket test:', error);
    res.status(500).json({
      error: 'Failed to emit socket test event',
      message: error.message
    });
  }
});

// Add a debug endpoint
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) { // routes registered directly on the app
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') { // router middleware
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json(routes);
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
const mapRoutes = require('./routes/maps');
const linkPreviewRoutes = require('./routes/linkPreview');

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
app.use('/api/maps', mapRoutes);
app.use('/api/link-preview', linkPreviewRoutes);

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

// Change the last part from app.listen to server.listen
const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`\n=== Server Started ===`);
  console.log(`Server running on port ${PORT} with Socket.io`);
});