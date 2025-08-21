const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Fail fast if server can't be reached
      socketTimeoutMS: 20000, // Close sockets after 20s of inactivity
      maxPoolSize: 10, // Limit connections for stability
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.log("Error connecting to MongoDB", error);
    process.exit(1);
  }
};

module.exports = connectDB;
