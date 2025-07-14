console.log('Step 1: Loading modules...');

try {
    const express = require('express');
    console.log('✅ Express loaded');
} catch (e) {
    console.error('❌ Express error:', e.message);
}

console.log('\nStep 2: Loading database...');
try {
    const db = require('./duckdb-database');
    console.log('✅ Database module loaded');
} catch (e) {
    console.error('❌ Database error:', e.message);
}

console.log('\nStep 3: Loading environment...');
try {
    require('dotenv').config();
    console.log('✅ Dotenv loaded');
    console.log('ENV:', {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 3600
    });
} catch (e) {
    console.error('❌ Dotenv error:', e.message);
}

console.log('\nStep 4: Creating Express app...');
try {
    const express = require('express');
    const app = express();
    console.log('✅ Express app created');
    
    app.get('/test', (req, res) => {
        res.json({ status: 'ok' });
    });
    
    const PORT = process.env.PORT || 3600;
    const server = app.listen(PORT, () => {
        console.log(`✅ Test server running on http://localhost:${PORT}`);
        console.log('Try: curl http://localhost:3600/test');
        
        // Keep running for 10 seconds
        setTimeout(() => {
            console.log('Shutting down test server...');
            server.close();
            process.exit(0);
        }, 10000);
    });
    
} catch (e) {
    console.error('❌ Server error:', e.message);
    console.error(e.stack);
}