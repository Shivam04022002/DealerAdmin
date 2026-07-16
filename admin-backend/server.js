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

// CORS Configuration
// Nginx serves the admin SPA from /var/www/dealeradmin on the dealeradmin host
// and proxies /api/ on that same host to this backend. Browsers send an Origin
// header on same-origin POSTs, so the host the SPA is served from must be
// whitelisted or every write (login, branch create) is rejected.
const PRODUCTION_ORIGINS = [
    'https://dealeradmin.surjitfinance.com', // admin SPA + API (same host via nginx)
    'https://dealer.surjitfinance.com',      // admin SPA alias
];

const DEVELOPMENT_ORIGINS = [
    'http://localhost:5173',  // vite dev
    'http://127.0.0.1:5173',
    'http://localhost:4173',  // vite preview
    'http://127.0.0.1:4173',
];

// Compare origins without a trailing slash; browsers never send one, but
// hand-configured CORS_ORIGIN values often do.
const stripTrailingSlash = (value) => value.trim().replace(/\/+$/, '');

const getAllowedOrigins = () => {
    const fromEnv = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map(stripTrailingSlash)
        .filter(Boolean);

    const defaults = process.env.NODE_ENV === 'production'
        ? PRODUCTION_ORIGINS
        : DEVELOPMENT_ORIGINS;

    // Union: CORS_ORIGIN can add origins but can never silently drop the ones
    // this application is actually served from.
    return [...new Set([...defaults, ...fromEnv])];
};

class CorsError extends Error {
    constructor(origin) {
        super('Origin is not allowed.');
        this.name = 'CorsError';
        this.status = 403;
        this.origin = origin;
    }
}

const corsOptions = {
    origin: (origin, callback) => {
        // No Origin header: curl, health checks, server-to-server, same-origin GET.
        // CORS only constrains browsers, so this is not a bypass.
        if (!origin) return callback(null, true);

        if (getAllowedOrigins().includes(stripTrailingSlash(origin))) {
            return callback(null, true);
        }
        return callback(new CorsError(origin));
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

// Query timing + response-size middleware (development only — perf diagnostics)
if (process.env.NODE_ENV !== 'production') {
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
}

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
    // Rejected CORS origins are a client/config problem, not a server fault:
    // answer 403 rather than 500, and log enough to diagnose it (never headers,
    // tokens or bodies).
    if (err instanceof CorsError) {
        console.warn(
            `[CORS] Rejected request\n` +
            `  Incoming Origin: ${err.origin}\n` +
            `  Requested URL:   ${req.originalUrl}\n` +
            `  HTTP Method:     ${req.method}\n` +
            `  Reason:          Origin not in allowed list [${getAllowedOrigins().join(', ')}]`
        );
        return res.status(403).json({
            success: false,
            message: 'Origin is not allowed.'
        });
    }

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

