// Database migration to add People Profiles tables
// Run this migration to add the new tables to your DuckDB database

const addPeopleTables = async (db) => {
    console.log('Starting People Profiles migration...');
    
    try {
        // Create people table
        await db.exec(`
            -- People table
            CREATE SEQUENCE IF NOT EXISTS seq_people_id START 1;

            CREATE TABLE IF NOT EXISTS people (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_people_id'),
                first_name VARCHAR NOT NULL,
                last_name VARCHAR NOT NULL,
                email VARCHAR UNIQUE,
                weekly_capacity DECIMAL DEFAULT 40.0,
                is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ Created people table');

        // Create people specializations table
        await db.exec(`
            -- People specializations (many-to-many relationship)
            CREATE TABLE IF NOT EXISTS people_specializations (
                person_id INTEGER NOT NULL,
                action VARCHAR NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
                proficiency_level INTEGER DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
                PRIMARY KEY (person_id, action),
                FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
            );
        `);
        console.log('✓ Created people_specializations table');

        // Create people client expertise table
        await db.exec(`
            -- People client expertise (calculated/tracked)
            CREATE TABLE IF NOT EXISTS people_client_expertise (
                person_id INTEGER NOT NULL,
                client_id INTEGER NOT NULL,
                hours_worked DECIMAL DEFAULT 0,
                last_assignment TIMESTAMP,
                expertise_level VARCHAR CHECK (expertise_level IN ('Novice', 'Intermediate', 'Expert')),
                PRIMARY KEY (person_id, client_id),
                FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );
        `);
        console.log('✓ Created people_client_expertise table');

        // Create people custom fields configuration table
        await db.exec(`
            -- People custom fields configuration
            CREATE SEQUENCE IF NOT EXISTS seq_people_field_config_id START 1;
            
            CREATE TABLE IF NOT EXISTS people_field_config (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_people_field_config_id'),
                field_name VARCHAR NOT NULL UNIQUE,
                field_type VARCHAR NOT NULL CHECK (field_type IN ('string', 'number', 'date', 'formula')),
                field_config VARCHAR DEFAULT '{}', -- JSON configuration
                display_order INTEGER DEFAULT 0,
                is_required INTEGER DEFAULT 0 CHECK (is_required IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ Created people_field_config table');

        // Create people custom field values table
        await db.exec(`
            -- People custom field values
            CREATE TABLE IF NOT EXISTS people_field_values (
                person_id INTEGER NOT NULL,
                field_id INTEGER NOT NULL,
                value VARCHAR,
                PRIMARY KEY (person_id, field_id),
                FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
                FOREIGN KEY (field_id) REFERENCES people_field_config(id) ON DELETE CASCADE
            );
        `);
        console.log('✓ Created people_field_values table');

        // Create ticket assignments table
        await db.exec(`
            -- Ticket assignments (for tracking current load)
            CREATE SEQUENCE IF NOT EXISTS seq_ticket_assignments_id START 1;
            
            CREATE TABLE IF NOT EXISTS ticket_assignments (
                id INTEGER PRIMARY KEY DEFAULT nextval('seq_ticket_assignments_id'),
                ticket_key VARCHAR NOT NULL,
                person_id INTEGER NOT NULL,
                assigned_hours DECIMAL DEFAULT 0,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (person_id) REFERENCES people(id),
                UNIQUE(ticket_key, person_id)
            );
        `);
        console.log('✓ Created ticket_assignments table');

        // Create people configuration table
        await db.exec(`
            -- People configuration table
            CREATE TABLE IF NOT EXISTS people_config (
                id INTEGER PRIMARY KEY DEFAULT 1,
                expertise_config VARCHAR DEFAULT '{"calculationPeriod":"months","periodValue":6,"thresholds":{"expert":100,"intermediate":40,"novice":0}}',
                capacity_config VARCHAR DEFAULT '{}',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ Created people_config table');

        // Insert default configuration
        await db.exec(`
            INSERT INTO people_config (id) 
            VALUES (1) 
            ON CONFLICT (id) DO NOTHING;
        `);
        console.log('✓ Inserted default configuration');

        // Add estimatedHours column to tickets table if it doesn't exist
        try {
            await db.exec(`
                ALTER TABLE tickets ADD COLUMN IF NOT EXISTS estimatedHours DECIMAL DEFAULT 0;
            `);
            console.log('✓ Added estimatedHours column to tickets table');
        } catch (error) {
            // Column might already exist
            console.log('ℹ estimatedHours column already exists or cannot be added');
        }

        // Create indexes for performance
        await db.exec(`
            CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);
            CREATE INDEX IF NOT EXISTS idx_people_active ON people(is_active);
            CREATE INDEX IF NOT EXISTS idx_ticket_assignments_person ON ticket_assignments(person_id);
            CREATE INDEX IF NOT EXISTS idx_ticket_assignments_ticket ON ticket_assignments(ticket_key);
            CREATE INDEX IF NOT EXISTS idx_ticket_assignments_completed ON ticket_assignments(completed_at);
            CREATE INDEX IF NOT EXISTS idx_people_specializations_action ON people_specializations(action);
        `);
        console.log('✓ Created indexes');

        console.log('✅ People Profiles migration completed successfully!');
        
        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

// Export for use in migration scripts
module.exports = { addPeopleTables };

// If running directly
if (require.main === module) {
    const path = require('path');
    const { DuckDBInstance } = require('@duckdb/node-api');
    
    async function runMigration() {
        try {
            // Initialize database connection
            const dbPath = path.join(__dirname, '../database/tiergarten.duckdb');
            const instance = await DuckDBInstance.create(dbPath);
            const connection = await instance.connect();
            
            const db = {
                exec: async (sql) => {
                    return connection.run(sql);
                }
            };
            
            // Run migration
            await addPeopleTables(db);
            
            // Close connection
            await connection.close();
            await instance.close();
            
            console.log('\n🎉 Migration completed! You can now use the People Profiles feature.');
        } catch (error) {
            console.error('Migration error:', error);
            process.exit(1);
        }
    }
    
    runMigration();
}