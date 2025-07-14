// Test script for database adapter

const SQLiteDatabase = require('./sqlite-db-new');

async function testDatabaseAdapter() {
    console.log('Testing database adapter...\n');
    
    // Test 1: SQLite mode (default)
    console.log('Test 1: SQLite mode');
    console.log('===================');
    
    let sqliteDb = new SQLiteDatabase();
    try {
        await sqliteDb.init();
        
        // Test basic operations
        const clients = await sqliteDb.all('SELECT * FROM clients LIMIT 3');
        console.log(`Found ${clients.length} clients`);
        
        const clientCount = await sqliteDb.get('SELECT COUNT(*) as count FROM clients');
        console.log(`Total clients: ${clientCount.count}`);
        
        // Try analytics (should fail)
        try {
            await sqliteDb.runAnalytics('SELECT tier, COUNT(*) FROM clients GROUP BY tier');
        } catch (error) {
            console.log('✓ Analytics correctly blocked in SQLite mode');
        }
        
        await sqliteDb.close();
        console.log('✓ SQLite mode test passed\n');
        
    } catch (error) {
        console.error('SQLite test failed:', error);
    }
    
    // Reset database instance
    const { resetDatabase } = require('./database-adapter');
    await resetDatabase();
    
    // Test 2: DuckDB mode
    console.log('Test 2: DuckDB mode');
    console.log('===================');
    
    process.env.USE_DUCKDB = 'true';
    let duckDb = new SQLiteDatabase();
    
    try {
        await duckDb.init();
        
        // Test basic operations
        const clients = await duckDb.all('SELECT * FROM clients LIMIT 3');
        console.log(`Found ${clients.length} clients`);
        
        const clientCount = await duckDb.get('SELECT COUNT(*) as count FROM clients');
        console.log(`Total clients: ${clientCount.count}`);
        
        // Test analytics (should work)
        const analytics = await duckDb.runAnalytics(`
            SELECT 
                tier,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
            FROM clients
            GROUP BY tier
            ORDER BY tier
        `);
        console.log('\nTier distribution (analytics query):');
        analytics.forEach(row => {
            console.log(`  Tier ${row.tier}: ${row.count} clients (${row.percentage}%)`);
        });
        
        await duckDb.close();
        console.log('\n✓ DuckDB mode test passed\n');
        
    } catch (error) {
        console.error('DuckDB test failed:', error);
    }
    
    // Clean up
    delete process.env.USE_DUCKDB;
    await resetDatabase();
    
    console.log('✅ All adapter tests completed!');
}

// Run tests
testDatabaseAdapter().catch(console.error);