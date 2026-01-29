const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

router.get('/:userId', bookingController.getUserBookings);
router.post('/', bookingController.createBooking);

module.exports = router;
