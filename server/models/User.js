const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// WARNING: THIS IS FOR DEVELOPMENT ONLY
// This schema includes plain text passwords and should NEVER be used in production
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please add a username'],
    unique: true,
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  profilePicture: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    default: '',
  },
  lastIp: {
    type: String,
    default: '',
  },
  registrationIp: {
    type: String,
    default: '',
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  console.log('\n=== Password Encryption Hook ===');
  console.log('1. Hook triggered for user:', this.username);
  console.log('2. Password modified:', this.isModified('password'));
  
  if (!this.isModified('password')) {
    console.log('3. Password not modified, skipping encryption');
    return next();
  }
  
  try {
    console.log('4. Generating salt...');
    const salt = await bcrypt.genSalt(10);
    console.log('5. Hashing password...');
    this.password = await bcrypt.hash(this.password, salt);
    console.log('6. Password hashed successfully');
    next();
  } catch (error) {
    console.error('Password encryption error:', error);
    next(error);
  }
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  console.log('\n=== Password Match Debug ===');
  console.log('1. Attempting to match password for user:', this.username);
  
  try {
    // Make sure we have the password field
    console.log('2. Fetching user with password field...');
    const user = await this.model('User').findOne({ _id: this._id }).select('+password');
    
    if (!user || !user.password) {
      console.log('3. No user or password found');
      return false;
    }

    console.log('4. Found user with password:', {
      hasUser: !!user,
      username: user.username,
      hasPassword: !!user.password,
      passwordLength: user.password?.length
    });

    console.log('5. Attempting bcrypt compare...');
    console.log('   Entered password length:', enteredPassword?.length);
    console.log('   Stored password length:', user.password?.length);
    
    const isMatch = await bcrypt.compare(enteredPassword, user.password);
    console.log('6. Password match result:', isMatch);

    return isMatch;
  } catch (error) {
    console.error('Password match error:', error);
    return false;
  }
};

module.exports = mongoose.model('User', UserSchema); 