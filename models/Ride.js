const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    pickup: {
        address: String,
        latitude: Number,
        longitude: Number
    },
    dropoff: {
        address: String,
        latitude: Number,
        longitude: Number
    },
    status: {
        type: String,
        enum: ['searching', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled'],
        default: 'searching'
    },
    fare: {
        type: Number,
        required: true
    },
    carType: {
        type: String, // 'UberX', 'Black', etc.
        default: 'UberX'
    },
    otp: {
        type: String // For ride start verification
    }
}, { timestamps: true });

module.exports = mongoose.model('Ride', RideSchema);
