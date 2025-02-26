// @desc    Get all users
// @route   GET /api/auth/users
// @access  Public (for development)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -__v')
      .select('+registrationIp +lastIp');
    
    const safeUsers = users.map(user => ({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      registrationIp: user.registrationIp,
      lastIp: user.lastIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profilePicture: user.profilePicture,
      bio: user.bio
    }));
    
    res.json(safeUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
}); 