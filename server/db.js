const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    global.dbConnected = true;
    global.dbError = null;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    global.dbConnected = false;
    global.dbError = error.message;
    // process.exit(1);
  }
};

module.exports = connectDB;
