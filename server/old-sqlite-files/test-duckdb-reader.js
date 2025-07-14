// Test script to understand DuckDBResultReader

const { DuckDBInstance } = require('@duckdb/node-api');

async function testResultReader() {
    try {
        console.log('Understanding DuckDBResultReader...\n');
        
        // Create instance and connection
        const instance = await DuckDBInstance.create(':memory:');
        const connection = await instance.connect();
        
        // Create and populate table
        await connection.run('CREATE TABLE test (id INTEGER, name VARCHAR)');
        await connection.run("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')");
        
        // Get result reader
        const reader = await connection.runAndReadAll('SELECT * FROM test ORDER BY id');
        console.log('Reader object:', reader);
        console.log('Reader methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(reader)));
        console.log('Reader properties:', Object.keys(reader));
        
        // Check chunks
        console.log('\nChunks:', reader.chunks);
        console.log('Current row count:', reader.currentRowCount_);
        console.log('Done:', reader.done_);
        
        if (reader.chunks && reader.chunks.length > 0) {
            const chunk = reader.chunks[0];
            console.log('\nFirst chunk:', chunk);
            console.log('Chunk methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(chunk)));
            
            // Try different ways to access data
            if (chunk.columnCount) {
                console.log('Column count:', chunk.columnCount());
            }
            
            if (chunk.getColumnVector) {
                try {
                    const col0 = chunk.getColumnVector(0);
                    console.log('Column 0 vector:', col0);
                } catch (e) {
                    console.log('getColumnVector error:', e.message);
                }
            }
            
            // Check if chunk has toArray method
            if (chunk.toArray) {
                console.log('\nChunk as array:', chunk.toArray());
            }
            
            // Check if we can access vectors
            if (chunk.vectors && Array.isArray(chunk.vectors)) {
                console.log('\nVectors array:', chunk.vectors);
            }
        }
        
        // Try to convert to a simple format
        console.log('\n\nTrying to extract data...');
        
        // Method 1: Check if reader has a method to get all data
        if (reader.getRows) {
            console.log('getRows:', reader.getRows());
        }
        
        if (reader.toArray) {
            console.log('toArray:', reader.toArray());
        }
        
        if (reader.all) {
            console.log('all:', reader.all());
        }
        
        // Clean up
        connection.closeSync();
        instance.closeSync();
        
        console.log('\nDone!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testResultReader();