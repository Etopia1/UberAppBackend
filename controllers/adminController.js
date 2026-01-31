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

// Get Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    try {
        const totalRides = await require('../models/Ride').countDocuments();
        const totalFlights = await require('../models/Booking').countDocuments();

        // Calculate Revenue (Rides + Flights)
        const ridesRevenue = await require('../models/Ride').aggregate([
            { $group: { _id: null, total: { $sum: "$fare" } } }
        ]);
        const flightsRevenue = await require('../models/Booking').aggregate([
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);

        const totalRevenue = (ridesRevenue[0]?.total || 0) + (flightsRevenue[0]?.total || 0);

        // Find Top User (Most Rides)
        const topUserAgg = await require('../models/Ride').aggregate([
            { $group: { _id: "$user", count: { $sum: 1 }, totalSpent: { $sum: "$fare" } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDetails' } },
            { $unwind: "$userDetails" }
        ]);

        let topUser = null;
        if (topUserAgg.length > 0) {
            topUser = {
                name: topUserAgg[0].userDetails.name,
                email: topUserAgg[0].userDetails.email,
                avatar: topUserAgg[0].userDetails.avatar,
                rideCount: topUserAgg[0].count,
                totalSpent: topUserAgg[0].totalSpent
            };
        }

        // Calculate Monthly Revenue (Last 6 Months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyRevenue = await require('../models/Ride').aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo }, status: 'completed' } },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    total: { $sum: "$fare" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Format for Chart (Labels and Data)
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = {
            labels: [],
            data: []
        };

        // Fill in data (simplified for brevity, realistically would map all months)
        monthlyRevenue.forEach(item => {
            chartData.labels.push(monthNames[item._id - 1]);
            chartData.data.push(item.total);
        });

        // If no data, provide at least empty structure or defaults so chart doesn't crash
        if (chartData.data.length === 0) {
            chartData.labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
            chartData.data = [0, 0, 0, 0, 0, 0];
        }

        res.json({
            stats: {
                totalRides,
                totalFlights,
                totalRevenue,
                topUser,
                revenueChart: chartData
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = exports;
