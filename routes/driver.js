const router = require('express').Router();
const driverController = require('../controllers/driverController');
const auth = require('../middleware/auth');

// Admin routes for driver management
router.post('/create', auth, driverController.createDriver); // Admin creates driver
router.get('/all', auth, driverController.getAllDrivers); // Admin views all drivers

// Driver first-time setup routes (no auth required)
router.post('/check-password-status', driverController.checkPasswordStatus);
router.post('/set-initial-password', driverController.setInitialPassword);

module.exports = router;
