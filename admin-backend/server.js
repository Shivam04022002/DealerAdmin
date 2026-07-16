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
import formTrackingRoutes from "./routes/formTrackingRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";
import { autoMergeApplications } from "./services/autoMergeService.js";
// import mergeRoutes from './routes/mergeRoutes.js';

dotenv.config();

// CORS Configuration - supports multiple origins (comma-separated in .env)
const getAllowedOrigins = () => {
    if (process.env.NODE_ENV !== 'production') {
        return '*'; // Allow all in development
    }
    const origins = process.env.CORS_ORIGIN || 'https://dealer.surjitfinance.com';
    return origins.split(',').map(origin => origin.trim());
};

const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'cache-control']
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

// Query timing + response-size middleware
app.use((req, res, next) => {
    const t0 = Date.now();
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const ms = Date.now() - t0;
        const bytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
        if (ms > 200 || bytes > 50000) {
            console.log(`[API] ${req.method} ${req.path} → ${ms}ms  ${(bytes / 1024).toFixed(1)}KB`);
        }
        return originalJson(body);
    };
    next();
});

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
app.use("/api/form-tracking", formTrackingRoutes);
app.use("/api/branches", branchRoutes);
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

        // Startup sweep — catch anything submitted while server was down
        setImmediate(() => {
            autoMergeApplications()
                .then((s) => console.log('[autoMerge] Startup sweep complete', s))
                .catch((err) => console.error('[autoMerge] Startup sweep failed:', err.message));
        });

        // Recovery interval — safety net for any orphaned records.
        // Primary merge path is POST /api/workflow/merge/:formId (called by mobile backend).
        // This catches edge cases: network failures, retries, or mobile backend not yet updated.
        const RECOVERY_INTERVAL_MS = 60 * 1000; // 60 seconds
        setInterval(() => {
            autoMergeApplications()
                .then((s) => { if (s.merged > 0) console.log('[autoMerge] Recovery sweep merged', s.merged, 'orphaned records'); })
                .catch((err) => console.error('[autoMerge] Recovery sweep failed:', err.message));
        }, RECOVERY_INTERVAL_MS);
        console.log(`[autoMerge] Recovery sweep scheduled every ${RECOVERY_INTERVAL_MS / 1000}s`);

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

