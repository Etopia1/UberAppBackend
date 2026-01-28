const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log('❌ Auth Error: No Authorization header');
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    if (!token) {
        console.log('❌ Auth Error: Empty token');
        return res.status(401).json({ message: 'Invalid token format' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // attach user info
        console.log(`✅ Auth Success: User ${decoded._id || decoded.id} authenticated`);
        next();
    } catch (err) {
        console.error('❌ Auth Error:', err.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = authenticate;
// For compatibility with different import styles
module.exports.authenticate = authenticate;
module.exports.auth = authenticate;
