require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./config/db');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Connect Database
// Connect Database line removed, will connect before server listen

// Middleware
app.use(cors());
app.use(helmet({
    crossOriginResourcePolicy: false, // Required for displaying local images in React Native
}));
app.use(morgan('dev'));

// RAW Header Debugging (MUST be before body-parser)
app.use((req, res, next) => {
    if (req.headers['content-type']?.includes('multipart')) {
        console.log('--- Multipart Request Detected ---');
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
    }
    next();
});

// Regular Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folder for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io accessible globally
app.set('io', io);

// Routes
const authRoute = require('./routes/auth');
const rideRoute = require('./routes/ride');
const flightRoute = require('./routes/flight');
const bookingRoute = require('./routes/booking');
const testRoute = require('./routes/test');
const paymentRoute = require('./routes/payment');
const chatRoute = require('./routes/chat');
const socialRoute = require('./routes/social');
const walletRoute = require('./routes/wallet');
const mediaRoute = require('./routes/media');
const groupRoute = require('./routes/group');
const driverRoute = require('./routes/driver');
const adminRoute = require('./routes/admin');

app.use('/api/auth', authRoute);
app.use('/api/ride', rideRoute);
app.use('/api/flight', flightRoute);
app.use('/api/bookings', bookingRoute);
app.use('/api/test', testRoute);
app.use('/api/payment', paymentRoute);
app.use('/api/chat', chatRoute);
app.use('/api/social', socialRoute);
app.use('/api/wallet', walletRoute);
app.use('/api/media', mediaRoute);
app.use('/api/groups', groupRoute);
app.use('/api/driver', driverRoute);
app.use('/api/admin', adminRoute);

// Default route
app.get('/', (req, res) => res.send('🚀 UberApp Backend Running'));

