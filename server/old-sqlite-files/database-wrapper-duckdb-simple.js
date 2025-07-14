// Simplified DuckDB-WASM wrapper for Node.js
// This version uses a more straightforward approach for Node.js compatibility

const fs = require('fs').promises;

class DuckDBSimpleWrapper {
    constructor() {
        this.db = null;
        this.connection = null;
        this.dbPath = null;
        this.duckdb = null;
    }

    async open(filename) {
        try {
            this.dbPath = filename;
            
            // Dynamic import of DuckDB-WASM
            const duckdbWasm = await import('@duckdb/duckdb-wasm');
            this.duckdb = duckdbWasm;
            
            // Initialize DuckDB without workers for simplicity in Node.js
            await this.initializeInMemory();
            
            console.log('DuckDB-WASM in-memory database initialized successfully');
            return this;
            
        } catch (error) {
            console.error('Failed to initialize DuckDB:', error);
            throw error;
        }
    }

    async initializeInMemory() {
        // Get the bundles
        const bundles = this.duckdb.getJsDelivrBundles();
        
        // Create a manual bundle configuration for Node.js
        const manualBundles = {
            mvp: {
                mainModule: bundles.mvp.mainModule,
                mainWorker: bundles.mvp.mainWorker,
            },
            eh: {
                mainModule: bundles.eh.mainModule,
                mainWorker: bundles.eh.mainWorker,
            }
        };
        
        // Select bundle
        const bundle = await this.duckdb.selectBundle(manualBundles);
        
        // For Node.js, we'll create a worker using a different approach
        const { Worker } = require('worker_threads');
        
        // Fetch the worker script content
        const fetch = (await import('node-fetch')).default;
        const workerScriptResponse = await fetch(bundle.mainWorker);
        const workerScript = await workerScriptResponse.text();
        
        // Create worker from script
        const worker = new Worker(workerScript, { eval: true });
        
        // Create logger
        const logger = new this.duckdb.ConsoleLogger();
        
        // Create database
        this.db = new this.duckdb.AsyncDuckDB(logger, worker);
        
        // Instantiate database
        await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        
        // Open connection
        this.connection = await this.db.connect();
    }

    // SQLite-compatible async methods
    async run(sql, ...params) {
        try {
            const duckdbSql = this.convertSqliteParams(sql);
            
            if (params.length > 0) {
                // DuckDB-WASM uses prepared statements differently
                // For now, we'll do string substitution (not ideal for production)
                let finalSql = duckdbSql;
                params.forEach((param, index) => {
                    finalSql = finalSql.replace(`$${index + 1}`, 
                        typeof param === 'string' ? `'${param}'` : param);
                });
                await this.connection.query(finalSql);
            } else {
                await this.connection.query(duckdbSql);
            }
            
            return { lastID: null, changes: null };
        } catch (error) {
            console.error('DuckDB run error:', error);
            throw error;
        }
    }

    async get(sql, ...params) {
        try {
            const duckdbSql = this.convertSqliteParams(sql);
            let finalSql = duckdbSql;
            
            if (params.length > 0) {
                params.forEach((param, index) => {
                    finalSql = finalSql.replace(`$${index + 1}`, 
                        typeof param === 'string' ? `'${param}'` : param);
                });
            }
            
            const result = await this.connection.query(finalSql);
            const rows = result.toArray();
            
            if (rows.length > 0) {
                // Convert to object
                const obj = {};
                const schema = result.schema.fields;
                schema.forEach((field, index) => {
                    obj[field.name] = rows[0][index];
                });
                return obj;
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
            let finalSql = duckdbSql;
            
            if (params.length > 0) {
                params.forEach((param, index) => {
                    finalSql = finalSql.replace(`$${index + 1}`, 
                        typeof param === 'string' ? `'${param}'` : param);
                });
            }
            
            const result = await this.connection.query(finalSql);
            const rows = result.toArray();
            
            // Convert to array of objects
            const objects = [];
            const schema = result.schema.fields;
            
            rows.forEach(row => {
                const obj = {};
                schema.forEach((field, index) => {
                    obj[field.name] = row[index];
                });
                objects.push(obj);
            });
            
            return objects;
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

    convertSqliteParams(sql) {
        let paramIndex = 1;
        return sql.replace(/\?/g, () => `$${paramIndex++}`);
    }

    async close() {
        if (this.connection) {
            await this.connection.close();
        }
        if (this.db) {
            await this.db.terminate();
        }
    }
}

module.exports = {
    async openDatabase(filename) {
        const wrapper = new DuckDBSimpleWrapper();
        await wrapper.open(filename);
        return wrapper;
    },
    
    getDatabaseType() {
        return 'duckdb-wasm-simple';
    }
};