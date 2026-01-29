const router = require('express').Router();
const flightController = require('../controllers/flightController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/search-location', flightController.searchLocations);
router.post('/search', flightController.searchFlights);
router.post('/book', flightController.bookFlight);
router.post('/land/:bookingId', flightController.simulateFlightLanding);

module.exports = router;