// Socket.IO Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_user_room', async (userId) => {
        socket.userId = userId; // Store userId on socket instance
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined their room`);

        // Update User Online Status
        try {
            const User = require('./models/User');
            await User.findByIdAndUpdate(userId, { isOnline: true });

            // Broadcast online status
            io.emit('user_status_update', { userId, isOnline: true });

            // DELIVERED STATUS LOGIC
            const Message = require('./models/Message');
            const pendingMessages = await Message.find({ receiver: userId, status: 'sent' });

            if (pendingMessages.length > 0) {
                await Message.updateMany(
                    { receiver: userId, status: 'sent' },
                    { status: 'delivered', deliveredAt: new Date() }
                );

                // Notify Senders
                pendingMessages.forEach(msg => {
                    io.to(`user_${msg.sender}`).emit('message_status_update', {
                        messageId: msg._id,
                        status: 'delivered',
                        conversationId: msg.conversation
                    });
                });
            }
        } catch (error) {
            console.error('Error updating online/delivery status:', error);
        }
    });

    // ... (rest of the listeners) ...

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.userId);
        if (socket.userId) {
            try {
                const User = require('./models/User');
                const lastSeen = new Date();
                await User.findByIdAndUpdate(socket.userId, {
                    isOnline: false,
                    lastSeen: lastSeen
                });

                // Broadcast offline status
                io.emit('user_status_update', {
                    userId: socket.userId,
                    isOnline: false,
                    lastSeen: lastSeen
                });
            } catch (error) {
                console.error('Error updating offline status:', error);
            }
        }
    });
    socket.on('send_message', async (data) => {
        const { conversationId, senderId, receiverId, content, type, imageUrl, location } = data;
        try {
            const Message = require('./models/Message');
            const Conversation = require('./models/Conversation');

            const message = new Message({
                conversation: conversationId,
                sender: senderId,
                receiver: receiverId,
                content,
                type: type || 'text',
                imageUrl: imageUrl || data.mediaUrl,
                mediaUrl: data.mediaUrl || imageUrl,
                mediaDuration: data.mediaDuration,
                location
            });

            await message.save();
            await message.populate('sender', 'name profilePicture avatar');
            await message.populate('receiver', 'name profilePicture avatar');

            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: type === 'text' ? content : `📷 ${type}`,
                lastMessageTime: new Date(),
                lastMessageSender: senderId,
                $inc: { [`unreadCount.${receiverId}`]: 1 }
            });

            const Block = require('./models/Block');
            const isBlocked = await Block.findOne({
                $or: [
                    { blocker: receiverId, blocked: senderId },
                    { blocker: senderId, blocked: receiverId }
                ]
            });

            if (isBlocked) {
                // Return success to sender to avoid "silent failure" UX, but don't emit to receiver
                socket.emit('message_sent', message);
                return;
            }

            io.to(`user_${receiverId}`).emit('message_received', message);
            socket.emit('message_sent', message);
        } catch (error) {
            console.error('Socket send_message error:', error);
            socket.emit('message_error', { error: error.message });
        }
    });

    socket.on('typing', (data) => {
        io.to(`user_${data.receiverId}`).emit('user_typing', data);
    });

    socket.on('stop_typing', (data) => {
        io.to(`user_${data.receiverId}`).emit('user_stop_typing', data);
    });

    // Advanced Messaging Actions
    socket.on('edit_message', async (data) => {
        try {
            const Message = require('./models/Message');
            const { messageId, content, senderId } = data;
            const message = await Message.findById(messageId);
            if (message && message.sender.toString() === senderId) {
                message.content = content;
                message.isEdited = true;
                message.editedAt = new Date();
                await message.save();

                // Broadcast update to both sender and receiver
                io.to(`user_${message.receiver}`).emit('message_edited', {
                    messageId: message._id,
                    content: message.content,
                    conversationId: message.conversation
                });
                socket.emit('message_edited', {
                    messageId: message._id,
                    content: message.content,
                    conversationId: message.conversation
                });
            }
        } catch (error) {
            console.error('Edit message error:', error);
        }
    });

    socket.on('delete_message', async (data) => {
        try {
            const Message = require('./models/Message');
            const { messageId, senderId } = data;
            const message = await Message.findById(messageId);
            if (message && message.sender.toString() === senderId) {
                message.isDeleted = true;
                message.deletedAt = new Date();
                message.content = '🚫 This message was deleted';
                await message.save();

                // Broadcast deletion to both sender and receiver
                io.to(`user_${message.receiver}`).emit('message_deleted', {
                    messageId: message._id,
                    conversationId: message.conversation
                });
                socket.emit('message_deleted', {
                    messageId: message._id,
                    conversationId: message.conversation
                });
            }
        } catch (error) {
            console.error('Delete message error:', error);
        }
    });

    socket.on('add_reaction', async (data) => {
        try {
            const Message = require('./models/Message');
            const { messageId, emoji, userId } = data;
            const message = await Message.findById(messageId);
            if (message) {
                // Check if user already reacted
                const existingReactionIndex = message.reactions?.findIndex(r => r.user?.toString() === userId) ?? -1;
                if (existingReactionIndex > -1) {
                    message.reactions[existingReactionIndex].emoji = emoji;
                } else {
                    if (!message.reactions) message.reactions = [];
                    message.reactions.push({ user: userId, emoji: emoji });
                }
                await message.save();

                // Broadcast reaction to both parties
                const targetUserId = message.sender.toString() === userId ? message.receiver : message.sender;
                io.to(`user_${targetUserId}`).emit('reaction_added', {
                    messageId: message._id,
                    reactions: message.reactions,
                    conversationId: message.conversation
                });
                socket.emit('reaction_added', {
                    messageId: message._id,
                    reactions: message.reactions,
                    conversationId: message.conversation
                });
            }
        } catch (error) {
            console.error('Add reaction error:', error);
        }
    });

    socket.on('block_user', async (data) => {
        try {
            const Block = require('./models/Block');
            const { blockerId, blockedId, isBlocked } = data;
            if (isBlocked) {
                await Block.findOneAndUpdate(
                    { blocker: blockerId, blocked: blockedId },
                    { blocker: blockerId, blocked: blockedId },
                    { upsert: true, new: true }
                );
            } else {
                await Block.findOneAndDelete({ blocker: blockerId, blocked: blockedId });
            }

            // Notify blocked user to show them as "Offline"
            io.to(`user_${blockedId}`).emit('block_status_changed', {
                by: blockerId,
                isBlocked: isBlocked
            });
            socket.emit('block_success', { blockedId, isBlocked });
        } catch (error) {
            console.error('Block user error:', error);
        }
    });

    // Webrtc Signaling
    socket.on('call_user', async (data) => {
        io.to(`user_${data.userToCall}`).emit('incoming_call', {
            ...data,
            from: socket.userId
        });
    });

    socket.on('webrtc_signal', (data) => {
        io.to(`user_${data.to}`).emit('webrtc_signal', {
            signal: data.signal,
            from: socket.userId
        });
    });

    // Frame-based Video Streaming (Expo Go fallback)
    socket.on('video_frame', (data) => {
        const { to, frame } = data;
        // Volatile emit for performance (drop frames if network congested)
        io.to(`user_${to}`).emit('video_frame', { frame, from: socket.userId });
    });

    socket.on('toggle_media', (data) => {
        const { to, type, status } = data; // type: 'video'|'audio', status: boolean
        io.to(`user_${to}`).emit('remote_media_status', { type, status });
    });

    socket.on('ice_candidate', (data) => {
        io.to(`user_${data.to}`).emit('ice_candidate', {
            candidate: data.candidate,
            from: socket.userId
        });
    });

    socket.on('answer_call', async (data) => {
        io.to(`user_${data.to}`).emit('call_accepted', data.signal);

        // Log the call start in chat history
        try {
            const Message = require('./models/Message');
            const Conversation = require('./models/Conversation');

            // Find or create conversation
            let conv = await Conversation.findOne({
                participants: { $all: [socket.userId, data.to] }
            });

            if (conv) {
                const callMsg = new Message({
                    conversation: conv._id,
                    sender: socket.userId,
                    receiver: data.to,
                    content: '📞 Call Started',
                    type: 'call'
                });
                await callMsg.save();
                io.to(`conversation_${conv._id}`).emit('new_message', callMsg);
            }
        } catch (err) {
            console.error('Call logging error:', err);
        }
    });

    socket.on('end_call', async (data) => {
        io.to(`user_${data.to}`).emit('call_ended');

        // If it was a missed call, log it
        if (data.wasMissed) {
            try {
                const Message = require('./models/Message');
                const Conversation = require('./models/Conversation');
                let conv = await Conversation.findOne({
                    participants: { $all: [socket.userId, data.to] }
                });

                if (conv) {
                    const missedMsg = new Message({
                        conversation: conv._id,
                        sender: socket.userId,
                        receiver: data.to,
                        content: '📱 Missed Call',
                        type: 'missed_call'
                    });
                    await missedMsg.save();
                    io.to(`conversation_${conv._id}`).emit('new_message', missedMsg);
                }
            } catch (err) {
                console.error('Missed call logging error:', err);
            }
        }
    });

    // Ride Tracking Events
    socket.on('join_ride', (rideId) => {
        socket.join(`ride_${rideId}`);
        console.log(`Socket ${socket.id} joined ride room: ride_${rideId}`);
    });

    socket.on('update_location', (data) => {
        const { rideId, location } = data;
        // Broadcast to everyone in the ride room EXCEPT the sender
        socket.to(`ride_${rideId}`).emit('driver_location', location);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start server
// Start Server Logic
const startServer = async () => {
    try {
        await connectDB();

        const PORT = process.env.PORT || 1000;
        server.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
