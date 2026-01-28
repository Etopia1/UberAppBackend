const Ride = require('../models/Ride');
const User = require('../models/User');

// Request a Ride
exports.requestRide = async (req, res) => {
    try {
        const { userId, pickup, dropoff, carType, price } = req.body;

        // Create new Ride in DB
        const newRide = new Ride({
            user: userId,
            pickup: { address: pickup?.address || 'Current Location', latitude: pickup?.lat, longitude: pickup?.lng },
            dropoff: { address: dropoff?.address || 'Destination', latitude: dropoff?.lat, longitude: dropoff?.lng },
            carType,
            fare: price || 0,
            status: 'searching'
        });

        const savedRide = await newRide.save();

        res.status(201).json({
            message: 'Ride requested successfully',
            ride: savedRide
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Ride Status
exports.getRideStatus = async (req, res) => {
    try {
        const { rideId } = req.params;
        const ride = await Ride.findById(rideId).populate('driver', 'name phone avatar car');

        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        res.json({
            id: ride._id,
            status: ride.status,
            driver: ride.driver,
            eta: 5
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
