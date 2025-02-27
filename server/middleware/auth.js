// Protect routes
const protect = async (req, res, next) => {
  console.log('\n=== Auth Middleware Debug ===');
  console.log('Headers:', req.headers);
  
  let token;

  // Check if auth header exists and has the right format
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('Token extracted:', token);

      // Verify token
      console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded:', decoded);

      // Get user from the token
      const user = await User.findById(decoded.id).select('-password');
      console.log('User found:', user ? 'yes' : 'no');
      
      if (!user) {
        console.log('User not found in database');
        return res.status(401).json({ message: 'Not authorized' });
      }

      req.user = user;
      console.log('Auth middleware successful');
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ message: 'Not authorized' });
    }
  } else {
    console.log('No authorization header or wrong format');
    res.status(401).json({ message: 'Not authorized, no token' });
  }
}; 