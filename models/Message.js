const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String
    },
    type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'call', 'missed_call', 'sticker', 'emoji'],
        default: 'text'
    },
    stickerUrl: {
        type: String
    },
    // Media fields
    imageUrl: {
        type: String
    },
    mediaUrl: {
        type: String
    },
    mediaThumbnail: {
        type: String
    },
    mediaSize: {
        type: Number
    },
    mediaDuration: {
        type: Number // for audio/video in seconds
    },
    mediaFormat: {
        type: String
    },
    documentName: {
        type: String
    },
    // Location
    location: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    // Message features
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    reactions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        emoji: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    },
    forwardedFrom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    // Read status
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1 });

module.exports = mongoose.model('Message', messageSchema);
