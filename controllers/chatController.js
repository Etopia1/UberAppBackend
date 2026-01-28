const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Follow = require('../models/Follow');

// Check if two users are friends (mutual follow)
const areFriends = async (user1, user2) => {
    const follow1 = await Follow.findOne({ follower: user1, following: user2 });
    const follow2 = await Follow.findOne({ follower: user2, following: user1 });
    return follow1 && follow2;
};

// Get all conversations for a user
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate('participants', 'name profilePicture avatar')
            .populate('lastMessageSender', 'name')
            .sort({ lastMessageTime: -1 });

        res.json({ conversations });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ message: 'Failed to fetch conversations' });
    }
};

// Get messages in a conversation
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await Message.find({ conversation: conversationId })
            .populate('sender', 'name profilePicture avatar')
            .populate('receiver', 'name profilePicture avatar')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Message.countDocuments({ conversation: conversationId });

        res.json({
            messages: messages.reverse(), // Reverse to show oldest first
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
};

// Create or get existing conversation
exports.createConversation = async (req, res) => {
    try {
        const { participantId } = req.body;
        const userId = req.user._id;


        // Check if conversation already exists
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, participantId] }
        }).populate('participants', 'name profilePicture avatar');

        if (!conversation) {
            // Create new conversation
            conversation = new Conversation({
                participants: [userId, participantId]
            });
            await conversation.save();
            await conversation.populate('participants', 'name profilePicture avatar');
        }

        res.json({ conversation });
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ message: 'Failed to create conversation' });
    }
};

// Send message (also handled via Socket.IO)
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, receiverId, content, type = 'text', imageUrl, location, replyTo } = req.body;
        const senderId = req.user._id;

        const message = new Message({
            conversation: conversationId,
            sender: senderId,
            receiver: receiverId,
            content,
            type,
            imageUrl,
            location,
            replyTo
        });

        await message.save();
        await message.populate('sender', 'name profilePicture avatar');
        await message.populate('receiver', 'name profilePicture avatar');

        // Update conversation
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: type === 'text' ? content : type === 'image' ? '📷 Photo' : '📍 Location',
            lastMessageTime: new Date(),
            lastMessageSender: senderId,
            $inc: { [`unreadCount.${receiverId}`]: 1 }
        });

        res.json({ message });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        await Message.updateMany(
            { conversation: conversationId, receiver: userId, read: false },
            { read: true, readAt: new Date() }
        );

        await Conversation.findByIdAndUpdate(conversationId, {
            [`unreadCount.${userId}`]: 0
        });

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ message: 'Failed to mark messages as read' });
    }
};

// Get all media (images, videos) in a conversation
exports.getConversationMedia = async (req, res) => {
    try {
        const { conversationId } = req.params;

        const mediaMessages = await Message.find({
            conversation: conversationId,
            type: { $in: ['image', 'video', 'sticker'] },
            isDeleted: { $ne: true }
        })
            .select('mediaUrl type createdAt content')
            .sort({ createdAt: -1 });

        res.json({ media: mediaMessages });
    } catch (error) {
        console.error('Get conversation media error:', error);
        res.status(500).json({ message: 'Failed to fetch conversation media' });
    }
};

// Edit a message
exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to edit this message' });
        }

        if (message.isDeleted) {
            return res.status(400).json({ message: 'Cannot edit deleted message' });
        }

        message.content = content;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${message.receiver}`).emit('message_updated', {
                messageId: message._id,
                conversationId: message.conversation,
                content: message.content,
                isEdited: true
            });
            // Update sender too (for multi-device)
            io.to(`user_${message.sender}`).emit('message_updated', {
                messageId: message._id,
                conversationId: message.conversation,
                content: message.content,
                isEdited: true
            });
        }

        res.json({ message });
    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ message: 'Failed to edit message' });
    }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        message.content = '🚫 This message was deleted';
        message.type = 'text'; // REset type to hide media
        message.imageUrl = null;
        message.mediaUrl = null;

        await message.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${message.receiver}`).emit('message_deleted', {
                messageId: message._id,
                conversationId: message.conversation
            });
            io.to(`user_${message.sender}`).emit('message_deleted', {
                messageId: message._id,
                conversationId: message.conversation
            });
        }

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ message: 'Failed to delete message' });
    }
};

// React to a message
exports.reactToMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body; // e.g. "❤️", "👍"
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Toggle reaction: if already reacted with this emoji, remove it. Else add it.
        // For simplicity, we might just allow adding multiple or strictly one per user.
        // Let's implement toggle logic for the SAME emoji, or just push if different? 
        // Best UX: User can have only 1 reaction? Or multiple? Standard is usually 1 reaction per user OR multiple.
        // Let's go with: Toggle the specific emoji.

        const existingReactionIndex = message.reactions.findIndex(
            r => r.user.toString() === userId.toString() && r.emoji === emoji
        );

        let action = 'added';

        if (existingReactionIndex > -1) {
            // Remove
            message.reactions.splice(existingReactionIndex, 1);
            action = 'removed';
        } else {
            // Add
            message.reactions.push({ user: userId, emoji });
        }

        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`user_${message.receiver}`).emit('message_reaction', {
                messageId: message._id,
                conversationId: message.conversation,
                reactions: message.reactions
            });
            io.to(`user_${message.sender}`).emit('message_reaction', {
                messageId: message._id,
                conversationId: message.conversation,
                reactions: message.reactions
            });
        }

        res.json({ reactions: message.reactions, action });
    } catch (error) {
        console.error('React message error:', error);
        res.status(500).json({ message: 'Failed to react to message' });
    }
};
