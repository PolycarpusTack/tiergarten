# DuckDB Migration Guide

## Overview

Tiergarten now supports DuckDB as an alternative to SQLite, providing better performance for analytics queries and compatibility with Node.js v22. This guide explains how to migrate from SQLite to DuckDB and use the new features.

## Why DuckDB?

1. **Node.js v22 Compatibility**: No native module compilation issues
2. **Analytics Performance**: Optimized for analytical queries with window functions
3. **SQL Features**: Full SQL support including CTEs, window functions, and advanced aggregations
4. **Future-Ready**: Easy migration path to PostgreSQL for production deployments
5. **Scalability**: Handles 10,000+ tickets efficiently

## Migration Process

### Automatic Migration

The system automatically migrates your SQLite database to DuckDB when you first run with DuckDB enabled:

```bash
# Windows
start-duckdb.bat

# Linux/Mac
./start-duckdb.sh
```

### Manual Migration

To manually migrate your database:

```bash
cd server
node migrate-to-duckdb.js
```

This creates a new DuckDB database at `server/database/jira_tiers_duckdb.db` with all your existing data.

## Using DuckDB

### Environment Variable

Set the `USE_DUCKDB` environment variable to enable DuckDB:

```bash
export USE_DUCKDB=true
npm run dev
```

### Startup Scripts

Use the provided startup scripts for convenience:

- `start-duckdb.bat` (Windows)
- `start-duckdb.sh` (Linux/Mac)

### Fallback to SQLite

If DuckDB fails to initialize, the system automatically falls back to SQLite, ensuring your application continues to work.

## New Features with DuckDB

### Analytics Queries

DuckDB enables advanced analytics queries that weren't possible with SQLite:

```javascript
// Example: Tier distribution with percentages
const tierStats = await db.runAnalytics(`
    SELECT 
        tier,
        COUNT(*) as client_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM clients
    GROUP BY tier
    ORDER BY tier
`);
```

### Window Functions

Use window functions for advanced calculations:

```sql
-- Running totals
SELECT 
    created_at::DATE as date,
    COUNT(*) as daily_tickets,
    SUM(COUNT(*)) OVER (ORDER BY created_at::DATE) as running_total
FROM tickets
GROUP BY date
```

### Export Capabilities

Export data to various formats (DuckDB only):

```javascript
// Export to Parquet
await db.exportToParquet('clients', 'clients.parquet');

// Export to CSV
await db.exportToCsv('tickets', 'tickets.csv');
```

## Database Compatibility

The database adapter ensures compatibility between SQLite and DuckDB:

1. **Same API**: All existing database calls work unchanged
2. **Schema Compatibility**: Tables and indexes work in both databases
3. **Query Compatibility**: Standard SQL queries work in both
4. **Automatic Type Conversion**: Data types are handled transparently

## Performance Considerations

### DuckDB Advantages

- **Analytical Queries**: 10-100x faster for aggregations and joins
- **Memory Efficiency**: Columnar storage for better compression
- **Parallel Processing**: Multi-threaded query execution

### SQLite Advantages

- **Simple Queries**: Slightly faster for single-row lookups
- **Smaller Footprint**: Less memory usage for small datasets
- **Maturity**: Battle-tested in production environments

## Troubleshooting

### Common Issues

1. **Module Not Found**
   ```
   Error: Cannot find module '@duckdb/node-api'
   ```
   Solution: Run `npm install` in the server directory

2. **Database Lock**
   ```
   Error: Database is locked
   ```
   Solution: Ensure no other process is using the database

3. **Migration Fails**
   ```
   Error: Migration failed
   ```
   Solution: Check disk space and permissions

### Verification

Test your DuckDB installation:

```bash
cd server
node test-duckdb-migration.js
```

## Best Practices

1. **Backup Before Migration**: Always backup your SQLite database before migrating
2. **Test Thoroughly**: Run your test suite with both databases
3. **Monitor Performance**: Compare query performance between databases
4. **Use Analytics Wisely**: Take advantage of DuckDB's analytics capabilities

## Future Roadmap

The DuckDB integration prepares Tiergarten for:

1. **Advanced Analytics**: As documented in `future-analytics-ideas.md`
2. **Workforce Management**: Integration with Soma as per `soma-integration-plan.md`
3. **PostgreSQL Migration**: Easy transition to PostgreSQL for enterprise deployments
4. **Real-time Analytics**: Streaming data processing capabilities

## Configuration

### Database Selection Logic

```javascript
// Default: SQLite
const db = new SQLiteDatabase();

// With DuckDB
process.env.USE_DUCKDB = 'true';
const db = new SQLiteDatabase(); // Automatically uses DuckDB
```

### Custom Database Path

```javascript
const db = await getDatabase({
    useDuckDB: true,
    dbPath: '/custom/path/to/database.db'
});
```

## API Reference

### Standard Methods (Both Databases)

- `db.run(sql, ...params)` - Execute SQL with parameters
- `db.get(sql, ...params)` - Get single row
- `db.all(sql, ...params)` - Get all rows
- `db.exec(sql)` - Execute raw SQL

### DuckDB-Only Methods

- `db.runAnalytics(query)` - Run analytics queries
- `db.exportToParquet(table, file)` - Export to Parquet
- `db.exportToCsv(table, file)` - Export to CSV

## Conclusion

The DuckDB integration provides a smooth upgrade path for Tiergarten, enabling advanced analytics while maintaining full backward compatibility. Start with the default SQLite, and switch to DuckDB when you need:

- Better analytics performance
- Node.js v22 compatibility
- Advanced SQL features
- Large dataset handling (10k+ tickets)