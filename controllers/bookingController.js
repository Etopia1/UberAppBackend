const Booking = require('../models/Booking');

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
