const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const URL = process.env.MONGODB_URL
        const conn = await mongoose.connect(URL, {
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`❌ DB Connection Error: ${err.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
