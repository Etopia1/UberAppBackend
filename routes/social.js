const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Feed routes
router.get('/feed', socialController.getFeed);

// Post routes
router.get('/posts/:postId', socialController.getPost);
router.post('/posts', socialController.createPost);
router.delete('/posts/:postId', socialController.deletePost);
router.post('/posts/:postId/like', socialController.likePost);

// Comment routes
router.post('/posts/:postId/comments', socialController.addComment);
router.get('/posts/:postId/comments', socialController.getComments);

// Follow routes
router.post('/follow/:userId', socialController.toggleFollow);

// User profile routes
router.get('/users/:userId/profile', socialController.getUserProfile);
router.patch('/profile', socialController.updateProfile);
router.get('/users/:userId/posts', socialController.getUserPosts);
router.get('/users/:userId', socialController.getUserProfile); // Alias for profile fetch by ID
router.get('/users', socialController.getAllUsers); // Discover users


module.exports = router;
