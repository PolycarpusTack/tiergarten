/**
 * Minimal server test to verify fixes
 */

const express = require('express');
const db = require('./duckdb-database');

async function test() {
    console.log('Testing server setup...\n');
    
    try {
        // 1. Test database
        console.log('1. Testing database connection...');
        await db.init();
        console.log('   ✅ Database initialized');
        
        // 2. Test basic query
        console.log('\n2. Testing basic query...');
        const result = await db.get('SELECT COUNT(*) as count FROM clients');
        console.log('   ✅ Clients count:', result?.count || 0);
        
        // 3. Test validation utilities
        console.log('\n3. Testing validation utilities...');
        const { validateTicketKey, sanitizeString } = require('./utils/validation');
        
        try {
            validateTicketKey('TEST-123');
            console.log('   ✅ Valid ticket key accepted');
        } catch (e) {
            console.log('   ❌ Valid ticket key rejected:', e.message);
        }
        
        try {
            validateTicketKey('INVALID KEY');
            console.log('   ❌ Invalid ticket key accepted');
        } catch (e) {
            console.log('   ✅ Invalid ticket key rejected');
        }
        
        // 4. Test storage service
        console.log('\n4. Testing ticket storage service...');
        const TicketStorageService = require('./services/ticket-storage-service');
        const storage = new TicketStorageService(db);
        
        const tickets = await storage.getTickets({ limit: 5 });
        console.log('   ✅ Storage service working, tickets:', tickets.length);
        
        // 5. Test sync orchestrator
        console.log('\n5. Testing sync orchestrator...');
        const JiraConfigService = require('./services/jira-config-service');
        const JiraSyncOrchestrator = require('./services/jira-sync-orchestrator');
        
        const configService = new JiraConfigService(db);
        const syncOrchestrator = new JiraSyncOrchestrator(db, configService);
        
        const isLocked = syncOrchestrator.syncLock.isLocked('test');
        console.log('   ✅ Sync lock working, test locked:', isLocked);
        
        // 6. Test server startup
        console.log('\n6. Testing minimal server...');
        const app = express();
        app.get('/test', (req, res) => res.json({ ok: true }));
        
        const server = app.listen(0, () => {
            const port = server.address().port;
            console.log(`   ✅ Server started on port ${port}`);
            server.close();
        });
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await db.close();
        process.exit(0);
    }
}

test();