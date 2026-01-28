const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// GET /api/bookings/:userId
router.get('/:userId', bookingController.getUserBookings);

module.exports = router;
