const router = require('express').Router();
const rideController = require('../controllers/rideController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.post('/request', rideController.requestRide);
router.get('/status/:rideId', rideController.getRideStatus);

module.exports = router;
