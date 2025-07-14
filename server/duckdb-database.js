// Pure DuckDB database implementation for Tiergarten
// No SQLite dependencies - built for Node.js v22 compatibility

const { DuckDBInstance } = require('@duckdb/node-api');
const path = require('path');
const fs = require('fs').promises;

class DuckDBDatabase {
    constructor() {
        this.db = null;
        this.connection = null;
        this.instance = null;
        // Database path
        const isDev = process.env.NODE_ENV === 'development';
        const isElectron = process.versions && process.versions.electron;
        
        if (isElectron && !isDev) {
            // Production Electron path
            const { app } = require('electron');
            this.dbPath = path.join(app.getPath('userData'), 'jira_tiers.duckdb');
        } else {
            // Development path - use persistent file database
            const dbDir = path.join(__dirname, 'database');
            this.dbPath = path.join(dbDir, 'tiergarten.duckdb');
            console.log('Using persistent DuckDB for development at:', this.dbPath);
        }
    }

    async init() {
        try {
            // Skip file operations for in-memory database
            if (this.dbPath !== ':memory:') {
                // Ensure database directory exists
                const dbDir = path.dirname(this.dbPath);
                try {
                    await fs.mkdir(dbDir, { recursive: true });
                } catch (error) {
                    // Directory might already exist, that's fine
                }

                // Check if database already exists
                try {
                    await fs.access(this.dbPath);
                    console.log('Found existing DuckDB database at:', this.dbPath);
                } catch (e) {
                    console.log('Creating new DuckDB database at:', this.dbPath);
                }
            }

            // Create DuckDB instance
            this.instance = await DuckDBInstance.create(this.dbPath);
            this.connection = await this.instance.connect();
            
            console.log('DuckDB database initialized at:', this.dbPath);
            
            // Initialize schema
            await this.initSchema();
            
            // Insert default data if needed
            await this.insertDefaultData();
            
            return this;
        } catch (error) {
            console.error('Failed to initialize DuckDB:', error);
            
            // If permission denied, use a working database name
            if (error.message && error.message.includes('Permission denied')) {
                console.log('Permission issue detected, using alternative database name...');
                this.dbPath = path.join(__dirname, 'database', 'tiergarten_data.duckdb');
                
                try {
                    this.instance = await DuckDBInstance.create(this.dbPath);
                    this.connection = await this.instance.connect();
                    console.log('DuckDB database initialized at:', this.dbPath);
                    await this.initSchema();
                    await this.insertDefaultData();
                    return this;
                } catch (retryError) {
                    console.error('Failed to initialize DuckDB at alternative location:', retryError);
                    // Last resort: use temp file
                    this.dbPath = path.join(__dirname, 'database', `tiergarten_${Date.now()}.duckdb`);
                    this.instance = await DuckDBInstance.create(this.dbPath);
                    this.connection = await this.instance.connect();
                    console.log('DuckDB database initialized at temp location:', this.dbPath);
                    await this.initSchema();
                    await this.insertDefaultData();
                    return this;
                }
            }
            
            throw error;
        }
    }

