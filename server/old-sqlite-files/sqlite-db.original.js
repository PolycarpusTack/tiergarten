// SQLite database implementation for Tiergarten using node-sqlite3
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
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
        // Ensure database directory exists
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Open database connection with sqlite wrapper
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });
        
        // Enable foreign keys and performance optimizations
        await this.db.exec('PRAGMA foreign_keys = ON');
        await this.db.exec('PRAGMA journal_mode = WAL');
        await this.db.exec('PRAGMA synchronous = NORMAL');
        
        // Initialize schema
        await this.initSchema();
        
        console.log('SQLite database initialized at:', this.dbPath);
        return this;
    }

    async initSchema() {
        // Create tables if they don't exist
        await this.db.exec(`
            -- Clients table
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                jiraProjectKey TEXT NOT NULL,
                tier INTEGER NOT NULL DEFAULT 2 CHECK (tier IN (1, 2, 3)),
                isCA INTEGER NOT NULL DEFAULT 0 CHECK (isCA IN (0, 1)),
                isException INTEGER NOT NULL DEFAULT 0 CHECK (isException IN (0, 1)),
                isGlobal INTEGER NOT NULL DEFAULT 0 CHECK (isGlobal IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Global rules table
            CREATE TABLE IF NOT EXISTS global_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                isCA INTEGER NOT NULL CHECK (isCA IN (0, 1)),
                tier INTEGER,
                mgxPriority TEXT,
                customerPriority TEXT,
                action TEXT NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Ticket actions override table
            CREATE TABLE IF NOT EXISTS ticket_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_key TEXT NOT NULL UNIQUE,
                action TEXT NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Dashboards table
            CREATE TABLE IF NOT EXISTS dashboards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                user_id TEXT NOT NULL DEFAULT 'default',
                is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, user_id)
            );

            -- User widgets table
            CREATE TABLE IF NOT EXISTS user_widgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL DEFAULT 'default',
                dashboard_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('Action View', 'Tier View')),
                filters TEXT DEFAULT '[]',
                position INTEGER NOT NULL DEFAULT 0,
                cardConfig TEXT DEFAULT NULL,
                size TEXT DEFAULT 'large' CHECK (size IN ('small', 'medium', 'large')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
            );

            -- Import configuration table
            CREATE TABLE IF NOT EXISTS import_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                excluded_projects TEXT DEFAULT '[]',
                date_offset_days INTEGER DEFAULT 30,
                selected_ticket_types TEXT DEFAULT '[]',
                selected_ticket_statuses TEXT DEFAULT '[]',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_clients_tier ON clients(tier);
            CREATE INDEX IF NOT EXISTS idx_clients_isCA ON clients(isCA);
            CREATE INDEX IF NOT EXISTS idx_ticket_actions_key ON ticket_actions(ticket_key);
            CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON user_widgets(dashboard_id);

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

        // Run migrations
        await this.runMigrations();
        
        // Insert default data if tables are empty
        await this.insertDefaultData();
    }

    async runMigrations() {
        // Check if isGlobal column exists in clients table
        const columnExists = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('clients') 
            WHERE name='isGlobal'
        `);
        
        if (columnExists.count === 0) {
            console.log('Adding isGlobal column to clients table...');
            await this.db.exec(`
                ALTER TABLE clients 
                ADD COLUMN isGlobal INTEGER NOT NULL DEFAULT 0 CHECK (isGlobal IN (0, 1))
            `);
            console.log('Migration completed: added isGlobal column');
        }
        
        // Check if we need to update global_rules table structure
        const mgxPriorityExists = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('global_rules') 
            WHERE name='mgxPriority'
        `);
        
        if (mgxPriorityExists.count === 0) {
            console.log('Migrating global_rules table to use mgxPriority...');
            
            // Create new table with updated schema
            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS global_rules_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    isCA INTEGER NOT NULL CHECK (isCA IN (0, 1)),
                    tier INTEGER,
                    mgxPriority TEXT,
                    customerPriority TEXT,
                    action TEXT NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                -- Copy existing data (priority becomes mgxPriority)
                INSERT INTO global_rules_new (id, isCA, tier, mgxPriority, customerPriority, action, created_at)
                SELECT id, isCA, tier, priority, NULL, action, created_at FROM global_rules;
                
                -- Drop old table and rename new one
                DROP TABLE global_rules;
                ALTER TABLE global_rules_new RENAME TO global_rules;
            `);
            
            console.log('Migration completed: updated global_rules table');
        }
        
        // Check if cardConfig column exists in user_widgets table
        const cardConfigExists = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('user_widgets') 
            WHERE name='cardConfig'
        `);
        
        if (cardConfigExists.count === 0) {
            console.log('Adding cardConfig column to user_widgets table...');
            await this.db.exec(`
                ALTER TABLE user_widgets 
                ADD COLUMN cardConfig TEXT DEFAULT NULL
            `);
            console.log('Migration completed: added cardConfig column');
        }
        
        // Check if selected_ticket_types column exists in import_config table
        const ticketTypesExists = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('import_config') 
            WHERE name='selected_ticket_types'
        `);
        
        if (ticketTypesExists.count === 0) {
            console.log('Adding ticket type and status columns to import_config table...');
            await this.db.exec(`
                ALTER TABLE import_config 
                ADD COLUMN selected_ticket_types TEXT DEFAULT '[]'
            `);
            await this.db.exec(`
                ALTER TABLE import_config 
                ADD COLUMN selected_ticket_statuses TEXT DEFAULT '[]'
            `);
            console.log('Migration completed: added ticket filtering columns');
        }
        
        // Check if size column exists in user_widgets table
        const sizeColumnExists = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('user_widgets') 
            WHERE name='size'
        `);
        
        if (sizeColumnExists.count === 0) {
            console.log('Adding size column to user_widgets table...');
            await this.db.exec(`
                ALTER TABLE user_widgets 
                ADD COLUMN size TEXT DEFAULT 'large' CHECK (size IN ('small', 'medium', 'large'))
            `);
            console.log('Migration completed: added size column');
        }
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

    // Wrapper methods that match the better-sqlite3 API but use sqlite
    async run(sql, ...params) {
        try {
            const result = await this.db.run(sql, ...params);
            return {
                lastID: result.lastID,
                changes: result.changes
            };
        } catch (error) {
            console.error('SQL Error:', error);
            throw error;
        }
    }

    async get(sql, ...params) {
        try {
            return await this.db.get(sql, ...params);
        } catch (error) {
            console.error('SQL Error:', error);
            throw error;
        }
    }

    async all(sql, ...params) {
        try {
            return await this.db.all(sql, ...params);
        } catch (error) {
            console.error('SQL Error:', error);
            throw error;
        }
    }

    async exec(sql) {
        try {
            return await this.db.exec(sql);
        } catch (error) {
            console.error('SQL Error:', error);
            throw error;
        }
    }

    // Transaction support with compatibility layer
    async transaction(callback) {
        // Start a transaction
        await this.db.exec('BEGIN TRANSACTION');
        try {
            const result = await callback();
            await this.db.exec('COMMIT');
            return result;
        } catch (error) {
            await this.db.exec('ROLLBACK');
            throw error;
        }
    }

    // Close database connection
    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    // Utility method to check if database is ready
    isReady() {
        return this.db !== null;
    }

    // Get database file size (useful for monitoring)
    getDatabaseSize() {
        try {
            const stats = fs.statSync(this.dbPath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }
}

// Export singleton instance
module.exports = new SQLiteDatabase();