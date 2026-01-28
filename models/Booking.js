const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    flightId: {
        type: String,
        required: true
    },
    airline: String,
    flightNumber: String,
    departureTime: String,
    origin: String,
    destination: String,
    passengers: {
        type: Number,
        default: 1
    },
    totalPrice: Number,
    status: {
        type: String,
        enum: ['confirmed', 'cancelled'],
        default: 'confirmed'
    },
    autoBookRide: {
        type: Boolean,
        default: true
    },
    flightStatus: {
        type: String,
        enum: ['scheduled', 'enroute', 'landed'],
        default: 'scheduled'
    },
    destinationCoords: {
        latitude: Number,
        longitude: Number
    }
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);
