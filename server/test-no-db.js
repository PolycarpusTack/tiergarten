const express = require('express');
const app = express();
const PORT = 3600;

console.log('Starting server without database...');

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        message: 'Tiergarten is running (no database)'
    });
});

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`Test with: curl http://localhost:${PORT}/api/health`);
    console.log('Press Ctrl+C to stop');
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
});