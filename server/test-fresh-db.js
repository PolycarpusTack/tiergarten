const { DuckDBInstance } = require('@duckdb/node-api');
const path = require('path');

async function testFreshDB() {
    const dbPath = path.join(__dirname, 'database', `test_${Date.now()}.duckdb`);
    console.log('Creating fresh database at:', dbPath);
    
    try {
        const instance = await DuckDBInstance.create(dbPath);
        console.log('✅ Database created successfully');
        
        const conn = await instance.connect();
        console.log('✅ Connection established');
        
        await conn.run('CREATE TABLE test (id INTEGER)');
        console.log('✅ Table created');
        
        await conn.run('INSERT INTO test VALUES (1), (2), (3)');
        console.log('✅ Data inserted');
        
        const result = await conn.runAndReadAll('SELECT COUNT(*) as cnt FROM test');
        const rows = result.getRowObjects();
        console.log('✅ Query result:', rows[0].cnt);
        
        conn.closeSync();
        instance.closeSync();
        console.log('✅ Database closed');
        
        // Clean up
        const fs = require('fs');
        fs.unlinkSync(dbPath);
        console.log('✅ Test file cleaned up');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testFreshDB();