const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sharedPost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    content: {
        type: String,
        required: true,
        maxlength: 2000
    },
    images: [{
        type: String // URLs to images
    }],
    videos: [{
        type: String // URLs to videos
    }],
    background: {
        type: String // Hex color code or gradient name
    },
    rideDetails: {
        from: String,
        to: String,
        date: Date,
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        distance: String,
        duration: String
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }],
    shares: {
        type: Number,
        default: 0
    },
    views: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for faster queries
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

// Virtual for like count
postSchema.virtual('likeCount').get(function () {
    return this.likes.length;
});

// Virtual for comment count
postSchema.virtual('commentCount').get(function () {
    return this.comments.length;
});

postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);
