const Group = require('../models/Group');
const User = require('../models/User');
const Message = require('../models/Message');

// Create new group
exports.createGroup = async (req, res) => {
    try {
        const { name, description, memberIds } = req.body;
        const creatorId = req.user._id;

        if (!name || !memberIds || memberIds.length === 0) {
            return res.status(400).json({ message: 'Group name and members are required' });
        }

        // Create members array with creator as admin
        const members = [
            { user: creatorId, role: 'admin' }
        ];

        // Add other members
        memberIds.forEach(memberId => {
            if (memberId !== creatorId.toString()) {
                members.push({ user: memberId, role: 'member' });
            }
        });

        const group = new Group({
            name,
            description,
            members,
            createdBy: creatorId
        });

        await group.save();
        await group.populate('members.user', 'name profilePicture avatar');
        await group.populate('createdBy', 'name profilePicture avatar');

        res.json({ group });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ message: 'Failed to create group' });
    }
};

// Get user's groups
exports.getUserGroups = async (req, res) => {
    try {
        const userId = req.user._id;

        const groups = await Group.find({
            'members.user': userId
        })
            .populate('members.user', 'name profilePicture avatar')
            .populate('lastMessageSender', 'name')
            .sort({ lastMessageTime: -1 });

        res.json({ groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ message: 'Failed to fetch groups' });
    }
};

// Get group details
exports.getGroupDetails = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId)
            .populate('members.user', 'name profilePicture avatar email')
            .populate('createdBy', 'name profilePicture avatar');

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is member
        const isMember = group.members.some(m => m.user._id.toString() === userId.toString());
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        res.json({ group });
    } catch (error) {
        console.error('Get group details error:', error);
        res.status(500).json({ message: 'Failed to fetch group details' });
    }
};

// Update group
exports.updateGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description, icon } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is admin
        const member = group.members.find(m => m.user.toString() === userId.toString());
        if (!member || member.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can update group' });
        }

        if (name) group.name = name;
        if (description !== undefined) group.description = description;
        if (icon) group.icon = icon;

        await group.save();
        await group.populate('members.user', 'name profilePicture avatar');

        res.json({ group });
    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({ message: 'Failed to update group' });
    }
};

// Add members to group
exports.addMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { memberIds } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is admin
        const member = group.members.find(m => m.user.toString() === userId.toString());
        if (!member || member.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can add members' });
        }

        // Add new members
        memberIds.forEach(memberId => {
            const exists = group.members.some(m => m.user.toString() === memberId);
            if (!exists) {
                group.members.push({ user: memberId, role: 'member' });
            }
        });

        await group.save();
        await group.populate('members.user', 'name profilePicture avatar');

        res.json({ group });
    } catch (error) {
        console.error('Add members error:', error);
        res.status(500).json({ message: 'Failed to add members' });
    }
};

// Remove member from group
exports.removeMember = async (req, res) => {
    try {
        const { groupId, userId: memberToRemove } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is admin
        const member = group.members.find(m => m.user.toString() === userId.toString());
        if (!member || member.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can remove members' });
        }

        // Don't allow removing the creator
        if (memberToRemove === group.createdBy.toString()) {
            return res.status(400).json({ message: 'Cannot remove group creator' });
        }

        group.members = group.members.filter(m => m.user.toString() !== memberToRemove);
        await group.save();
        await group.populate('members.user', 'name profilePicture avatar');

        res.json({ group });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ message: 'Failed to remove member' });
    }
};

// Leave group
exports.leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Don't allow creator to leave
        if (userId.toString() === group.createdBy.toString()) {
            return res.status(400).json({ message: 'Group creator cannot leave. Delete the group instead.' });
        }

        group.members = group.members.filter(m => m.user.toString() !== userId.toString());
        await group.save();

        res.json({ message: 'Left group successfully' });
    } catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({ message: 'Failed to leave group' });
    }
};

// Delete group
exports.deleteGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Only creator can delete
        if (userId.toString() !== group.createdBy.toString()) {
            return res.status(403).json({ message: 'Only group creator can delete group' });
        }

        await Group.findByIdAndDelete(groupId);

        // Optionally delete all group messages
        await Message.deleteMany({ group: groupId });

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ message: 'Failed to delete group' });
    }
};

// Promote/demote admin
exports.updateMemberRole = async (req, res) => {
    try {
        const { groupId, userId: targetUserId } = req.params;
        const { role } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is admin
        const member = group.members.find(m => m.user.toString() === userId.toString());
        if (!member || member.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can change roles' });
        }

        // Update role
        const targetMember = group.members.find(m => m.user.toString() === targetUserId);
        if (targetMember) {
            targetMember.role = role;
            await group.save();
            await group.populate('members.user', 'name profilePicture avatar');
        }

        res.json({ group });
    } catch (error) {
        console.error('Update member role error:', error);
        res.status(500).json({ message: 'Failed to update member role' });
    }
};
