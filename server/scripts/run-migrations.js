#!/usr/bin/env node

/**
 * Run Database Migrations
 * 
 * Applies all pending SQL migrations to the database
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../duckdb-database');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function getMigrations() {
    try {
        const files = await fs.readdir(MIGRATIONS_DIR);
        return files
            .filter(f => f.endsWith('.sql'))
            .sort(); // Alphabetical order ensures chronological execution
    } catch (error) {
        console.log('No migrations directory found');
        return [];
    }
}

async function runMigration(filename) {
    console.log(`  Running ${filename}...`);
    
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = await fs.readFile(filepath, 'utf8');
    
    // Split by semicolon but handle statements properly
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
        try {
            await db.run(statement);
        } catch (error) {
            console.error(`    ❌ Error in statement: ${error.message}`);
            console.error(`    Statement: ${statement.substring(0, 100)}...`);
            throw error;
        }
    }
    
    console.log(`    ✅ ${filename} completed`);
}

async function main() {
    console.log('🚀 Running database migrations\n');
    
    try {
        // Initialize database
        await db.init();
        console.log('✅ Database initialized\n');
        
        // Get migration files
        const migrations = await getMigrations();
        
        if (migrations.length === 0) {
            console.log('No migrations to run');
            return;
        }
        
        console.log(`Found ${migrations.length} migration(s):\n`);
        
        // Run each migration
        for (const migration of migrations) {
            try {
                await runMigration(migration);
            } catch (error) {
                console.error(`\n❌ Migration failed: ${migration}`);
                console.error(error.message);
                process.exit(1);
            }
        }
        
        console.log('\n✅ All migrations completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

main();