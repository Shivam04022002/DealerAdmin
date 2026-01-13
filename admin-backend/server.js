// server.js
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import cors from 'cors';
import adminRoutes from './routes/adminRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import authRoutes from "./routes/authRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
// import mergeRoutes from './routes/mergeRoutes.js';

dotenv.config();

// CORS Configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN || 'https://yourdomain.com'
        : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization','cache-control',]
};

const app = express();

// Security headers for production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
    });
}

// Trust proxy (for nginx/load balancer)
app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint (for monitoring)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/superadmin", superadminRoutes);
// app.use('/api/merge', mergeRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// Connect to database then start server
const PORT = process.env.PORT || 5001;

const startServer = async () => {
    try {
        await connectDB();
        const server = app.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        });

        // Graceful shutdown
        const shutdown = (signal) => {
            console.log(`${signal} received. Shutting down gracefully...`);
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        };  

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();

