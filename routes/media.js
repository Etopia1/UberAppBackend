const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const authenticate = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Upload routes
router.post('/upload-image', mediaController.upload.single('image'), mediaController.uploadImage);
router.post('/upload-video', mediaController.upload.single('video'), mediaController.uploadVideo);
router.post('/upload-audio', mediaController.upload.single('audio'), mediaController.uploadAudio);
router.post('/upload-document', mediaController.upload.single('document'), mediaController.uploadDocument);
router.post('/upload-profile-picture', mediaController.upload.single('profile'), mediaController.uploadProfilePicture);

// Delete route
router.delete('/delete', mediaController.deleteMedia);

module.exports = router;
