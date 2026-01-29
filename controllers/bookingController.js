const Booking = require('../models/Booking');

exports.createBooking = async (req, res) => {
    try {
        const { userId, type, details, amount, status } = req.body;

        const newBooking = new Booking({
            user: userId,
            type: type || 'flight',
            flightId: details.flightNumber || 'FL-' + Date.now(), // Map to flightId (required)
            airline: details.airline,
            flightNumber: details.flightNumber || 'FL-' + Date.now().toString().slice(-4),
            departureTime: details.date, // Map to departureTime
            origin: details.origin,
            destination: details.destination,
            totalPrice: amount, // Map to totalPrice
            status: status || 'confirmed',
            details: details
        });

        await newBooking.save();

        res.status(201).json({
            message: 'Booking created successfully',
            booking: newBooking
        });
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ message: 'Failed to create booking' });
    }
};

// Get all bookings for the authenticated user
exports.getUserBookings = async (req, res) => {
    try {
        const userId = req.params.userId;

        // Find bookings and sort by most recent (descending _id which contains timestamp, or createdAt)
        // Assuming your Booking model has timestamps: true
        const bookings = await Booking.find({ user: userId }).sort({ createdAt: -1 });

        res.json({
            message: 'Bookings retrieved',
            bookings: bookings
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ message: 'Could not fetch bookings' });
    }
};
