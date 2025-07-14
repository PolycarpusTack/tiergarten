// Initialize DuckDB database without needing SQLite
// This creates an empty DuckDB database with the correct schema

const duckdbWrapper = require('./database-wrapper-duckdb-neo');
const path = require('path');
const fs = require('fs').promises;

async function initializeDuckDB() {
    console.log('Initializing DuckDB database...\n');
    
    let duckDb = null;
    
    try {
        const duckdbPath = path.join(__dirname, 'database', 'jira_tiers_duckdb.db');
        
        // Check if database already exists
        try {
            await fs.access(duckdbPath);
            console.log('DuckDB database already exists at:', duckdbPath);
            return;
        } catch {
            console.log('Creating new DuckDB database...');
        }
        
        // Create database
        duckDb = await duckdbWrapper.openDatabase(duckdbPath);
        console.log('✓ DuckDB database created\n');
        
        // Create schema
        console.log('Creating schema...');
        await createDuckDBSchema(duckDb);
        console.log('✓ Schema created\n');
        
        // Insert default data
        console.log('Inserting default data...');
        await insertDefaultData(duckDb);
        console.log('✓ Default data inserted\n');
        
        console.log('✅ DuckDB initialization completed successfully!');
        console.log(`Database location: ${duckdbPath}`);
        
    } catch (error) {
        console.error('\n❌ Initialization failed:', error);
        throw error;
    } finally {
        if (duckDb) await duckDb.close();
    }
}

async function createDuckDBSchema(db) {
    await db.exec(`
        -- Clients table
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY,
            name VARCHAR NOT NULL UNIQUE,
            jiraProjectKey VARCHAR NOT NULL,
            tier INTEGER NOT NULL DEFAULT 2 CHECK (tier IN (1, 2, 3)),
            isCA INTEGER NOT NULL DEFAULT 0 CHECK (isCA IN (0, 1)),
            isException INTEGER NOT NULL DEFAULT 0 CHECK (isException IN (0, 1)),
            isGlobal INTEGER NOT NULL DEFAULT 0 CHECK (isGlobal IN (0, 1)),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Global rules table
        CREATE TABLE IF NOT EXISTS global_rules (
            id INTEGER PRIMARY KEY,
            isCA INTEGER NOT NULL CHECK (isCA IN (0, 1)),
            tier INTEGER,
            mgxPriority VARCHAR,
            customerPriority VARCHAR,
            action VARCHAR NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Ticket actions override table
        CREATE TABLE IF NOT EXISTS ticket_actions (
            id INTEGER PRIMARY KEY,
            ticket_key VARCHAR NOT NULL UNIQUE,
            action VARCHAR NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Dashboards table
        CREATE TABLE IF NOT EXISTS dashboards (
            id INTEGER PRIMARY KEY,
            name VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL DEFAULT 'default',
            is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, user_id)
        );

        -- User widgets table
        CREATE TABLE IF NOT EXISTS user_widgets (
            id INTEGER PRIMARY KEY,
            user_id VARCHAR NOT NULL DEFAULT 'default',
            dashboard_id INTEGER NOT NULL,
            title VARCHAR NOT NULL,
            type VARCHAR NOT NULL CHECK (type IN ('Action View', 'Tier View')),
            filters VARCHAR DEFAULT '[]',
            position INTEGER NOT NULL DEFAULT 0,
            cardConfig VARCHAR DEFAULT NULL,
            size VARCHAR DEFAULT 'large' CHECK (size IN ('small', 'medium', 'large')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dashboard_id) REFERENCES dashboards(id)
        );

        -- Import configuration table
        CREATE TABLE IF NOT EXISTS import_config (
            id INTEGER PRIMARY KEY,
            excluded_projects VARCHAR DEFAULT '[]',
            date_offset_days INTEGER DEFAULT 30,
            selected_ticket_types VARCHAR DEFAULT '[]',
            selected_ticket_statuses VARCHAR DEFAULT '[]',
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_clients_tier ON clients(tier);
        CREATE INDEX IF NOT EXISTS idx_clients_isCA ON clients(isCA);
        CREATE INDEX IF NOT EXISTS idx_ticket_actions_key ON ticket_actions(ticket_key);
        CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON user_widgets(dashboard_id);
    `);
}

async function insertDefaultData(db) {
    // Check if we need to insert default dashboards
    const dashboardCount = await db.get('SELECT COUNT(*) as count FROM dashboards');
    
    if (dashboardCount.count === 0) {
        // Insert default dashboards
        const dashboards = [
            ['Overview', 'default', 1, 1],
            ['My Active Work', 'default', 0, 2],
            ['Planning View', 'default', 0, 3],
            ['Backlog Grooming', 'default', 0, 4]
        ];
        
        for (const dashboard of dashboards) {
            await db.run(
                'INSERT INTO dashboards (name, user_id, is_default, display_order) VALUES (?, ?, ?, ?)',
                ...dashboard
            );
        }

        // Insert default widget for Overview dashboard
        await db.run(`
            INSERT INTO user_widgets (user_id, dashboard_id, title, type, filters, position)
            VALUES ('default', 1, 'All Tickets by Action', 'Action View', '[]', 0)
        `);
    }

    // Check if we need to insert default import config
    const configCount = await db.get('SELECT COUNT(*) as count FROM import_config');
    if (configCount.count === 0) {
        await db.run(`
            INSERT INTO import_config (excluded_projects, date_offset_days) 
            VALUES ('[]', 30)
        `);
    }
}

// Run initialization if executed directly
if (require.main === module) {
    initializeDuckDB().catch(console.error);
}

module.exports = { initializeDuckDB };