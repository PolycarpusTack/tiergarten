// DuckDB-WASM wrapper for Node.js
// Compatible with Node v22 and provides SQL interface similar to SQLite

const path = require('path');
const fs = require('fs').promises;

// We need to handle module loading differently for Node.js
let duckdb;
let initializeModule;

class DuckDBWrapper {
    constructor() {
        this.db = null;
        this.connection = null;
        this.dbPath = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Dynamic import for ESM module
            const duckdbModule = await import('@duckdb/duckdb-wasm');
            duckdb = duckdbModule;
            
            // For Node.js, we'll use the Node-specific initialization
            const DUCKDB_BUNDLES = duckdb.getJsDelivrBundles();
            
            // Select bundle without worker for simpler Node.js usage
            const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
            
            // Use ConsoleLogger for debugging
            const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
            
            // For Node.js, we can use the synchronous API which is simpler
            // Create the database instance
            const worker = new Worker(bundle.mainWorker);
            this.db = new duckdb.AsyncDuckDB(logger, worker);
            await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
            
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize DuckDB module:', error);
            // Fallback to a simpler approach
            await this.initializeSimple();
        }
    }

    async initializeSimple() {
        try {
            // Try a more direct approach for Node.js
            const duckdbModule = await import('@duckdb/duckdb-wasm');
            const bundles = duckdbModule.getJsDelivrBundles();
            
            // In Node.js, we might not have Worker available in the same way
            // Let's try without worker for now
            const bundle = await duckdbModule.selectBundle(bundles);
            
            // Create a simple logger
            const logger = {
                log: (level, message) => {
                    if (level >= 2) { // WARNING and above
                        console.log(`[DuckDB ${level}] ${message}`);
                    }
                }
            };
            
            // For Node.js environment, we'll need to handle this differently
            // Let's create a minimal working setup
            this.db = await this.createNodeDatabase(duckdbModule, bundle);
            this.initialized = true;
            
        } catch (error) {
            console.error('Failed to initialize DuckDB in simple mode:', error);
            throw new Error('Could not initialize DuckDB-WASM in Node.js environment');
        }
    }

    async createNodeDatabase(duckdbModule, bundle) {
        // For Node.js, we need to handle Worker differently
        // This is a simplified approach that should work in Node.js
        const { Worker } = require('worker_threads');
        
        // Create a worker script inline
        const workerCode = `
            const { parentPort } = require('worker_threads');
            importScripts('${bundle.mainWorker}');
        `;
        
        const worker = new Worker(workerCode, { eval: true });
        const logger = new duckdbModule.ConsoleLogger();
        const db = new duckdbModule.AsyncDuckDB(logger, worker);
        
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        return db;
    }

    async open(filename) {
        try {
            this.dbPath = filename;
            
            // Initialize DuckDB if not already done
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Open connection
            this.connection = await this.db.connect();
            
            // Check if we need to load existing data
            const dbExists = await this.checkDatabaseExists(filename);
            if (dbExists) {
                // For now, we'll create a fresh database
                // Migration from SQLite will be handled separately
                console.log('Note: DuckDB will start with a fresh database. Migration from SQLite pending.');
            }
            
            console.log('DuckDB-WASM database opened successfully');
            return this;
            
        } catch (error) {
            console.error('Failed to open DuckDB:', error);
            throw error;
        }
    }

    async checkDatabaseExists(filename) {
        try {
            await fs.access(filename);
            return true;
        } catch {
            return false;
        }
    }

    // SQLite-compatible async methods
    async run(sql, ...params) {
        try {
            // DuckDB uses $1, $2 style parameters, convert from SQLite ? style
            const duckdbSql = this.convertSqliteParams(sql);
            
            if (params.length > 0) {
                // Prepare statement with parameters
                const stmt = await this.connection.prepare(duckdbSql);
                for (let i = 0; i < params.length; i++) {
                    stmt.bind(i + 1, params[i]);
                }
                await stmt.run();
                stmt.close();
            } else {
                // Run without parameters
                await this.connection.query(duckdbSql);
            }
            
            // Return SQLite-compatible result
            return {
                lastID: null, // DuckDB doesn't expose lastID directly
                changes: null  // Will implement if needed
            };
        } catch (error) {
            console.error('DuckDB run error:', error);
            throw error;
        }
    }

    async get(sql, ...params) {
        try {
            const duckdbSql = this.convertSqliteParams(sql);
            let result;
            
            if (params.length > 0) {
                const stmt = await this.connection.prepare(duckdbSql);
                for (let i = 0; i < params.length; i++) {
                    stmt.bind(i + 1, params[i]);
                }
                result = await stmt.query();
                stmt.close();
            } else {
                result = await this.connection.query(duckdbSql);
            }
            
            // Convert to object format
            const table = await result;
            if (table.numRows > 0) {
                return this.rowToObject(table, 0);
            }
            return undefined;
        } catch (error) {
            console.error('DuckDB get error:', error);
            throw error;
        }
    }

    async all(sql, ...params) {
        try {
            const duckdbSql = this.convertSqliteParams(sql);
            let result;
            
            if (params.length > 0) {
                const stmt = await this.connection.prepare(duckdbSql);
                for (let i = 0; i < params.length; i++) {
                    stmt.bind(i + 1, params[i]);
                }
                result = await stmt.query();
                stmt.close();
            } else {
                result = await this.connection.query(duckdbSql);
            }
            
            // Convert to array of objects
            const table = await result;
            const rows = [];
            for (let i = 0; i < table.numRows; i++) {
                rows.push(this.rowToObject(table, i));
            }
            return rows;
        } catch (error) {
            console.error('DuckDB all error:', error);
            throw error;
        }
    }

    async exec(sql) {
        try {
            await this.connection.query(sql);
        } catch (error) {
            console.error('DuckDB exec error:', error);
            throw error;
        }
    }

    // Helper to convert SQLite ? placeholders to DuckDB $1, $2 style
    convertSqliteParams(sql) {
        let paramIndex = 1;
        return sql.replace(/\?/g, () => `$${paramIndex++}`);
    }

    // Helper to convert DuckDB table row to object
    rowToObject(table, rowIndex) {
        const obj = {};
        const schema = table.schema;
        
        for (let i = 0; i < schema.fields.length; i++) {
            const field = schema.fields[i];
            const column = table.getChildAt(i);
            obj[field.name] = column?.get(rowIndex);
        }
        
        return obj;
    }

    async close() {
        if (this.connection) {
            await this.connection.close();
        }
        if (this.db) {
            await this.db.terminate();
        }
    }

    // Additional DuckDB-specific methods for future use
    async exportToParquet(tableName, filePath) {
        const sql = `COPY ${tableName} TO '${filePath}' (FORMAT PARQUET)`;
        await this.connection.query(sql);
    }

    async importFromParquet(filePath, tableName) {
        const sql = `CREATE TABLE ${tableName} AS SELECT * FROM read_parquet('${filePath}')`;
        await this.connection.query(sql);
    }

    async exportToCsv(tableName, filePath) {
        const sql = `COPY ${tableName} TO '${filePath}' (FORMAT CSV, HEADER)`;
        await this.connection.query(sql);
    }

    async importFromCsv(filePath, tableName) {
        const sql = `CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${filePath}')`;
        await this.connection.query(sql);
    }
}

module.exports = {
    async openDatabase(filename) {
        const wrapper = new DuckDBWrapper();
        await wrapper.open(filename);
        return wrapper;
    },
    
    getDatabaseType() {
        return 'duckdb-wasm';
    }
};