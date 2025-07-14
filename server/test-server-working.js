const express = require('express');
const db = require('./duckdb-database');

const app = express();
const PORT = process.env.PORT || 3600;

// Test endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        database: db.isReady() ? 'connected' : 'not connected'
    });
});

// Initialize and start
async function start() {
    try {
        console.log('Initializing database...');
        await db.init();
        console.log('Database initialized successfully');
        
        const server = app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log(`Test with: curl http://localhost:${PORT}/api/health`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down...');
            server.close(() => {
                db.close();
                process.exit(0);
            });
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();