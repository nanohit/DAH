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
    // Temporarily disable select: false for debugging
    // select: false,
  },
  badge: {
    type: String,
    enum: ['Platinum shitposter', 'Aesthete', 'Lurker👁', 'Dialectician (debater)', 'Researcher', 'Architector', ''],
    default: '',
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

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  console.log('\n=== Password Match Debug ===');
  console.log('1. Attempting to match password for user:', this.username);
  
  try {
    // Since we're already in a user instance method, we can use this.password
    // if it's available (i.e., if we used .select('+password') when querying)
    let hashedPassword = this.password;
    
    // If password is not available in the current instance, fetch it
    if (!hashedPassword) {
      console.log('2. Password not in current instance, fetching user with password...');
      const user = await this.model('User').findOne({ _id: this._id }).select('+password');
      if (!user || !user.password) {
        console.log('3. No user or password found');
        return false;
      }
      hashedPassword = user.password;
    }

    console.log('4. Got hashed password:', {
      username: this.username,
      hasPassword: !!hashedPassword,
      passwordLength: hashedPassword?.length
    });

    console.log('5. Attempting bcrypt compare...');
    console.log('   Entered password length:', enteredPassword?.length);
    console.log('   Stored password length:', hashedPassword?.length);
    
    const isMatch = await bcrypt.compare(enteredPassword, hashedPassword);
    console.log('6. Password match result:', isMatch);

    return isMatch;
  } catch (error) {
    console.error('Password match error:', error);
    return false;
  }
};

// Hash password before saving
UserSchema.pre('save', async function(next) {
  console.log('\n=== Password Pre-Save Hook ===');
  console.log('1. Hook triggered for user:', this.username);
  console.log('2. Password modified:', this.isModified('password'));
  console.log('3. Current password value:', this.password ? `[${this.password.length} chars]` : '[MISSING]');
  console.log('4. Document state:', {
    isNew: this.isNew,
    modifiedPaths: this.modifiedPaths(),
    hasPassword: !!this.password,
    passwordType: typeof this.password,
    passwordValue: this.password
  });
  
  if (!this.isModified('password')) {
    console.log('5. Password not modified, skipping hashing');
    return next();
  }
  
  try {
    console.log('6. Generating salt...');
    const salt = await bcrypt.genSalt(10);
    console.log('7. Generated salt:', salt);
    console.log('8. Hashing password...');
    const hashedPassword = await bcrypt.hash(this.password, salt);
    console.log('9. Password hashed successfully:', {
      originalLength: this.password.length,
      hashedLength: hashedPassword.length,
      hashedValue: hashedPassword
    });
    this.password = hashedPassword;
    next();
  } catch (error) {
    console.error('Password hashing error:', error);
    console.error('Error stack:', error.stack);
    next(error);
  }
});

module.exports = mongoose.model('User', UserSchema); 