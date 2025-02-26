const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    minlength: 6
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
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      return ret; // Return everything including password
    }
  }
});

// Comment out password hashing for development
// UserSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) {
//     next();
//   }
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
// });

// Modify password comparison to work with plain text
UserSchema.methods.matchPassword = async function(enteredPassword) {
  // return await bcrypt.compare(enteredPassword, this.password);
  return enteredPassword === this.password; // Direct comparison for development
};

UserSchema.pre('find', function() {
  this.select('+password');
});

UserSchema.pre('findOne', function() {
  this.select('+password');
});

module.exports = mongoose.model('User', UserSchema); 