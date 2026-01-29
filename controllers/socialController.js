const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Follow = require('../models/Follow');
const Block = require('../models/Block');
const User = require('../models/User');

// Get personalized feed
exports.getFeed = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10 } = req.query;

        // Get users that current user follows
        const following = await Follow.find({ follower: userId }).select('following');
        const followingIds = following.map(f => f.following);
        followingIds.push(userId); // Include own posts

        const posts = await Post.find({ author: { $in: followingIds } })
            .populate('author', 'name profilePicture avatar bio')
            .populate({
                path: 'sharedPost',
                populate: { path: 'author', select: 'name profilePicture avatar' }
            })
            .populate({
                path: 'comments',
                populate: { path: 'author', select: 'name profilePicture avatar' },
                options: { limit: 3, sort: { createdAt: -1 } }
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Post.countDocuments({ author: { $in: followingIds } });

        res.json({
            posts,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Get feed error:', error);
        res.status(500).json({ message: 'Failed to fetch feed' });
    }
};

// Get single post
exports.getPost = async (req, res) => {
    try {
        const { postId } = req.params;

        const post = await Post.findById(postId)
            .populate('author', 'name profilePicture avatar bio')
            .populate({
                path: 'sharedPost',
                populate: { path: 'author', select: 'name profilePicture avatar' }
            })
            .populate({
                path: 'comments',
                populate: { path: 'author', select: 'name profilePicture avatar' }
            });

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Increment views
        post.views += 1;
        await post.save();

        res.json({ post });
    } catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({ message: 'Failed to fetch post' });
    }
};

// Create new post
exports.createPost = async (req, res) => {
    try {
        const { content, images, videos, background, rideDetails, sharedPost } = req.body;
        const userId = req.user._id;

        console.log('Creating post for user:', userId);

        if (sharedPost) {
            // Increment share count of original post
            await Post.findByIdAndUpdate(sharedPost, { $inc: { shares: 1 } });
        }

        const post = new Post({
            author: userId,
            content,
            images: images || [],
            videos: videos || [],
            background,
            rideDetails,
            sharedPost
        });

        await post.save();
        await post.populate('author', 'name profilePicture avatar bio');
        if (sharedPost) {
            await post.populate({
                path: 'sharedPost',
                populate: { path: 'author', select: 'name profilePicture avatar' }
            });
        }

        // Update user's post count
        await User.findByIdAndUpdate(userId, { $inc: { postsCount: 1 } });

        console.log('Post created successfully:', post._id);
        res.json({ post });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ message: 'Failed to create post', error: error.message });
    }
};

// Delete post
exports.deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user._id;

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this post' });
        }

        // Delete all comments
        await Comment.deleteMany({ post: postId });

        await Post.findByIdAndDelete(postId);

        // Update user's post count
        await User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } });

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ message: 'Failed to delete post' });
    }
};

// Like/Unlike post
exports.likePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user._id;

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const likeIndex = post.likes.indexOf(userId);

        if (likeIndex > -1) {
            // Unlike
            post.likes.splice(likeIndex, 1);
        } else {
            // Like
            post.likes.push(userId);
        }

        await post.save();

        res.json({ liked: likeIndex === -1, likeCount: post.likes.length });
    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({ message: 'Failed to like post' });
    }
};

// Add comment
exports.addComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user._id;

        const comment = new Comment({
            post: postId,
            author: userId,
            content
        });

        await comment.save();
        await comment.populate('author', 'name profilePicture avatar');

        // Add comment to post
        await Post.findByIdAndUpdate(postId, {
            $push: { comments: comment._id }
        });

        res.json({ comment });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: 'Failed to add comment' });
    }
};

