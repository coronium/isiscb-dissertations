require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const dissertationsRoutes = require('./routes/dissertations');
const authoritiesRoutes = require('./routes/authorities');
const exportRoutes = require('./routes/export');
const explorerRoutes = require('./routes/explorer');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? [
            'https://isiscb-dissertations.onrender.com',
            'https://isiscb-dissertations-explorer.onrender.com'
          ]
        : true,  // Allow all origins in development
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dissertations', dissertationsRoutes);
app.use('/api/authorities', authoritiesRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/explorer', explorerRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});

module.exports = app;
