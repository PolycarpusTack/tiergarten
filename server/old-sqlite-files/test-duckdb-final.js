// Final test to understand how to use DuckDB Neo properly

const { DuckDBInstance } = require('@duckdb/node-api');

async function finalTest() {
    try {
        console.log('Final DuckDB Neo test...\n');
        
        // Create instance and connection
        const instance = await DuckDBInstance.create(':memory:');
        const connection = await instance.connect();
        
        // Create and populate table
        await connection.run('CREATE TABLE test (id INTEGER, name VARCHAR)');
        await connection.run("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')");
        
        // Test 1: Get row objects (what we need for SQLite compatibility)
        console.log('Test 1: Getting row objects');
        const reader1 = await connection.runAndReadAll('SELECT * FROM test ORDER BY id');
        const rowObjects = reader1.getRowObjects();
        console.log('Row objects:', rowObjects);
        console.log('First row:', rowObjects[0]);
        console.log('Type check:', Array.isArray(rowObjects), typeof rowObjects[0]);
        
        // Test 2: Get single row
        console.log('\n\nTest 2: Getting single row');
        const reader2 = await connection.runAndReadAll('SELECT * FROM test WHERE id = 2');
        const singleRowObjects = reader2.getRowObjects();
        console.log('Single row result:', singleRowObjects);
        console.log('First (only) row:', singleRowObjects[0]);
        
        // Test 3: Using prepared statement
        console.log('\n\nTest 3: Prepared statement');
        const stmt = await connection.prepare('SELECT * FROM test WHERE id = $1');
        stmt.bindInteger(1, 3);
        const reader3 = await stmt.runAndReadAll();
        const preparedResult = reader3.getRowObjects();
        console.log('Prepared result:', preparedResult);
        
        // Test 4: Insert with prepared statement
        console.log('\n\nTest 4: Insert with prepared statement');
        const insertStmt = await connection.prepare('INSERT INTO test VALUES ($1, $2)');
        insertStmt.bindInteger(1, 4);
        insertStmt.bindVarchar(2, 'David');
        const insertResult = await insertStmt.run();
        console.log('Insert result:', insertResult);
        console.log('Insert result methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(insertResult)));
        
        // Verify insert
        const reader4 = await connection.runAndReadAll('SELECT * FROM test ORDER BY id');
        console.log('All rows after insert:', reader4.getRowObjects());
        
        // Clean up
        stmt.destroySync();
        insertStmt.destroySync();
        connection.closeSync();
        instance.closeSync();
        
        console.log('\nSuccess! We know how to use DuckDB Neo now.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

finalTest();