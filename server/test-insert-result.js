// Test what INSERT returns in DuckDB Neo

const { DuckDBInstance } = require('@duckdb/node-api');

async function testInsertResult() {
    try {
        const instance = await DuckDBInstance.create(':memory:');
        const connection = await instance.connect();
        
        // Create table
        await connection.run('CREATE TABLE test (id INTEGER, name VARCHAR)');
        
        // Test direct insert
        console.log('Testing direct INSERT...');
        const result1 = await connection.run("INSERT INTO test VALUES (1, 'Alice')");
        console.log('Result:', result1);
        console.log('Result type:', Object.prototype.toString.call(result1));
        console.log('Result properties:', Object.keys(result1));
        console.log('Result methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(result1)));
        
        // Try rowCount
        if (typeof result1.rowCount === 'function') {
            console.log('Row count:', result1.rowCount());
        }
        
        // Test prepared insert
        console.log('\n\nTesting prepared INSERT...');
        const stmt = await connection.prepare('INSERT INTO test VALUES ($1, $2)');
        stmt.bindInteger(1, 2);
        stmt.bindVarchar(2, 'Bob');
        const result2 = await stmt.run();
        console.log('Prepared result:', result2);
        console.log('Prepared result type:', Object.prototype.toString.call(result2));
        
        // For INSERT, we might need to check affected rows differently
        console.log('\n\nChecking if we can get affected rows...');
        const countResult = await connection.runAndReadAll('SELECT COUNT(*) as count FROM test');
        console.log('Row count after inserts:', countResult.getRowObjects());
        
        stmt.destroySync();
        connection.closeSync();
        instance.closeSync();
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testInsertResult();