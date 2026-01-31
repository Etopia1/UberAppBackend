const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ['rider', 'driver', 'admin'], default: 'rider' },
    avatar: { type: String, default: '' },
    verificationStatus: { type: Boolean, default: false },
    isPasswordSet: { type: Boolean, default: false }, // For driver onboarding - tracks if password has been set
    otp: { type: String },
    otpExpires: { type: Date },
    expoPushToken: { type: String }, // For Push Notifications

    // Social Media Fields
    bio: { type: String, maxlength: 200, default: '' },
    profilePicture: { type: String, default: '' },
    coverPhoto: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    ridesCount: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 }, // in km

    // For drivers & general online status
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    currentLocation: {
        lat: Number,
        lng: Number
    },
    reliabilityScore: { type: Number, default: 5.0 }, // 0 to 5
    // Driver Vehicle Details
    vehicle: {
        make: { type: String },
        model: { type: String },
        year: { type: String },
        plate: { type: String },
        color: { type: String }
    },

    // Admin Verification for Drivers
    driverId: { type: String, unique: true, sparse: true },
    isDriverVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false }, // Moderation

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
