// Updates for AppV2.js

// 1. Add these imports at the top of AppV2.js:
import PeopleViewV2 from './PeopleViewV2';
import PeopleConfigurationV2 from './PeopleConfigurationV2';
import CapacityPoolsViewV2 from './CapacityPoolsViewV2';

// 2. Add these state variables in the AppV2 component:
const [people, setPeople] = useState([]);
const [customFields, setCustomFields] = useState([]);
const [showPeopleConfig, setShowPeopleConfig] = useState(false);

// 3. Update the loadData function to include people:
const loadData = useCallback(async () => {
    try {
        setJiraError(null);
        
        const [ticketsData, clientsData, rulesData, dashboardsData, peopleData, fieldsData] = await Promise.all([
            api.getTickets(),
            api.getClients(),
            api.getGlobalRules(),
            api.getDashboards(),
            api.getPeople(),          // Add this
            api.getPeopleFields()      // Add this
        ]);

        setTickets([...ticketsData.exceptions, ...ticketsData.regularTickets]);
        setClients(clientsData);
        setGlobalRules(rulesData);
        setDashboards(dashboardsData);
        setPeople(peopleData);         // Add this
        setCustomFields(fieldsData);   // Add this

        // ... rest of existing loadData code
    } catch (err) {
        // ... existing error handling
    }
}, [api]);

// 4. Add People view case in the main render switch:
{currentView === 'people' && (
    <PeopleViewV2 
        people={people}
        api={api}
        onRefresh={loadData}
        customFields={customFields}
    />
)}

// 5. Add Capacity view case:
{currentView === 'capacity' && (
    <CapacityPoolsViewV2 api={api} />
)}

// 6. Add People Configuration modal:
{showPeopleConfig && (
    <PeopleConfigurationV2
        api={api}
        onClose={() => setShowPeopleConfig(false)}
    />
)}

// 7. Update the sidebar to include configuration option:
<SidebarV2 
    collapsed={sidebarCollapsed}
    setCollapsed={setSidebarCollapsed}
    currentView={currentView}
    setCurrentView={setCurrentView}
    api={api}
    onImportClick={() => setIsImportModalOpen(true)}
    onExportClick={handleExport}
    onBackupClick={handleBackup}
    onJiraConfig2Click={() => setShowJiraConfig2(true)}
    onPeopleConfigClick={() => setShowPeopleConfig(true)}  // Add this
/>

// ============================================
// Updates for SidebarV2.js

// Add these navigation items to the navigationItems array:
{ 
    id: 'people', 
    label: 'People', 
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
},
{ 
    id: 'capacity', 
    label: 'Capacity', 
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2zm9-2h-2V5a2 2 0 00-2-2 2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2z'
},

// Add this to quickActions array:
{ label: 'People Configuration', action: 'people-config' },

// Update handleQuickAction to include:
case 'people-config':
    if (onPeopleConfigClick) {
        onPeopleConfigClick();
    } else {
        console.log('People configuration - handler not provided');
    }
    break;

// ============================================
// Updates for server.js

// Add these requires after other route imports:
const peopleRoutes = require('./routes/people-routes');
const capacityRoutes = require('./routes/capacity-routes');

// Add these route uses after other routes:
app.use('/api', peopleRoutes(db));
app.use('/api', capacityRoutes(db));

// Add this endpoint for people configuration:
app.get('/api/people/config', async (req, res) => {
    try {
        const config = await db.get('SELECT * FROM people_config WHERE id = 1');
        res.json(config || {});
    } catch (error) {
        console.error('Error fetching people config:', error);
        res.status(500).json({ error: 'Failed to fetch people configuration' });
    }
});

app.put('/api/people/config', async (req, res) => {
    try {
        const { expertise_config, capacity_config } = req.body;
        
        await db.run(`
            UPDATE people_config 
            SET expertise_config = ?, capacity_config = ?, last_updated = CURRENT_TIMESTAMP
            WHERE id = 1
        `, [expertise_config, capacity_config]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating people config:', error);
        res.status(500).json({ error: 'Failed to update people configuration' });
    }
});

// ============================================
// Updates for duckdb-database.js initSchema method

// Add this after other table creation in initSchema():
// People tables
await this.exec(`
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

    -- People specializations
    CREATE TABLE IF NOT EXISTS people_specializations (
        person_id INTEGER NOT NULL,
        action VARCHAR NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
        proficiency_level INTEGER DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
        PRIMARY KEY (person_id, action),
        FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    -- People client expertise
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

    -- People custom fields configuration
    CREATE SEQUENCE IF NOT EXISTS seq_people_field_config_id START 1;
    
    CREATE TABLE IF NOT EXISTS people_field_config (
        id INTEGER PRIMARY KEY DEFAULT nextval('seq_people_field_config_id'),
        field_name VARCHAR NOT NULL UNIQUE,
        field_type VARCHAR NOT NULL CHECK (field_type IN ('string', 'number', 'date', 'formula')),
        field_config VARCHAR DEFAULT '{}',
        display_order INTEGER DEFAULT 0,
        is_required INTEGER DEFAULT 0 CHECK (is_required IN (0, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- People custom field values
    CREATE TABLE IF NOT EXISTS people_field_values (
        person_id INTEGER NOT NULL,
        field_id INTEGER NOT NULL,
        value VARCHAR,
        PRIMARY KEY (person_id, field_id),
        FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
        FOREIGN KEY (field_id) REFERENCES people_field_config(id) ON DELETE CASCADE
    );

    -- Ticket assignments
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

    -- People configuration
    CREATE TABLE IF NOT EXISTS people_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        expertise_config VARCHAR DEFAULT '{"calculationPeriod":"months","periodValue":6,"thresholds":{"expert":100,"intermediate":40,"novice":0}}',
        capacity_config VARCHAR DEFAULT '{}',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

// Add this to insertDefaultData method:
await this.exec(`
    INSERT INTO people_config (id) 
    VALUES (1) 
    ON CONFLICT (id) DO NOTHING;
`);