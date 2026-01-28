const express = require('express');
const router = express.Router();

// Test endpoint to trigger notifications every 2 seconds
router.get('/start-notifications', (req, res) => {
    const io = req.app.get('io');

    if (!io) {
        return res.status(500).json({ message: 'Socket.IO not initialized' });
    }

    let count = 0;
    const interval = setInterval(() => {
        count++;
        io.emit('notification', {
            title: `Welcome to My App! 🎉`,
            message: `This is test notification #${count}. Real-time notifications are working!`,
            type: 'test',
            timestamp: new Date().toISOString()
        });

        // Stop after 10 notifications (20 seconds)
        if (count >= 10) {
            clearInterval(interval);
        }
    }, 2000);

    res.json({
        message: 'Test notifications started! You will receive 10 notifications over 20 seconds.',
        count: 10,
        interval: '2 seconds'
    });
});

module.exports = router;