    async initSchema() {
        console.log('Creating database schema...');
        
        await this.exec(`
            -- Clients table
            CREATE SEQUENCE IF NOT EXISTS seq_clients_id START 1;
            
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_clients_id'),
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
            CREATE SEQUENCE IF NOT EXISTS seq_global_rules_id START 1;
            
            CREATE TABLE IF NOT EXISTS global_rules (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_global_rules_id'),
                isCA INTEGER NOT NULL CHECK (isCA IN (0, 1)),
                tier INTEGER,
                mgxPriority VARCHAR,
                customerPriority VARCHAR,
                action VARCHAR NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Ticket actions override table
            CREATE SEQUENCE IF NOT EXISTS seq_ticket_actions_id START 1;
            
            CREATE TABLE IF NOT EXISTS ticket_actions (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_ticket_actions_id'),
                ticket_key VARCHAR NOT NULL UNIQUE,
                action VARCHAR NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Dashboards table
            CREATE SEQUENCE IF NOT EXISTS seq_dashboards_id START 1;
            
            CREATE TABLE IF NOT EXISTS dashboards (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_dashboards_id'),
                name VARCHAR NOT NULL,
                user_id VARCHAR NOT NULL DEFAULT 'default',
                is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, user_id)
            );

            -- User widgets table
            CREATE SEQUENCE IF NOT EXISTS seq_widgets_id START 1;
            
            CREATE TABLE IF NOT EXISTS user_widgets (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_widgets_id'),
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
                id INTEGER PRIMARY KEY DEFAULT 1,
                excluded_projects VARCHAR DEFAULT '[]',
                date_offset_days INTEGER DEFAULT 30,
                selected_ticket_types VARCHAR DEFAULT '[]',
                selected_ticket_statuses VARCHAR DEFAULT '[]',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- JIRA configuration table
            CREATE SEQUENCE IF NOT EXISTS seq_jira_config_id START 1;
            
            CREATE TABLE IF NOT EXISTS jira_config (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_jira_config_id'),
                base_url VARCHAR NOT NULL,
                email VARCHAR NOT NULL,
                api_token_encrypted VARCHAR NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
                last_tested TIMESTAMP,
                last_import TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Import profiles table
            CREATE SEQUENCE IF NOT EXISTS seq_import_profiles_id START 1;
            
            CREATE TABLE IF NOT EXISTS import_profiles (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_import_profiles_id'),
                name VARCHAR NOT NULL,
                description VARCHAR,
                filters VARCHAR NOT NULL DEFAULT '{}',
                is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Import history table
            CREATE SEQUENCE IF NOT EXISTS seq_import_history_id START 1;
            
            CREATE TABLE IF NOT EXISTS import_history (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_import_history_id'),
                profile_id INTEGER,
                started_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                status VARCHAR CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
                tickets_imported INTEGER DEFAULT 0,
                tickets_updated INTEGER DEFAULT 0,
                tickets_failed INTEGER DEFAULT 0,
                error_log VARCHAR,
                metadata VARCHAR,
                FOREIGN KEY (profile_id) REFERENCES import_profiles(id)
            );

            -- Project mappings table
            CREATE SEQUENCE IF NOT EXISTS seq_project_mappings_id START 1;
            
            CREATE TABLE IF NOT EXISTS project_mappings (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_project_mappings_id'),
                jira_project_key VARCHAR NOT NULL UNIQUE,
                jira_project_name VARCHAR NOT NULL,
                client_id INTEGER,
                tier INTEGER DEFAULT 3,
                auto_import INTEGER DEFAULT 1 CHECK (auto_import IN (0, 1)),
                import_settings VARCHAR DEFAULT '{}',
                last_synced TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            );

            -- JIRA imports tracking table
            CREATE TABLE IF NOT EXISTS jira_imports (
                id VARCHAR PRIMARY KEY,
                status VARCHAR NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
                project_keys VARCHAR NOT NULL,
                total_projects INTEGER NOT NULL DEFAULT 0,
                processed_projects INTEGER NOT NULL DEFAULT 0,
                total_tickets INTEGER NOT NULL DEFAULT 0,
                processed_tickets INTEGER NOT NULL DEFAULT 0,
                current_project VARCHAR,
                error_message VARCHAR,
                started_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_clients_tier ON clients(tier);
            CREATE INDEX IF NOT EXISTS idx_clients_isCA ON clients(isCA);
            CREATE INDEX IF NOT EXISTS idx_ticket_actions_key ON ticket_actions(ticket_key);
            CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON user_widgets(dashboard_id);
            CREATE INDEX IF NOT EXISTS idx_project_mappings_key ON project_mappings(jira_project_key);

            -- JIRA Config 2 Tables
            CREATE SEQUENCE IF NOT EXISTS seq_jira_config2_id START 1;
            
            CREATE TABLE IF NOT EXISTS jira_config2 (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_jira_config2_id'),
                name VARCHAR NOT NULL,
                description VARCHAR,
                is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
                connection_settings VARCHAR NOT NULL DEFAULT '{}',
                filter_settings VARCHAR NOT NULL DEFAULT '{}',
                field_mappings VARCHAR NOT NULL DEFAULT '{}',
                import_settings VARCHAR NOT NULL DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- JIRA Config 2 Field Mappings
            CREATE SEQUENCE IF NOT EXISTS seq_jira_field_mappings_id START 1;
            
            CREATE TABLE IF NOT EXISTS jira_field_mappings (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_jira_field_mappings_id'),
                config_id INTEGER NOT NULL,
                jira_field_id VARCHAR NOT NULL,
                jira_field_name VARCHAR NOT NULL,
                jira_field_type VARCHAR NOT NULL,
                tiergarten_field VARCHAR NOT NULL,
                mapping_type VARCHAR CHECK (mapping_type IN ('direct', 'transform', 'custom')),
                transform_rules VARCHAR DEFAULT '{}',
                is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (config_id) REFERENCES jira_config2(id)
            );

            -- JIRA Config 2 Filter Presets
            CREATE SEQUENCE IF NOT EXISTS seq_jira_filter_presets_id START 1;
            
            CREATE TABLE IF NOT EXISTS jira_filter_presets (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_jira_filter_presets_id'),
                name VARCHAR NOT NULL,
                description VARCHAR,
                filter_settings VARCHAR NOT NULL DEFAULT '{}',
                is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- JIRA Config 2 Import History
            CREATE SEQUENCE IF NOT EXISTS seq_jira_config2_imports_id START 1;
            
            CREATE TABLE IF NOT EXISTS jira_config2_imports (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_jira_config2_imports_id'),
                config_id INTEGER NOT NULL,
                import_id VARCHAR NOT NULL,
                status VARCHAR NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
                statistics VARCHAR DEFAULT '{}',
                error_log VARCHAR DEFAULT '[]',
                started_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                FOREIGN KEY (config_id) REFERENCES jira_config2(id)
            );

            CREATE INDEX IF NOT EXISTS idx_jira_config2_active ON jira_config2(is_active);
            CREATE INDEX IF NOT EXISTS idx_jira_field_mappings_config ON jira_field_mappings(config_id);
            CREATE INDEX IF NOT EXISTS idx_jira_config2_imports_config ON jira_config2_imports(config_id);

            -- JIRA Tickets Storage
            CREATE SEQUENCE IF NOT EXISTS seq_jira_tickets_id START 1;
            
            CREATE TABLE IF NOT EXISTS jira_tickets (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_jira_tickets_id'),
                ticket_key VARCHAR NOT NULL UNIQUE,
                client_id INTEGER NOT NULL,
                summary VARCHAR NOT NULL,
                description VARCHAR,
                status VARCHAR,
                priority VARCHAR,
                ticket_type VARCHAR,
                assignee VARCHAR,
                reporter VARCHAR,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                jira_created TIMESTAMP,
                jira_updated TIMESTAMP,
                custom_fields VARCHAR DEFAULT '{}',
                components VARCHAR DEFAULT '[]',
                labels VARCHAR DEFAULT '[]',
                import_id VARCHAR,
                last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            );

            CREATE INDEX IF NOT EXISTS idx_jira_tickets_key ON jira_tickets(ticket_key);
            CREATE INDEX IF NOT EXISTS idx_jira_tickets_client ON jira_tickets(client_id);
            CREATE INDEX IF NOT EXISTS idx_jira_tickets_status ON jira_tickets(status);
            CREATE INDEX IF NOT EXISTS idx_jira_tickets_priority ON jira_tickets(priority);
            CREATE INDEX IF NOT EXISTS idx_jira_tickets_updated ON jira_tickets(jira_updated);
            
            -- Additional performance indexes
            CREATE INDEX IF NOT EXISTS idx_clients_jira_key ON clients(jiraProjectKey);
            CREATE INDEX IF NOT EXISTS idx_jira_imports_status ON jira_imports(status);
            CREATE INDEX IF NOT EXISTS idx_jira_config2_imports_status ON jira_config2_imports(status);
            CREATE INDEX IF NOT EXISTS idx_user_widgets_user ON user_widgets(user_id);
            
            -- Sync history table for tracking JIRA synchronization
            CREATE TABLE IF NOT EXISTS sync_history (
                id VARCHAR PRIMARY KEY,
                type VARCHAR NOT NULL CHECK (type IN ('full', 'incremental')),
                status VARCHAR NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
                options VARCHAR DEFAULT '{}',
                progress VARCHAR DEFAULT '{}',
                error VARCHAR,
                started_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_sync_history_status ON sync_history(status);
            CREATE INDEX IF NOT EXISTS idx_sync_history_type ON sync_history(type);
            CREATE INDEX IF NOT EXISTS idx_sync_history_completed ON sync_history(completed_at);
            
            -- Performance critical indexes for ticket queries
            CREATE INDEX IF NOT EXISTS idx_jira_tickets_client_status ON jira_tickets(client_id, status);
            CREATE INDEX IF NOT EXISTS idx_jira_tickets_updated_status ON jira_tickets(jira_updated, status);
            CREATE INDEX IF NOT EXISTS idx_jira_tickets_assignee ON jira_tickets(assignee);
            CREATE INDEX IF NOT EXISTS idx_sync_history_started ON sync_history(started_at);
            
            -- Add last_synced column to clients if not exists
            ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP;
            
            -- Note: DuckDB has limited trigger support as of now
            -- updated_at timestamps will need to be handled in application code
        `);
        
        console.log('Schema created successfully');
    }