// Get post comments
exports.getComments = async (req, res) => {
    try {
        const { postId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const comments = await Comment.find({ post: postId })
            .populate('author', 'name profilePicture avatar')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Comment.countDocuments({ post: postId });

        res.json({
            comments,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ message: 'Failed to fetch comments' });
    }
};

// Follow/Unfollow user
exports.toggleFollow = async (req, res) => {
    try {
        const { userId } = req.params;
        const followerId = req.user._id;

        if (userId === followerId.toString()) {
            return res.status(400).json({ message: 'Cannot follow yourself' });
        }

        const existingFollow = await Follow.findOne({
            follower: followerId,
            following: userId
        });

        if (existingFollow) {
            // Unfollow
            await Follow.deleteOne({ _id: existingFollow._id });
            await User.findByIdAndUpdate(userId, { $inc: { followersCount: -1 } });
            await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
            res.json({ following: false });
        } else {
            // Follow
            const follow = new Follow({
                follower: followerId,
                following: userId
            });
            await follow.save();
            await User.findByIdAndUpdate(userId, { $inc: { followersCount: 1 } });
            await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
            res.json({ following: true });
        }
    } catch (error) {
        console.error('Toggle follow error:', error);
        res.status(500).json({ message: 'Failed to toggle follow' });
    }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        const user = await User.findById(userId).select('-password -otp -otpExpires');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if current user follows this user
        const isFollowing = await Follow.findOne({
            follower: currentUserId,
            following: userId
        });

        res.json({
            user,
            isFollowing: !!isFollowing
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ message: 'Failed to fetch user profile' });
    }
};

// Get user's posts
exports.getUserPosts = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 12 } = req.query;

        const posts = await Post.find({ author: userId })
            .populate('author', 'name profilePicture avatar')
            .populate({
                path: 'sharedPost',
                populate: { path: 'author', select: 'name profilePicture avatar' }
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Post.countDocuments({ author: userId });

        res.json({
            posts,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Get user posts error:', error);
        res.status(500).json({ message: 'Failed to fetch user posts' });
    }
};

// Get all users (for discovery)
exports.getAllUsers = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const { page = 1, limit = 20, search = '' } = req.query;

        const query = {
            _id: { $ne: currentUserId }
        };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('name email profilePicture avatar bio followersCount followingCount')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Check which users the current user follows
        const following = await Follow.find({ follower: currentUserId }).select('following');
        const followingIds = following.map(f => f.following.toString());

        const usersWithFollowStatus = users.map(user => ({
            ...user.toObject(),
            isFollowing: followingIds.includes(user._id.toString())
        }));

        const total = await User.countDocuments(query);

        res.json({
            users: usersWithFollowStatus,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
};
// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        console.log('Update Profile Request Body:', req.body);
        console.log('Update Profile User:', req.user);

        if (!req.user || !req.user._id) {
            console.error('Update Profile Error: No user ID provided in token');
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const userId = req.user._id;
        const { name, bio, location, profilePicture } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (location !== undefined) updateData.location = location;
        if (profilePicture) updateData.profilePicture = profilePicture;

        console.log('Updating user:', userId, 'with data:', updateData);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        ).select('-password -otp -otpExpires');

        if (!updatedUser) {
            console.error('Update Profile Error: User not found in database');
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('User updated successfully:', updatedUser._id);
        res.json({ user: updatedUser });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
};

// Block a user
exports.blockUser = async (req, res) => {
    try {
        const { userId } = req.params; // The user to block
        const currentUserId = req.user._id;

        if (userId === currentUserId.toString()) {
            return res.status(400).json({ message: 'Cannot block yourself' });
        }

        // Check if already blocked
        const existingBlock = await Block.findOne({ blocker: currentUserId, blocked: userId });
        if (existingBlock) {
            return res.status(200).json({ message: 'User already blocked' });
        }

        const block = new Block({
            blocker: currentUserId,
            blocked: userId
        });
        await block.save();

        // Optional: Unfollow if blocking
        await Follow.deleteOne({ follower: currentUserId, following: userId });
        await Follow.deleteOne({ follower: userId, following: currentUserId });

        res.json({ message: 'User blocked successfully' });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ message: 'Failed to block user' });
    }
};

// Unblock a user
exports.unblockUser = async (req, res) => {
    try {
        const { userId } = req.params; // The user to unblock
        const currentUserId = req.user._id;

        await Block.deleteOne({ blocker: currentUserId, blocked: userId });

        res.json({ message: 'User unblocked successfully' });
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ message: 'Failed to unblock user' });
    }
};
