const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
const protect = async (req, res, next) => {
  console.log('\n=== Auth Middleware Debug ===');
  console.log('1. Request Headers:', req.headers);
  console.log('2. JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'NOT_SET');
  
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log('3. Token extracted:', token);

      // Log token parts before verification
      const [header, payload, signature] = token.split('.');
      console.log('4. Token parts:', {
        header: Buffer.from(header, 'base64').toString(),
        payload: Buffer.from(payload, 'base64').toString(),
        signatureLength: signature.length
      });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('5. Token decoded successfully:', decoded);

      const user = await User.findById(decoded.id).select('-password');
      console.log('6. Database query result:', user ? {
        found: true,
        id: user._id,
        username: user.username
      } : {
        found: false,
        queriedId: decoded.id
      });
      
      if (!user) {
        console.log('7. User not found in database');
        return res.status(401).json({ message: 'Not authorized - user not found' });
      }

      req.user = user;
      console.log('8. Auth middleware successful');
      next();
    } catch (error) {
      console.error('9. Auth middleware error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      res.status(401).json({ message: `Not authorized - ${error.message}` });
    }
  } else {
    console.log('10. No authorization header or wrong format');
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user) {
      req.user = user;
    }
  } catch (error) {
    console.warn('Optional auth failed:', error.message);
  }

  return next();
};

// Admin middleware
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, optionalAuth, admin };