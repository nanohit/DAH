const mongoose = require('mongoose');

async function testConnection() {
  // Update with your new password
  const uri = 'mongodb+srv://dah-admin:password123@cluster0.tivx6.mongodb.net/dark-academia-hub?retryWrites=true&w=majority&appName=Cluster0';
  
  console.log('Attempting to connect to MongoDB Atlas with updated credentials...');
  
  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB connection SUCCESSFUL');
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ MongoDB connection FAILED');
    console.error('Error details:', error);
  }
}

testConnection();
