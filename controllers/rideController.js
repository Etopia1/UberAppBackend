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

        // --- MATCHMAKING LOGIC ---
        // 1. Find Online Drivers
        // In a real app, use Geospatial query ($near).
        // For now, find ANY driver who is 'isOnline: true' and 'role: driver'
        const onlineDrivers = await User.find({ role: 'driver', isOnline: true });

        // 2. Emit Socket Event to these drivers
        // require socket instance (assuming it's exported or available via global/app)
        // If socket.io object is attached to 'req.app.get("io")', use that.
        const io = req.app.get('io');

        if (io && onlineDrivers.length > 0) {
            console.log(`Notifying ${onlineDrivers.length} online drivers...`);
            onlineDrivers.forEach(driver => {
                // Emit to the specific driver's room (User Room Convention: 'user_' + ID)
                io.to(`user_${driver._id}`).emit('new_ride_request', {
                    rideId: savedRide._id,
                    pickup: savedRide.pickup,
                    dropoff: savedRide.dropoff,
                    fare: savedRide.fare,
                    user: {
                        name: req.user ? req.user.name : "Passenger",
                        rating: 4.8 // Mock rating
                    }
                });
            });
        } else {
            console.log('No online drivers found or Socket IO not available.');
        }

        res.status(201).json({
            message: 'Ride requested successfully',
            ride: savedRide,
            driversNotified: onlineDrivers.length
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
