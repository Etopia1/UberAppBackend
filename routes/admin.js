const router = require('express').Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');

// Middleware to check if user is admin could be added here
// For now relying on auth + logic, ideally we add specific 'isAdmin' middleware

router.get('/users', auth, adminController.getAllUsers);
router.post('/ban-user', auth, adminController.banUser);
router.post('/unban-user', auth, adminController.unbanUser);

router.get('/posts', auth, adminController.getAllPosts);
router.post('/delete-post', auth, adminController.deletePost);

router.get('/stats', auth, adminController.getDashboardStats);

module.exports = router;
