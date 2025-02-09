require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { connectToDatabase } = require('./Configs/db.config');
const apiRoutes = require('./Routes/index');

const app = express();

// CORS configuration for both HTTP and HTTPS
app.use(cors({
    origin: [
        'http://192.168.1.102:3100',
        'https://192.168.1.102:3100',
        'http://localhost:3100',
        'https://localhost:3100',
        'http://localhost:5173',
        'exp://192.168.1.102:8081'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Helmet configuration
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

// Body parser configuration
app.use(express.json({
    limit: '100mb',
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

app.use(express.urlencoded({
    limit: '100mb',
    extended: true,
    parameterLimit: 50000
}));

// Headers middleware
app.use((req, res, next) => {
    const allowedOrigins = [
        'http://192.168.1.102:3100',
        'https://192.168.1.102:3100',
        'http://localhost:3100',
        'https://localhost:3100',
        'exp://192.168.1.102:8081'
    ];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// Routes
app.get('/', async (req, res) => {
    // simple english: testing DB connection; if false, check DB_SERVER environment variable for correct host
    const dbStatus = await connectToDatabase();
    res.json({ 
        message: 'Welcome to My Store API',
        database_status: dbStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

app.use('/api', apiRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err instanceof SyntaxError && err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'Request entity too large. Please reduce the file size.'
        });
    }

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'Bad request: Invalid JSON'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
const PORT = process.env.PORT || 3100;

// Create HTTP server
const httpServer = http.createServer(app);

// Start HTTP server
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Server accessible at:');
    console.log(`- Local HTTP: http://localhost:${PORT}`);
    console.log(`- Network HTTP: http://192.168.1.102:${PORT}`);
});

// Try to create HTTPS server if certificates exist
try {
    const sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'ssl', 'private.key')),
        cert: fs.readFileSync(path.join(__dirname, 'ssl', 'certificate.pem'))
    };
    
    const httpsServer = https.createServer(sslOptions, app);
    const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
    
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`- Local HTTPS: https://localhost:${HTTPS_PORT}`);
        console.log(`- Network HTTPS: https://192.168.1.102:${HTTPS_PORT}`);
    });
} catch (error) {
    console.log('HTTPS server not started (SSL certificates not found)');
}

module.exports = app;
