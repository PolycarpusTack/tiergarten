// Test script to verify DuckDB-WASM works in Node.js v22

async function testDuckDB() {
    try {
        console.log('Testing DuckDB-WASM in Node.js v22...');
        
        // Import DuckDB-WASM
        const duckdb = await import('@duckdb/duckdb-wasm');
        console.log('✓ DuckDB-WASM module loaded');
        
        // Get bundles
        const bundles = duckdb.getJsDelivrBundles();
        console.log('✓ Bundles retrieved');
        
        // For testing, let's try the simplest initialization
        // In Node.js, we might need to use the node-specific approach
        console.log('Available bundle types:', Object.keys(bundles));
        
        // Try to create a simple in-memory database
        // Note: DuckDB-WASM is primarily designed for browser use
        // For Node.js, we might want to consider using regular DuckDB Node.js bindings
        
        console.log('\nImportant: DuckDB-WASM is primarily designed for browser environments.');
        console.log('For Node.js server applications, consider using the native DuckDB Node.js bindings instead:');
        console.log('npm install duckdb');
        
    } catch (error) {
        console.error('Error testing DuckDB-WASM:', error);
    }
}

// Alternative: Test native DuckDB for Node.js
async function testNativeDuckDB() {
    console.log('\n\nAlternative: Testing if native DuckDB would work better for Node.js...');
    console.log('To use native DuckDB in Node.js:');
    console.log('1. npm install duckdb');
    console.log('2. Use like this:');
    console.log(`
const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:'); // or file path

db.run('CREATE TABLE users (id INTEGER, name TEXT)', (err) => {
    if (err) console.error(err);
    
    db.run("INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob')", (err) => {
        if (err) console.error(err);
        
        db.all('SELECT * FROM users', (err, rows) => {
            if (err) console.error(err);
            console.log(rows);
        });
    });
});
    `);
}

testDuckDB().then(() => testNativeDuckDB());