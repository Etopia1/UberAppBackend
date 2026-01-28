const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Conversation routes
router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.createConversation);
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.get('/conversations/:conversationId/media', chatController.getConversationMedia);
router.patch('/conversations/:conversationId/read', chatController.markAsRead);

// Alternative routes (for compatibility)
router.get('/:conversationId/messages', chatController.getMessages);
router.patch('/:conversationId/read', chatController.markAsRead);

// Message routes
router.post('/messages', chatController.sendMessage);
router.put('/messages/:messageId', chatController.editMessage);
router.delete('/messages/:messageId', chatController.deleteMessage);
router.post('/messages/:messageId/react', chatController.reactToMessage);

module.exports = router;