    async insertDefaultData() {
        try {
            // Check if we need to insert default dashboards
            const dashboardCount = await this.get('SELECT COUNT(*) as count FROM dashboards');
            console.log('Dashboard count result:', dashboardCount);
            
            // Handle BigInt or numeric count
            const count = dashboardCount ? Number(dashboardCount.count) : 0;
            
            if (count === 0) {
                console.log('Inserting default data...');
                
                // Insert default dashboards
                const dashboards = [
                    ['Overview', 'default', 1, 1],
                    ['My Active Work', 'default', 0, 2],
                    ['Planning View', 'default', 0, 3],
                    ['Backlog Grooming', 'default', 0, 4]
                ];
                
                for (const dashboard of dashboards) {
                    try {
                        await this.run(
                            'INSERT INTO dashboards (name, user_id, is_default, display_order) VALUES (?, ?, ?, ?)',
                            ...dashboard
                        );
                        console.log(`Inserted dashboard: ${dashboard[0]}`);
                    } catch (insertError) {
                        console.error(`Error inserting dashboard ${dashboard[0]}:`, insertError.message);
                    }
                }

            // Insert default widget for Overview dashboard
            await this.run(
                'INSERT INTO user_widgets (user_id, dashboard_id, title, type, filters, position) VALUES (?, ?, ?, ?, ?, ?)',
                'default', 1, 'All Tickets by Action', 'Action View', '[]', 0
            );
            
            // Insert default widgets for Backlog Grooming dashboard
            const backlogWidgets = [
                {
                    dashboard_id: 4,
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
                    dashboard_id: 4,
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
                    dashboard_id: 4,
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
                await this.run(
                    'INSERT INTO user_widgets (user_id, dashboard_id, title, type, filters, position, cardConfig) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    'default', widget.dashboard_id, widget.title, widget.type, widget.filters, widget.position, widget.cardConfig
                );
            }

            // Insert default import config
            await this.run(
                'INSERT INTO import_config (id, excluded_projects, date_offset_days) VALUES (?, ?, ?)',
                1, '[]', 30
            );
            
                console.log('Default data inserted successfully');
            }
        } catch (error) {
            console.error('Error in insertDefaultData:', error);
            console.error('Full error details:', error.stack);
        }
    }

    // Database operation methods
    async run(sql, ...params) {
        try {
            if (params.length > 0) {
                // Convert SQLite ? placeholders to DuckDB $1, $2 style
                let paramIndex = 1;
                const duckdbSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                
                const stmt = await this.connection.prepare(duckdbSql);
                
                // Bind parameters
                for (let i = 0; i < params.length; i++) {
                    const param = params[i];
                    if (param === null || param === undefined) {
                        stmt.bindNull(i + 1);
                    } else if (typeof param === 'number') {
                        if (Number.isInteger(param)) {
                            stmt.bindInteger(i + 1, param);
                        } else {
                            stmt.bindDouble(i + 1, param);
                        }
                    } else if (typeof param === 'string') {
                        stmt.bindVarchar(i + 1, param);
                    } else if (typeof param === 'boolean') {
                        stmt.bindBoolean(i + 1, param);
                    } else if (param instanceof Date) {
                        stmt.bindTimestamp(i + 1, param);
                    } else {
                        stmt.bindVarchar(i + 1, String(param));
                    }
                }
                
                const result = await stmt.run();
                stmt.destroySync();
                
                return {
                    lastID: null, // DuckDB doesn't expose lastID in the same way
                    changes: typeof result.rowCount === 'function' ? result.rowCount() : 0
                };
            } else {
                const result = await this.connection.run(sql);
                return {
                    lastID: null,
                    changes: typeof result.rowCount === 'function' ? result.rowCount() : 0
                };
            }
        } catch (error) {
            console.error('DuckDB run error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    async get(sql, ...params) {
        try {
            if (params.length > 0) {
                let paramIndex = 1;
                const duckdbSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                
                const stmt = await this.connection.prepare(duckdbSql);
                
                for (let i = 0; i < params.length; i++) {
                    const param = params[i];
                    if (param === null || param === undefined) {
                        stmt.bindNull(i + 1);
                    } else if (typeof param === 'number') {
                        if (Number.isInteger(param)) {
                            stmt.bindInteger(i + 1, param);
                        } else {
                            stmt.bindDouble(i + 1, param);
                        }
                    } else if (typeof param === 'string') {
                        stmt.bindVarchar(i + 1, param);
                    } else if (typeof param === 'boolean') {
                        stmt.bindBoolean(i + 1, param);
                    } else if (param instanceof Date) {
                        stmt.bindTimestamp(i + 1, param);
                    } else {
                        stmt.bindVarchar(i + 1, String(param));
                    }
                }
                
                const reader = await stmt.runAndReadAll();
                stmt.destroySync();
                const rows = reader.getRowObjects();
                return rows.length > 0 ? rows[0] : undefined;
            } else {
                const reader = await this.connection.runAndReadAll(sql);
                const rows = reader.getRowObjects();
                return rows.length > 0 ? rows[0] : undefined;
            }
        } catch (error) {
            console.error('DuckDB get error:', error);
            throw error;
        }
    }

    async all(sql, ...params) {
        try {
            if (params.length > 0) {
                let paramIndex = 1;
                const duckdbSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                
                const stmt = await this.connection.prepare(duckdbSql);
                
                for (let i = 0; i < params.length; i++) {
                    const param = params[i];
                    if (param === null || param === undefined) {
                        stmt.bindNull(i + 1);
                    } else if (typeof param === 'number') {
                        if (Number.isInteger(param)) {
                            stmt.bindInteger(i + 1, param);
                        } else {
                            stmt.bindDouble(i + 1, param);
                        }
                    } else if (typeof param === 'string') {
                        stmt.bindVarchar(i + 1, param);
                    } else if (typeof param === 'boolean') {
                        stmt.bindBoolean(i + 1, param);
                    } else if (param instanceof Date) {
                        stmt.bindTimestamp(i + 1, param);
                    } else {
                        stmt.bindVarchar(i + 1, String(param));
                    }
                }
                
                const reader = await stmt.runAndReadAll();
                stmt.destroySync();
                return reader.getRowObjects();
            } else {
                const reader = await this.connection.runAndReadAll(sql);
                return reader.getRowObjects();
            }
        } catch (error) {
            console.error('DuckDB all error:', error);
            throw error;
        }
    }

    async exec(sql) {
        try {
            // For multi-statement SQL, we need to split and execute separately
            const statements = sql.split(';').filter(s => s.trim());
            
            for (const statement of statements) {
                if (statement.trim()) {
                    await this.connection.run(statement);
                }
            }
        } catch (error) {
            console.error('DuckDB exec error:', error);
            throw error;
        }
    }

    async close() {
        try {
            if (this.connection) {
                this.connection.closeSync();
            }
            if (this.instance) {
                this.instance.closeSync();
            }
        } catch (error) {
            console.error('Error closing DuckDB:', error);
        }
    }

    // Utility methods
    isReady() {
        return this.connection !== null;
    }

    getDatabaseSize() {
        try {
            if (this.dbPath === ':memory:') {
                return 0; // In-memory database
            }
            const stats = require('fs').statSync(this.dbPath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    // Schema introspection methods
    async checkTableExists(tableName) {
        try {
            const result = await this.get(
                `SELECT COUNT(*) as count 
                 FROM information_schema.tables 
                 WHERE table_name = ? AND table_schema = 'main'`,
                tableName
            );
            return result && result.count > 0;
        } catch (error) {
            console.error(`Error checking if table ${tableName} exists:`, error);
            return false;
        }
    }

    async checkColumnExists(tableName, columnName) {
        try {
            const result = await this.get(
                `SELECT COUNT(*) as count 
                 FROM information_schema.columns 
                 WHERE table_name = ? AND column_name = ? AND table_schema = 'main'`,
                tableName, columnName
            );
            return result && result.count > 0;
        } catch (error) {
            console.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
            return false;
        }
    }

    // Transaction support
    async beginTransaction() {
        try {
            await this.run('BEGIN TRANSACTION');
        } catch (error) {
            console.error('Error beginning transaction:', error);
            throw error;
        }
    }

    async commit() {
        try {
            await this.run('COMMIT');
        } catch (error) {
            console.error('Error committing transaction:', error);
            throw error;
        }
    }

    async rollback() {
        try {
            await this.run('ROLLBACK');
        } catch (error) {
            console.error('Error rolling back transaction:', error);
            throw error;
        }
    }

    // Execute a function within a transaction
    async transaction(fn) {
        try {
            await this.beginTransaction();
            const result = await fn();
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    // Execute with savepoint for nested transaction support
    async runInTransaction(operations) {
        const savepoint = `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
            await this.run(`SAVEPOINT ${savepoint}`);
            const result = await operations();
            await this.run(`RELEASE SAVEPOINT ${savepoint}`);
            return result;
        } catch (error) {
            await this.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            throw error;
        }
    }

    // Helper method to handle updated_at timestamps
    async update(table, updates, whereClause, ...params) {
        try {
            // Add updated_at to the updates if the table has this column
            const hasUpdatedAt = await this.checkColumnExists(table, 'updated_at');
            if (hasUpdatedAt) {
                updates.updated_at = 'CURRENT_TIMESTAMP';
            }

            // Build SET clause
            const setClauses = Object.entries(updates).map(([key, value]) => {
                if (value === 'CURRENT_TIMESTAMP') {
                    return `${key} = CURRENT_TIMESTAMP`;
                }
                return `${key} = ?`;
            });

            // Build parameter array (excluding CURRENT_TIMESTAMP values)
            const updateParams = Object.values(updates).filter(v => v !== 'CURRENT_TIMESTAMP');
            
            const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClause}`;
            return await this.run(sql, ...updateParams, ...params);
        } catch (error) {
            console.error('Update error:', error);
            throw error;
        }
    }

    // Analytics capabilities
    async runAnalytics(query) {
        return this.all(query);
    }
}

// Export a singleton instance
module.exports = new DuckDBDatabase();