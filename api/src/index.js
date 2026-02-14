const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const scheduler = require('./services/scheduler');

// Workers

// Routes
const adminRoutes = require('./routes/admin');
const schedulesRoutes = require('./routes/schedules');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');
const logsRoutes = require('./routes/logs');
const rolesRoutes = require('./routes/roles');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/logs', logsRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin/roles', rolesRoutes);
app.use('/api/admin/users', require('./routes/users'));
app.use('/api/admin/schedules', schedulesRoutes);
app.use('/api/admin', adminRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Start server
async function startServer() {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start Express server
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Start scheduler service
        if (process.env.ENABLE_SCHEDULER === 'true') {
            await scheduler.start();
        }

        // Initialize Job Queue (Clean up stuck jobs)
        const jobQueue = require('./services/jobQueue');
        await jobQueue.init();

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    scheduler.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    scheduler.stop();
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
