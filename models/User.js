const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ['rider', 'driver'], default: 'rider' },
    avatar: { type: String, default: '' },
    verificationStatus: { type: Boolean, default: false },
    isPasswordSet: { type: Boolean, default: false }, // For driver onboarding - tracks if password has been set
    otp: { type: String },
    otpExpires: { type: Date },

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
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
