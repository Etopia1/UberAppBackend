const Ride = require('../models/Ride');
const User = require('../models/User');

// Request a Ride
exports.requestRide = async (req, res) => {
    try {
        const { pickup, dropoff, pickupCoords, dropoffCoords, carType, price, scheduledTime, paymentMethod } = req.body;
        const userId = req.user ? req.user._id : req.body.userId;

        // Create new Ride in DB
        const newRide = new Ride({
            user: userId,
            pickup: {
                address: pickup || 'Current Location',
                latitude: pickupCoords ? pickupCoords[1] : null,
                longitude: pickupCoords ? pickupCoords[0] : null
            },
            dropoff: {
                address: dropoff || 'Destination',
                latitude: dropoffCoords ? dropoffCoords[1] : null,
                longitude: dropoffCoords ? dropoffCoords[0] : null
            },
            carType,
            fare: price || 0,
            status: 'searching',
            scheduledTime,
            paymentMethod
        });

        const savedRide = await newRide.save();

        res.status(201).json({
            message: 'Ride requested successfully',
            ride: savedRide
        });
    } catch (error) {
        console.error('Request ride error:', error);
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
