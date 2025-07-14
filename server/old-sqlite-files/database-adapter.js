// Database adapter that provides a unified interface for SQLite and DuckDB
// This allows gradual migration and fallback capabilities

const path = require('path');
const fs = require('fs').promises;

class DatabaseAdapter {
    constructor() {
        this.db = null;
        this.dbType = null;
        this.dbPath = null;
    }

    async init(options = {}) {
        const {
            useDuckDB = process.env.USE_DUCKDB === 'true',
            dbPath = null,
            forceMigration = false
        } = options;

        try {
            if (useDuckDB) {
                // Try to use DuckDB
                await this.initDuckDB(dbPath, forceMigration);
            } else {
                // Default to SQLite
                await this.initSQLite(dbPath);
            }
        } catch (error) {
            console.error(`Failed to initialize ${useDuckDB ? 'DuckDB' : 'SQLite'}:`, error);
            
            // Fallback mechanism
            if (useDuckDB) {
                console.log('Falling back to SQLite...');
                await this.initSQLite(dbPath);
            } else {
                throw error;
            }
        }

        return this;
    }

    async initDuckDB(customPath, forceMigration) {
        const duckdbWrapper = require('./database-wrapper-duckdb-neo');
        const duckdbPath = customPath || path.join(__dirname, 'database', 'jira_tiers_duckdb.db');
        
        // Check if DuckDB database exists
        const dbExists = await this.fileExists(duckdbPath);
        
        if (!dbExists) {
            console.log('DuckDB database not found. Initializing...');
            const { initializeDuckDB } = require('./init-duckdb');
            await initializeDuckDB();
        } else if (forceMigration) {
            // Only run migration if explicitly requested
            console.log('Migration forced. Running migration from SQLite...');
            const { migrateToDuckDB } = require('./migrate-to-duckdb');
            await migrateToDuckDB();
        }
        
        this.db = await duckdbWrapper.openDatabase(duckdbPath);
        this.dbType = 'duckdb';
        this.dbPath = duckdbPath;
        
        console.log('Database adapter initialized with DuckDB');
    }

    async initSQLite(customPath) {
        const sqliteWrapper = require('./database-wrapper');
        const sqlitePath = customPath || path.join(__dirname, 'database', 'jira_tiers.db');
        
        this.db = await sqliteWrapper.openDatabase(sqlitePath);
        this.dbType = 'sqlite';
        this.dbPath = sqlitePath;
        
        console.log('Database adapter initialized with SQLite');
    }

    async fileExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    // Delegate all database methods to the underlying implementation
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
        if (this.db) {
            try {
                await this.db.close();
            } catch (error) {
                // Ignore close errors for now
                console.log('Note: Database close warning:', error.message);
            }
        }
    }

    // Helper method to get current database type
    getDatabaseType() {
        return this.dbType;
    }

    // Helper method to check if using DuckDB
    isDuckDB() {
        return this.dbType === 'duckdb';
    }

    // DuckDB-specific features (only available when using DuckDB)
    async runAnalytics(query) {
        if (!this.isDuckDB()) {
            throw new Error('Analytics queries are only available with DuckDB');
        }
        return this.db.all(query);
    }

    async exportToParquet(tableName, filePath) {
        if (!this.isDuckDB()) {
            throw new Error('Parquet export is only available with DuckDB');
        }
        return this.db.exportToParquet(tableName, filePath);
    }

    async exportToCsv(tableName, filePath) {
        if (!this.isDuckDB()) {
            throw new Error('CSV export is only available with DuckDB');
        }
        return this.db.exportToCsv(tableName, filePath);
    }

    // Helper to check if a table exists (works for both SQLite and DuckDB)
    async tableExists(tableName) {
        if (this.db.tableExists) {
            return this.db.tableExists(tableName);
        }
        
        // Fallback for SQLite
        const result = await this.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            tableName
        );
        return !!result;
    }
}

// Export singleton instance
let instance = null;

module.exports = {
    async getDatabase(options) {
        if (!instance) {
            instance = new DatabaseAdapter();
            await instance.init(options);
        }
        return instance;
    },
    
    async resetDatabase() {
        if (instance) {
            await instance.close();
            instance = null;
        }
    },
    
    DatabaseAdapter
};