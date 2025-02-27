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
  plainTextPassword: {  // Adding a new field for plain text password
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false  // Don't include by default in queries
  },
  password: {  // Keeping original password field for compatibility
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false  // Don't include by default in queries
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

// Password comparison for plain text
UserSchema.methods.matchPassword = async function(enteredPassword) {
  // Make sure we have the password fields
  const user = await this.model('User').findOne({ _id: this._id }).select('+password +plainTextPassword');
  return enteredPassword === user.plainTextPassword || enteredPassword === user.password;
};

module.exports = mongoose.model('User', UserSchema); 