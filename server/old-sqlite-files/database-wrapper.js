// Database wrapper that can use either sqlite3 or better-sqlite3

let dbModule;
let dbInstance;

// Try to load sqlite3 first, fall back to better-sqlite3
try {
    const { open } = require('sqlite');
    const sqlite3 = require('sqlite3');
    
    dbModule = {
        type: 'sqlite3',
        async open(options) {
            const db = await open({
                filename: options.filename,
                driver: sqlite3.Database
            });
            return db;
        }
    };
} catch (error) {
    console.log('sqlite3 failed to load, trying better-sqlite3...');
    
    try {
        const Database = require('better-sqlite3');
        
        // Wrapper to make better-sqlite3 async-compatible
        class AsyncDatabase {
            constructor(filename) {
                this.db = new Database(filename);
                this.db.pragma('journal_mode = WAL');
                this.db.pragma('foreign_keys = ON');
            }
            
            async run(sql, ...params) {
                try {
                    const stmt = this.db.prepare(sql);
                    const result = params.length ? stmt.run(...params) : stmt.run();
                    return {
                        lastID: result.lastInsertRowid,
                        changes: result.changes
                    };
                } catch (error) {
                    throw error;
                }
            }
            
            async get(sql, ...params) {
                const stmt = this.db.prepare(sql);
                return params.length ? stmt.get(...params) : stmt.get();
            }
            
            async all(sql, ...params) {
                const stmt = this.db.prepare(sql);
                return params.length ? stmt.all(...params) : stmt.all();
            }
            
            async exec(sql) {
                this.db.exec(sql);
            }
            
            close() {
                this.db.close();
            }
        }
        
        dbModule = {
            type: 'better-sqlite3',
            async open(options) {
                return new AsyncDatabase(options.filename);
            }
        };
    } catch (error2) {
        console.error('Neither sqlite3 nor better-sqlite3 could be loaded');
        throw new Error('No SQLite driver available');
    }
}

module.exports = {
    async openDatabase(filename) {
        if (!dbInstance) {
            dbInstance = await dbModule.open({ filename });
            console.log(`Database opened using ${dbModule.type}`);
        }
        return dbInstance;
    },
    
    getDatabaseType() {
        return dbModule.type;
    }
};