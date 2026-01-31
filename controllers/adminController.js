const User = require('../models/User');
const Post = require('../models/Post');
// const Comment = require('../models/Comment'); // If you have comments model

// Get All Users (Riders & Drivers)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password -otp -otpExpires') // Exclude sensitive info
            .sort({ createdAt: -1 });
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Ban User
exports.banUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.role === 'admin') return res.status(403).json({ message: 'Cannot ban an admin' });

        user.isBanned = true;
        await user.save();

        res.json({ message: `User ${user.name} has been banned`, userId: user._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Unban User
exports.unbanUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isBanned = false;
        await user.save();

        res.json({ message: `User ${user.name} has been unbanned`, userId: user._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get All Posts (for moderation)
exports.getAllPosts = async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('author', 'name email avatar')
            .sort({ createdAt: -1 });
        res.json({ posts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete Content (Post)
exports.deletePost = async (req, res) => {
    try {
        const { postId } = req.body;

        let post = await Post.findById(postId);
        if (!post) {
            // Try formatting if needed, but standard ID should work
            return res.status(404).json({ message: 'Post not found' });
        }

        await Post.findByIdAndDelete(postId);
        res.json({ message: 'Post deleted by Admin', postId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = exports;
