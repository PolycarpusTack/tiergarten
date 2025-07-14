// Test script to explore DuckDB Neo API

const { DuckDBInstance } = require('@duckdb/node-api');

async function exploreDuckDBAPI() {
    try {
        console.log('Exploring DuckDB Neo API...\n');
        
        // Create instance
        const instance = await DuckDBInstance.create(':memory:');
        console.log('Instance created');
        console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
        
        // Create connection
        const connection = await instance.connect();
        console.log('\nConnection created');
        console.log('Connection methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(connection)));
        
        // Create a table
        await connection.run('CREATE TABLE test (id INTEGER, name VARCHAR)');
        console.log('\nTable created');
        
        // Prepare a statement
        const stmt = await connection.prepare('INSERT INTO test VALUES ($1, $2)');
        console.log('\nPrepared statement created');
        console.log('Statement methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(stmt)));
        
        // Try to bind and run
        stmt.bindInteger(1, 42);
        stmt.bindVarchar(2, 'test');
        
        const result = await stmt.run();
        console.log('\nResult object created');
        console.log('Result methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(result)));
        
        // Try to close statement
        if (typeof stmt.close === 'function') {
            await stmt.close();
            console.log('\nStatement closed with close()');
        } else if (typeof stmt.finalize === 'function') {
            await stmt.finalize();
            console.log('\nStatement closed with finalize()');
        } else {
            console.log('\nNo close method found on statement');
        }
        
        // Try simple query
        const queryResult = await connection.run('SELECT * FROM test');
        console.log('\nQuery result:', await queryResult.fetchAll());
        
        // Close connection
        if (typeof connection.close === 'function') {
            connection.close();
        } else if (typeof connection.closeSync === 'function') {
            connection.closeSync();
        } else if (typeof connection.disconnect === 'function') {
            connection.disconnect();
        }
        
        // Close instance
        if (typeof instance.close === 'function') {
            instance.close();
        } else if (typeof instance.closeSync === 'function') {
            instance.closeSync();
        }
        
        console.log('\nDone!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

exploreDuckDBAPI();