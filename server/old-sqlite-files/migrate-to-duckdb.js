// Migration script from SQLite to DuckDB
// This script creates the DuckDB schema and migrates data from SQLite

const path = require('path');

async function migrateToDuckDB() {
    console.log('Starting migration from SQLite to DuckDB...\n');
    
    let sqliteDb = null;
    let duckDb = null;
    
    try {
        // Load database wrappers only when needed
        const sqliteWrapper = require('./database-wrapper');
        const duckdbWrapper = require('./database-wrapper-duckdb-neo');
        
        // 1. Open SQLite database
        console.log('1. Opening SQLite database...');
        const sqlitePath = path.join(__dirname, 'database', 'jira_tiers.db');
        sqliteDb = await sqliteWrapper.openDatabase(sqlitePath);
        console.log('✓ SQLite database opened\n');
        
        // 2. Open DuckDB database
        console.log('2. Creating DuckDB database...');
        const duckdbPath = path.join(__dirname, 'database', 'jira_tiers_duckdb.db');
        duckDb = await duckdbWrapper.openDatabase(duckdbPath);
        console.log('✓ DuckDB database created\n');
        
        // 3. Create schema in DuckDB
        console.log('3. Creating DuckDB schema...');
        await createDuckDBSchema(duckDb);
        console.log('✓ Schema created\n');
        
        // 4. Migrate data
        console.log('4. Migrating data...');
        
        // Migrate clients
        console.log('  - Migrating clients...');
        const clients = await sqliteDb.all('SELECT * FROM clients');
        console.log(`    Found ${clients.length} clients`);
        for (const client of clients) {
            await duckDb.run(`
                INSERT INTO clients (id, name, jiraProjectKey, tier, isCA, isException, isGlobal, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, client.id, client.name, client.jiraProjectKey, client.tier, client.isCA, client.isException, 
               client.isGlobal || 0, client.created_at, client.updated_at);
        }
        console.log('    ✓ Clients migrated');
        
        // Migrate global_rules
        console.log('  - Migrating global rules...');
        const globalRules = await sqliteDb.all('SELECT * FROM global_rules');
        console.log(`    Found ${globalRules.length} global rules`);
        for (const rule of globalRules) {
            await duckDb.run(`
                INSERT INTO global_rules (id, isCA, tier, mgxPriority, customerPriority, action, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, rule.id, rule.isCA, rule.tier, rule.mgxPriority, rule.customerPriority, rule.action, rule.created_at);
        }
        console.log('    ✓ Global rules migrated');
        
        // Migrate ticket_actions
        console.log('  - Migrating ticket actions...');
        const ticketActions = await sqliteDb.all('SELECT * FROM ticket_actions');
        console.log(`    Found ${ticketActions.length} ticket actions`);
        for (const action of ticketActions) {
            await duckDb.run(`
                INSERT INTO ticket_actions (id, ticket_key, action, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `, action.id, action.ticket_key, action.action, action.created_at, action.updated_at);
        }
        console.log('    ✓ Ticket actions migrated');
        
        // Migrate dashboards
        console.log('  - Migrating dashboards...');
        const dashboards = await sqliteDb.all('SELECT * FROM dashboards');
        console.log(`    Found ${dashboards.length} dashboards`);
        for (const dashboard of dashboards) {
            await duckDb.run(`
                INSERT INTO dashboards (id, name, user_id, is_default, display_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, dashboard.id, dashboard.name, dashboard.user_id, dashboard.is_default, dashboard.display_order, dashboard.created_at);
        }
        console.log('    ✓ Dashboards migrated');
        
        // Migrate user_widgets
        console.log('  - Migrating user widgets...');
        const widgets = await sqliteDb.all('SELECT * FROM user_widgets');
        console.log(`    Found ${widgets.length} widgets`);
        for (const widget of widgets) {
            await duckDb.run(`
                INSERT INTO user_widgets (id, user_id, dashboard_id, title, type, filters, position, cardConfig, size, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, widget.id, widget.user_id, widget.dashboard_id, widget.title, widget.type, widget.filters, 
               widget.position, widget.cardConfig, widget.size || 'large', widget.created_at);
        }
        console.log('    ✓ Widgets migrated');
        
        // Migrate import_config
        console.log('  - Migrating import config...');
        const importConfigs = await sqliteDb.all('SELECT * FROM import_config');
        console.log(`    Found ${importConfigs.length} import configs`);
        for (const config of importConfigs) {
            await duckDb.run(`
                INSERT INTO import_config (id, excluded_projects, date_offset_days, selected_ticket_types, selected_ticket_statuses, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
            `, config.id, config.excluded_projects, config.date_offset_days, 
               config.selected_ticket_types || '[]', config.selected_ticket_statuses || '[]', config.last_updated);
        }
        console.log('    ✓ Import config migrated');
        
        // 5. Verify migration
        console.log('\n5. Verifying migration...');
        const clientCount = await duckDb.get('SELECT COUNT(*) as count FROM clients');
        const ruleCount = await duckDb.get('SELECT COUNT(*) as count FROM global_rules');
        const actionCount = await duckDb.get('SELECT COUNT(*) as count FROM ticket_actions');
        const dashboardCount = await duckDb.get('SELECT COUNT(*) as count FROM dashboards');
        const widgetCount = await duckDb.get('SELECT COUNT(*) as count FROM user_widgets');
        
        console.log(`  - Clients: ${clientCount.count}`);
        console.log(`  - Global rules: ${ruleCount.count}`);
        console.log(`  - Ticket actions: ${actionCount.count}`);
        console.log(`  - Dashboards: ${dashboardCount.count}`);
        console.log(`  - Widgets: ${widgetCount.count}`);
        
        console.log('\n✅ Migration completed successfully!');
        console.log(`DuckDB database created at: ${duckdbPath}`);
        
        // 6. Export some analytics features
        console.log('\n6. Demonstrating DuckDB analytics capabilities...');
        
        // Example: Client tier distribution
        const tierDistribution = await duckDb.all(`
            SELECT 
                tier,
                COUNT(*) as count,
                COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
            FROM clients
            GROUP BY tier
            ORDER BY tier
        `);
        console.log('\nClient Tier Distribution:');
        tierDistribution.forEach(row => {
            console.log(`  Tier ${row.tier}: ${row.count} clients (${row.percentage.toFixed(1)}%)`);
        });
        
        // Example: Action distribution by dashboard
        const actionsByDashboard = await duckDb.all(`
            SELECT 
                d.name as dashboard_name,
                COUNT(w.id) as widget_count,
                STRING_AGG(DISTINCT w.type, ', ') as widget_types,
                ANY_VALUE(d.display_order) as display_order
            FROM dashboards d
            LEFT JOIN user_widgets w ON d.id = w.dashboard_id
            GROUP BY d.id, d.name
            ORDER BY display_order
        `);
        console.log('\nWidgets by Dashboard:');
        actionsByDashboard.forEach(row => {
            console.log(`  ${row.dashboard_name}: ${row.widget_count} widgets (${row.widget_types || 'none'})`);
        });
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    } finally {
        // Close databases
        if (sqliteDb) await sqliteDb.close();
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

// Run migration if executed directly
if (require.main === module) {
    migrateToDuckDB().catch(console.error);
}

module.exports = { migrateToDuckDB };