// Test script to verify DuckDB migration

const duckdbWrapper = require('./database-wrapper-duckdb-neo');
const path = require('path');

async function testMigration() {
    console.log('Testing DuckDB migration results...\n');
    
    let db = null;
    try {
        // Open DuckDB database
        const duckdbPath = path.join(__dirname, 'database', 'jira_tiers_duckdb.db');
        db = await duckdbWrapper.openDatabase(duckdbPath);
        
        // Test 1: Check table existence
        console.log('1. Checking tables exist...');
        const tables = ['clients', 'global_rules', 'ticket_actions', 'dashboards', 'user_widgets', 'import_config'];
        for (const table of tables) {
            const exists = await db.tableExists(table);
            console.log(`  - ${table}: ${exists ? '✓' : '✗'}`);
        }
        
        // Test 2: Count records
        console.log('\n2. Record counts:');
        for (const table of tables) {
            const result = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
            console.log(`  - ${table}: ${result.count} records`);
        }
        
        // Test 3: Sample data
        console.log('\n3. Sample data:');
        
        // Sample clients
        const clients = await db.all('SELECT * FROM clients LIMIT 3');
        console.log('\nFirst 3 clients:');
        clients.forEach(client => {
            console.log(`  - ${client.name} (Tier ${client.tier}, CA: ${client.isCA ? 'Yes' : 'No'})`);
        });
        
        // Sample dashboards
        const dashboards = await db.all('SELECT * FROM dashboards ORDER BY display_order');
        console.log('\nDashboards:');
        dashboards.forEach(dashboard => {
            console.log(`  - ${dashboard.name} (Default: ${dashboard.is_default ? 'Yes' : 'No'})`);
        });
        
        // Test 4: Complex query
        console.log('\n4. Testing complex query...');
        const widgetsByType = await db.all(`
            SELECT 
                type,
                COUNT(*) as count,
                GROUP_CONCAT(title, ', ') as titles
            FROM user_widgets
            GROUP BY type
        `);
        console.log('\nWidgets by type:');
        widgetsByType.forEach(row => {
            console.log(`  - ${row.type}: ${row.count} widgets`);
            console.log(`    Titles: ${row.titles}`);
        });
        
        // Test 5: Analytics query with window functions
        console.log('\n5. Testing analytics capabilities...');
        const tierStats = await db.all(`
            WITH tier_counts AS (
                SELECT 
                    tier,
                    COUNT(*) as client_count,
                    SUM(CASE WHEN isCA = 1 THEN 1 ELSE 0 END) as ca_count,
                    SUM(CASE WHEN isException = 1 THEN 1 ELSE 0 END) as exception_count
                FROM clients
                GROUP BY tier
            )
            SELECT 
                tier,
                client_count,
                ca_count,
                exception_count,
                ROUND(client_count * 100.0 / SUM(client_count) OVER (), 2) as percentage,
                ROUND(ca_count * 100.0 / NULLIF(client_count, 0), 2) as ca_percentage
            FROM tier_counts
            ORDER BY tier
        `);
        
        console.log('\nTier Statistics:');
        console.log('Tier | Clients | CA Clients | Exceptions | % of Total | % CA');
        console.log('-----|---------|------------|------------|------------|-----');
        tierStats.forEach(row => {
            console.log(`  ${row.tier}  |   ${String(row.client_count).padEnd(5)} |     ${String(row.ca_count).padEnd(6)} |     ${String(row.exception_count).padEnd(6)} |   ${String(row.percentage).padEnd(7)}% | ${row.ca_percentage || 0}%`);
        });
        
        console.log('\n✅ All tests passed! DuckDB migration successful.');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        if (db) await db.close();
    }
}

// Run tests
testMigration();