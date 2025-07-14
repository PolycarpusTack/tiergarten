// DuckDB Neo client wrapper for Node.js
// Compatible with Node v22 and provides SQL interface similar to SQLite

const { DuckDBInstance, DuckDBConnection } = require('@duckdb/node-api');
const path = require('path');
const fs = require('fs').promises;

class DuckDBNeoWrapper {
    constructor() {
        this.instance = null;
        this.connection = null;
        this.dbPath = null;
    }

    async open(filename) {
        try {
            this.dbPath = filename;
            
            // Create DuckDB instance
            // For in-memory database, use ':memory:' as filename
            // For persistent database, use file path
            const useInMemory = filename === ':memory:' || filename.includes('duckdb_temp');
            
            if (useInMemory) {
                this.instance = await DuckDBInstance.create(':memory:');
                console.log('DuckDB Neo in-memory database created');
            } else {
                // For file-based database
                const dbDir = path.dirname(filename);
                await fs.mkdir(dbDir, { recursive: true });
                
                this.instance = await DuckDBInstance.create(filename);
                console.log(`DuckDB Neo database opened at ${filename}`);
            }
            
            // Create connection
            this.connection = await this.instance.connect();
            
            // Extensions are auto-loaded in DuckDB
            
            console.log('DuckDB Neo wrapper initialized successfully');
            return this;
            
        } catch (error) {
            console.error('Failed to open DuckDB:', error);
            throw error;
        }
    }

    // SQLite-compatible async methods
    async run(sql, ...params) {
        try {
            if (params.length > 0) {
                // Convert SQLite ? placeholders to DuckDB $1, $2 style
                let paramIndex = 1;
                const duckdbSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                
                // DuckDB Neo uses prepared statements
                const stmt = await this.connection.prepare(duckdbSql);
                
                // Bind parameters - DuckDB uses 1-based indexing
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
                        // Default to string representation
                        stmt.bindVarchar(i + 1, String(param));
                    }
                }
                
                const result = await stmt.run();
                stmt.destroySync();
                
                // Return SQLite-compatible result
                return {
                    lastID: null, // DuckDB doesn't expose lastID in the same way
                    changes: typeof result.rowCount === 'function' ? result.rowCount() : 0
                };
            } else {
                // Run without parameters
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
            let result;
            
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
            console.error('SQL:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    async all(sql, ...params) {
        try {
            let result;
            
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
                
                const reader = await stmt.runAndReadAll();
                stmt.destroySync();
                return reader.getRowObjects();
            } else {
                const reader = await this.connection.runAndReadAll(sql);
                return reader.getRowObjects();
            }
            
        } catch (error) {
            console.error('DuckDB all error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
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
            console.error('SQL:', sql);
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

    // Additional DuckDB-specific methods for future use
    async exportToParquet(tableName, filePath) {
        const sql = `COPY ${tableName} TO '${filePath}' (FORMAT PARQUET)`;
        await this.connection.run(sql);
    }

    async importFromParquet(filePath, tableName) {
        const sql = `CREATE TABLE ${tableName} AS SELECT * FROM read_parquet('${filePath}')`;
        await this.connection.run(sql);
    }

    async exportToCsv(tableName, filePath) {
        const sql = `COPY ${tableName} TO '${filePath}' (FORMAT CSV, HEADER)`;
        await this.connection.run(sql);
    }

    async importFromCsv(filePath, tableName) {
        const sql = `CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${filePath}')`;
        await this.connection.run(sql);
    }

    // Helper method to check if a table exists
    async tableExists(tableName) {
        try {
            const result = await this.get(
                "SELECT count(*) as count FROM information_schema.tables WHERE table_name = ?",
                tableName
            );
            return result && result.count > 0;
        } catch (error) {
            // If the query fails, assume table doesn't exist
            return false;
        }
    }
}

module.exports = {
    async openDatabase(filename) {
        const wrapper = new DuckDBNeoWrapper();
        await wrapper.open(filename);
        return wrapper;
    },
    
    getDatabaseType() {
        return 'duckdb-neo';
    }
};