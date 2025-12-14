const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const { EDITORS } = require('../utils/constants');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const VIEWER_SESSION_HOURS = 8;
const EDITOR_SESSION_HOURS = 24;

// POST /api/auth/viewer - Viewer login with access code
router.post('/viewer', async (req, res) => {
    try {
        const { accessCode } = req.body;

        if (!accessCode) {
            return res.status(400).json({ error: 'Access code required' });
        }

        const isValid = await bcrypt.compare(accessCode, process.env.VIEWER_ACCESS_CODE_HASH);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid access code' });
        }

        const token = jwt.sign(
            { userType: 'viewer' },
            JWT_SECRET,
            { expiresIn: `${VIEWER_SESSION_HOURS}h` }
        );

        res.json({
            token,
            userType: 'viewer',
            expiresIn: VIEWER_SESSION_HOURS * 3600
        });
    } catch (error) {
        console.error('Viewer auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// POST /api/auth/login - Editor login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Check if valid editor username
        const upperUsername = username.toUpperCase();
        if (upperUsername === 'AX') {
            // AX editor
        } else if (upperUsername === 'SPW') {
            // SPW editor
        } else if (upperUsername === 'VIETH') {
            // Vieth editor
        } else {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Get the appropriate password hash
        const hashEnvVar = `EDITOR_${upperUsername}_PASSWORD_HASH`;
        const storedHash = process.env[hashEnvVar];

        if (!storedHash) {
            console.error(`Missing env var: ${hashEnvVar}`);
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const isValid = await bcrypt.compare(password, storedHash);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Normalize username for token (AX, SPW, Vieth)
        const normalizedUsername = upperUsername === 'VIETH' ? 'Vieth' : upperUsername;

        const token = jwt.sign(
            { userType: 'editor', username: normalizedUsername },
            JWT_SECRET,
            { expiresIn: `${EDITOR_SESSION_HOURS}h` }
        );

        res.json({
            token,
            userType: 'editor',
            username: normalizedUsername,
            expiresIn: EDITOR_SESSION_HOURS * 3600
        });
    } catch (error) {
        console.error('Editor auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', (req, res) => {
    // JWT tokens are stateless - client just needs to remove the token
    res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, (req, res) => {
    res.json({
        userType: req.user.userType,
        username: req.user.username || null
    });
});

module.exports = router;
