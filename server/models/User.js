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
    select: true  // Changed to true to always include password
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

// Password comparison for plain text
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return enteredPassword === this.password; // Direct comparison for development
};

// Ensure password is always selected
UserSchema.pre('find', function() {
  this.select('+password');
});

UserSchema.pre('findOne', function() {
  this.select('+password');
});

module.exports = mongoose.model('User', UserSchema); 