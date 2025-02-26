// @desc    Get all users (including passwords for development)
// @route   GET /api/auth/users
// @access  Public (for development)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get all users WITH passwords (DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION)
// @route   GET /api/auth/users/debug
// @access  Public (for development)
router.get('/users/debug', async (req, res) => {
  try {
    // Warning message in logs
    console.warn('⚠️ WARNING: Debug endpoint accessed - exposing sensitive data');
    
    const users = await User.find().select('+password +registrationIp +lastIp');
    const usersWithSensitiveData = users.map(user => ({
      _id: user._id,
      username: user.username,
      email: user.email,
      password: user.password, // WARNING: This exposes hashed passwords
      isAdmin: user.isAdmin,
      registrationIp: user.registrationIp,
      lastIp: user.lastIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    // Warning in response
    res.json({
      warning: "⚠️ This endpoint exposes sensitive data and should NOT be used in production!",
      users: usersWithSensitiveData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
}); 