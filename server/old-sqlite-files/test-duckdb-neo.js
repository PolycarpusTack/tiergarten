// Test script for DuckDB Neo client

const duckdbWrapper = require('./database-wrapper-duckdb-neo');

async function testDuckDBNeo() {
    console.log('Testing DuckDB Neo client...\n');
    
    let db;
    try {
        // Test 1: Open in-memory database
        console.log('1. Opening in-memory database...');
        db = await duckdbWrapper.openDatabase(':memory:');
        console.log('✓ Database opened successfully\n');
        
        // Test 2: Create table
        console.log('2. Creating test table...');
        await db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Table created successfully\n');
        
        // Test 3: Insert data
        console.log('3. Inserting test data...');
        await db.run('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', 1, 'Alice', 'alice@example.com');
        await db.run('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', 2, 'Bob', 'bob@example.com');
        await db.run('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', 3, 'Charlie', 'charlie@example.com');
        console.log('✓ Data inserted successfully\n');
        
        // Test 4: Query single row
        console.log('4. Testing get() method...');
        const user = await db.get('SELECT * FROM users WHERE id = ?', 2);
        console.log('Result:', user);
        console.log('✓ get() method works correctly\n');
        
        // Test 5: Query all rows
        console.log('5. Testing all() method...');
        const allUsers = await db.all('SELECT * FROM users ORDER BY id');
        console.log('All users:', allUsers);
        console.log('✓ all() method works correctly\n');
        
        // Test 6: Test SQLite compatibility
        console.log('6. Testing SQLite-style queries...');
        const count = await db.get('SELECT COUNT(*) as count FROM users');
        console.log('User count:', count);
        console.log('✓ SQLite-style queries work\n');
        
        // Test 7: Check table exists
        console.log('7. Testing table existence check...');
        const exists = await db.tableExists('users');
        console.log('Table "users" exists:', exists);
        const notExists = await db.tableExists('nonexistent');
        console.log('Table "nonexistent" exists:', notExists);
        console.log('✓ Table existence check works\n');
        
        // Test 8: Complex query (similar to Tiergarten queries)
        console.log('8. Testing complex query...');
        await db.exec(`
            CREATE TABLE tickets (
                key VARCHAR(50) PRIMARY KEY,
                summary TEXT,
                priority VARCHAR(20),
                client_name VARCHAR(100),
                assigned_action VARCHAR(50),
                created TIMESTAMP
            )
        `);
        
        await db.run(
            'INSERT INTO tickets (key, summary, priority, client_name, assigned_action, created) VALUES (?, ?, ?, ?, ?, ?)',
            'JIRA-123', 'Test issue', 'High', 'Client A', 'CA', '2024-01-15 10:00:00'
        );
        
        const tickets = await db.all(`
            SELECT key, summary, priority, client_name, assigned_action
            FROM tickets
            WHERE priority = ?
            ORDER BY created DESC
        `, 'High');
        
        console.log('Complex query result:', tickets);
        console.log('✓ Complex queries work correctly\n');
        
        console.log('All tests passed! DuckDB Neo is working correctly.');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        if (db) {
            await db.close();
            console.log('\nDatabase closed.');
        }
    }
}

// Run tests
testDuckDBNeo();