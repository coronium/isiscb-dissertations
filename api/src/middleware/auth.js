const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Require editor role
function requireEditor(req, res, next) {
    if (!req.user || req.user.userType !== 'editor') {
        return res.status(403).json({ error: 'Editor access required' });
    }
    next();
}

// Require at least viewer role
function requireViewer(req, res, next) {
    if (!req.user || !['viewer', 'editor'].includes(req.user.userType)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
}

module.exports = {
    authenticateToken,
    requireEditor,
    requireViewer
};
