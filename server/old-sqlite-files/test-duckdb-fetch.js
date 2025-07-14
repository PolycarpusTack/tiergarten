// Test script to understand DuckDB Neo result fetching

const { DuckDBInstance } = require('@duckdb/node-api');

async function testResultFetching() {
    try {
        console.log('Testing DuckDB Neo result fetching...\n');
        
        // Create instance and connection
        const instance = await DuckDBInstance.create(':memory:');
        const connection = await instance.connect();
        
        // Create and populate table
        await connection.run('CREATE TABLE test (id INTEGER, name VARCHAR)');
        await connection.run("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')");
        
        // Test 1: Using runAndReadAll
        console.log('Test 1: Using runAndReadAll');
        const result1 = await connection.runAndReadAll('SELECT * FROM test');
        console.log('Result:', result1);
        console.log('Type:', typeof result1, Array.isArray(result1) ? 'isArray' : 'notArray');
        
        // Test 2: Using run and getChunk
        console.log('\n\nTest 2: Using run and getChunk');
        const result2 = await connection.run('SELECT * FROM test');
        console.log('Result object:', result2);
        console.log('Row count:', result2.rowCount());
        console.log('Chunk count:', result2.chunkCount());
        
        if (result2.chunkCount() > 0) {
            const chunk = result2.getChunk(0);
            console.log('Chunk 0:', chunk);
            console.log('Chunk methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(chunk)));
            
            // Try to get column names
            if (chunk.columnNames) {
                console.log('Column names:', chunk.columnNames());
            }
            
            // Try to get data
            if (chunk.getChildAt) {
                console.log('Number of columns:', chunk.numChildren);
                for (let i = 0; i < chunk.numChildren; i++) {
                    const column = chunk.getChildAt(i);
                    console.log(`Column ${i}:`, {
                        name: column.name,
                        length: column.length,
                        data: column.toArray ? column.toArray() : 'no toArray method'
                    });
                }
            }
        }
        
        // Test 3: Using prepared statement
        console.log('\n\nTest 3: Using prepared statement');
        const stmt = await connection.prepare('SELECT * FROM test WHERE id = $1');
        stmt.bindInteger(1, 2);
        const result3 = await stmt.runAndReadAll();
        console.log('Prepared result:', result3);
        
        // Clean up
        stmt.destroySync();
        connection.closeSync();
        instance.closeSync();
        
        console.log('\nDone!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testResultFetching();