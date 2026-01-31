const router = require('express').Router();
const flightController = require('../controllers/flightController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/search-location', flightController.searchLocations);
router.post('/search', flightController.searchFlights);
router.post('/book', flightController.bookFlight);

// Start: Fix for Simulation Route
// Matches frontend: /api/flight/:bookingId/simulate-landing
router.post('/:bookingId/simulate-landing', flightController.simulateFlightLanding);
// End: Fix

module.exports = router;
