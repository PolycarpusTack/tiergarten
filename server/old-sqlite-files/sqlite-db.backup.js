// Updated SQLite database implementation that uses the database adapter
// This provides compatibility with both SQLite and DuckDB

const { getDatabase } = require('./database-adapter');
const path = require('path');
const fs = require('fs');

class SQLiteDatabase {
    constructor() {
        this.db = null;
        // In production/Electron, database is in resources folder
        const isDev = process.env.NODE_ENV === 'development';
        const isElectron = process.versions && process.versions.electron;
        
        if (isElectron && !isDev) {
            // Production Electron path
            const { app } = require('electron');
            this.dbPath = path.join(app.getPath('userData'), 'jira_tiers.db');
        } else {
            // Development path
            this.dbPath = path.join(__dirname, 'database', 'jira_tiers.db');
        }
    }

    async init() {
        // Get database instance through adapter
        this.db = await getDatabase({
            useDuckDB: process.env.USE_DUCKDB === 'true',
            dbPath: this.dbPath
        });
        
        // Initialize schema
        await this.initSchema();
        
        const dbType = this.db.getDatabaseType();
        console.log(`Database initialized (${dbType}) at:`, this.db.dbPath);
        
        return this;
    }

    async initSchema() {
        // Check if tables exist before creating
        const tablesExist = await this.db.tableExists('clients');
        
        if (!tablesExist) {
            console.log('Creating database schema...');
            
            // Create tables - this schema works for both SQLite and DuckDB
            await this.db.exec(`
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
            
            // SQLite-specific optimizations (only for SQLite)
            if (!this.db.isDuckDB()) {
                await this.db.exec(`
                    -- Create triggers for updated_at
                    CREATE TRIGGER IF NOT EXISTS update_clients_timestamp 
                    AFTER UPDATE ON clients
                    BEGIN
                        UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END;

                    CREATE TRIGGER IF NOT EXISTS update_ticket_actions_timestamp 
                    AFTER UPDATE ON ticket_actions
                    BEGIN
                        UPDATE ticket_actions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END;
                `);
            }
        }
        
        // Run migrations
        await this.runMigrations();
        
        // Insert default data if tables are empty
        await this.insertDefaultData();
    }

    async runMigrations() {
        // Migrations are handled differently for DuckDB vs SQLite
        if (this.db.isDuckDB()) {
            // DuckDB schema is created fresh during migration
            console.log('Using DuckDB - migrations handled during initial setup');
            return;
        }
        
        // SQLite migrations
        // Check if isGlobal column exists in clients table
        const columnExists = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('clients') 
            WHERE name='isGlobal'
        `);
        
        if (columnExists && columnExists.count === 0) {
            console.log('Adding isGlobal column to clients table...');
            await this.db.exec(`
                ALTER TABLE clients 
                ADD COLUMN isGlobal INTEGER NOT NULL DEFAULT 0 CHECK (isGlobal IN (0, 1))
            `);
            console.log('Migration completed: added isGlobal column');
        }
        
        // Other SQLite-specific migrations...
    }

    async insertDefaultData() {
        // Check if we need to insert default dashboards
        const dashboardCount = await this.db.get('SELECT COUNT(*) as count FROM dashboards');
        
        if (dashboardCount.count === 0) {
            // Insert default dashboards
            const dashboards = [
                ['Overview', 'default', 1, 1],
                ['My Active Work', 'default', 0, 2],
                ['Planning View', 'default', 0, 3],
                ['Backlog Grooming', 'default', 0, 4]
            ];
            
            for (const dashboard of dashboards) {
                await this.db.run(
                    'INSERT INTO dashboards (name, user_id, is_default, display_order) VALUES (?, ?, ?, ?)',
                    ...dashboard
                );
            }

            // Insert default widget for Overview dashboard
            await this.db.run(`
                INSERT INTO user_widgets (user_id, dashboard_id, title, type, filters, position)
                VALUES ('default', 1, 'All Tickets by Action', 'Action View', '[]', 0)
            `);
            
            // Insert default widgets for Backlog Grooming dashboard
            const backlogWidgets = [
                {
                    title: 'Aging LATER Items (30+ days)',
                    type: 'Action View',
                    filters: JSON.stringify([
                        { field: 'action', operator: 'equals', value: 'LATER' },
                        { field: 'age', operator: '>=', value: 30 }
                    ]),
                    position: 0,
                    cardConfig: JSON.stringify({
                        displayFields: ['key', 'summary', 'client', 'tier', 'mgxPriority', 'age', 'assignee'],
                        timeSensitivity: {
                            enabled: true,
                            rules: [
                                { condition: {}, thresholds: { warning: 30, critical: 60, overdue: 90 } }
                            ],
                            colorScheme: {
                                normal: '#ffffff',
                                warning: '#fef3c7',
                                critical: '#fee2e2',
                                overdue: '#fca5a5'
                            }
                        }
                    })
                },
                {
                    title: 'DELEGATE Queue by Tier',
                    type: 'Tier View',
                    filters: JSON.stringify([
                        { field: 'action', operator: 'equals', value: 'DELEGATE' }
                    ]),
                    position: 1,
                    cardConfig: JSON.stringify({
                        displayFields: ['key', 'summary', 'client', 'priority', 'mgxPriority', 'assignee', 'created'],
                        timeSensitivity: {
                            enabled: true,
                            rules: [
                                { condition: { tier: 1 }, thresholds: { warning: 3, critical: 7, overdue: 14 } },
                                { condition: { tier: 2 }, thresholds: { warning: 7, critical: 14, overdue: 21 } },
                                { condition: { tier: 3 }, thresholds: { warning: 14, critical: 21, overdue: 30 } }
                            ],
                            colorScheme: {
                                normal: '#ffffff',
                                warning: '#fef3c7',
                                critical: '#fee2e2',
                                overdue: '#fca5a5'
                            }
                        }
                    })
                },
                {
                    title: 'MONITOR Patterns',
                    type: 'Action View',
                    filters: JSON.stringify([
                        { field: 'action', operator: 'equals', value: 'MONITOR' }
                    ]),
                    position: 2,
                    cardConfig: JSON.stringify({
                        displayFields: ['key', 'summary', 'client', 'tier', 'labels', 'created', 'updated'],
                        timeSensitivity: {
                            enabled: false
                        }
                    })
                }
            ];
            
            for (const widget of backlogWidgets) {
                await this.db.run(`
                    INSERT INTO user_widgets (user_id, dashboard_id, title, type, filters, position, cardConfig)
                    VALUES ('default', 4, ?, ?, ?, ?, ?)
                `, widget.title, widget.type, widget.filters, widget.position, widget.cardConfig);
            }
        }

        // Check if we need to insert default import config
        const configCount = await this.db.get('SELECT COUNT(*) as count FROM import_config');
        if (configCount.count === 0) {
            await this.db.run(`
                INSERT INTO import_config (excluded_projects, date_offset_days) 
                VALUES ('[]', 30)
            `);
        }
    }

    // Wrapper methods - delegate to adapter
    async run(sql, ...params) {
        return this.db.run(sql, ...params);
    }

    async get(sql, ...params) {
        return this.db.get(sql, ...params);
    }

    async all(sql, ...params) {
        return this.db.all(sql, ...params);
    }

    async exec(sql) {
        return this.db.exec(sql);
    }

    async close() {
        return this.db.close();
    }

    // New analytics methods (only work with DuckDB)
    async runAnalytics(query) {
        if (this.db.isDuckDB()) {
            return this.db.runAnalytics(query);
        }
        throw new Error('Analytics queries require DuckDB. Set USE_DUCKDB=true to enable.');
    }
}

// Export an instance for backward compatibility
module.exports = new SQLiteDatabase();