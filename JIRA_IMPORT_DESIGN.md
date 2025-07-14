# JIRA Import System Design for Tiergarten

## Overview
A robust, simple, and maintainable JIRA import system that handles credentials, project mapping, and ticket importing with clear separation of concerns.

## Architecture Components

### 1. Database Schema (Store Everything in DB)
```sql
-- JIRA connection configuration
CREATE TABLE jira_config (
    id INTEGER PRIMARY KEY,
    base_url VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    api_token_encrypted VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_tested TIMESTAMP,
    last_import TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import profiles (reusable import configurations)
CREATE TABLE import_profiles (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    filters JSON NOT NULL DEFAULT '{}',
    -- Filters include: date_range, ticket_types, statuses, projects, custom_jql
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import history for tracking
CREATE TABLE import_history (
    id INTEGER PRIMARY KEY,
    profile_id INTEGER,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    tickets_imported INTEGER DEFAULT 0,
    tickets_updated INTEGER DEFAULT 0,
    tickets_failed INTEGER DEFAULT 0,
    error_log TEXT,
    metadata JSON,
    FOREIGN KEY (profile_id) REFERENCES import_profiles(id)
);

-- Project mapping configuration
CREATE TABLE project_mappings (
    id INTEGER PRIMARY KEY,
    jira_project_key VARCHAR NOT NULL UNIQUE,
    jira_project_name VARCHAR NOT NULL,
    client_id INTEGER,
    tier INTEGER DEFAULT 3,
    auto_import BOOLEAN DEFAULT true,
    import_settings JSON DEFAULT '{}',
    last_synced TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

### 2. API Structure

#### Configuration Endpoints
```javascript
// Get current JIRA configuration (without exposing token)
GET /api/jira/config
Response: {
    configured: boolean,
    baseUrl: string,
    email: string,
    lastTested: timestamp,
    lastImport: timestamp
}

// Update JIRA configuration
POST /api/jira/config
Body: { baseUrl, email, apiToken }
Response: { success: boolean, message: string }

// Test JIRA connection
POST /api/jira/test
Response: { 
    success: boolean, 
    user: { displayName, email },
    permissions: { canBrowseProjects: boolean },
    error?: string 
}
```

#### Import Endpoints
```javascript
// Get available projects from JIRA
GET /api/jira/projects
Response: [{
    key: string,
    name: string,
    lead: { displayName, email },
    issueTypes: [{ name, id }],
    currentMapping?: { clientId, tier, autoImport }
}]

// Get import profiles
GET /api/import/profiles
Response: [{ id, name, description, filters, isDefault }]

// Create/update import profile
POST /api/import/profiles
Body: { name, description, filters }

// Start import process
POST /api/import/start
Body: { 
    profileId?: number,
    filters?: {
        dateRange: { from, to },
        projects: string[],
        ticketTypes: string[],
        statuses: string[],
        customJql?: string
    },
    options: {
        updateExisting: boolean,
        dryRun: boolean
    }
}
Response: { importId: number, status: 'started' }

// Get import progress
GET /api/import/progress/:importId
Response: {
    status: string,
    progress: { current: number, total: number },
    currentOperation: string,
    errors: []
}

// Cancel import
POST /api/import/cancel/:importId
```

### 3. Import Service Architecture

```javascript
class JiraImportService {
    constructor(db, jiraClient) {
        this.db = db;
        this.jira = jiraClient;
        this.imports = new Map(); // Active imports
    }

    async startImport(profileId, filters, options) {
        const importId = await this.createImportRecord();
        
        // Run import in background
        this.runImport(importId, filters, options)
            .catch(err => this.handleImportError(importId, err));
        
        return importId;
    }

    async runImport(importId, filters, options) {
        const import = { 
            id: importId, 
            status: 'running',
            progress: { current: 0, total: 0 },
            canceled: false 
        };
        
        this.imports.set(importId, import);

        try {
            // Phase 1: Fetch data from JIRA
            await this.updateProgress(importId, 'Fetching projects from JIRA...');
            const projects = await this.fetchProjects(filters);
            
            // Phase 2: Fetch tickets
            await this.updateProgress(importId, 'Counting tickets...');
            const ticketCount = await this.countTickets(filters);
            import.progress.total = ticketCount;
            
            // Phase 3: Import tickets in batches
            const batchSize = 50;
            for (let start = 0; start < ticketCount; start += batchSize) {
                if (import.canceled) break;
                
                await this.updateProgress(
                    importId, 
                    `Importing tickets ${start + 1} to ${Math.min(start + batchSize, ticketCount)}...`
                );
                
                const tickets = await this.fetchTickets(filters, start, batchSize);
                await this.processTickets(tickets, options);
                
                import.progress.current = Math.min(start + batchSize, ticketCount);
            }
            
            // Phase 4: Apply rules and actions
            await this.updateProgress(importId, 'Applying action rules...');
            await this.applyActionRules();
            
            await this.completeImport(importId, 'completed');
        } catch (error) {
            await this.completeImport(importId, 'failed', error);
            throw error;
        } finally {
            this.imports.delete(importId);
        }
    }

    async processTickets(tickets, options) {
        for (const ticket of tickets) {
            try {
                // Transform JIRA ticket to our format
                const transformedTicket = this.transformTicket(ticket);
                
                // Check if ticket exists
                const existing = await this.db.get(
                    'SELECT * FROM tickets WHERE key = ?', 
                    ticket.key
                );
                
                if (existing && !options.updateExisting) {
                    continue;
                }
                
                // Save or update ticket
                await this.saveTicket(transformedTicket);
            } catch (error) {
                // Log error but continue with other tickets
                await this.logTicketError(ticket.key, error);
            }
        }
    }

    transformTicket(jiraTicket) {
        return {
            key: jiraTicket.key,
            summary: jiraTicket.fields.summary,
            status: jiraTicket.fields.status.name,
            priority: jiraTicket.fields.priority?.name || 'Medium',
            type: jiraTicket.fields.issuetype.name,
            created: jiraTicket.fields.created,
            updated: jiraTicket.fields.updated,
            reporter: jiraTicket.fields.reporter?.displayName,
            assignee: jiraTicket.fields.assignee?.displayName,
            project: jiraTicket.fields.project.key,
            // Custom fields mapping
            customerPriority: jiraTicket.fields.customfield_10001,
            mgxPriority: this.mapMgxPriority(jiraTicket),
            labels: jiraTicket.fields.labels || [],
            components: jiraTicket.fields.components?.map(c => c.name) || []
        };
    }
}
```

### 4. Frontend Components

#### Simple Configuration Component
```jsx
const JiraConfiguration = () => {
    const [config, setConfig] = useState({ baseUrl: '', email: '', apiToken: '' });
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const handleSave = async () => {
        try {
            await api.saveJiraConfig(config);
            setConfig({ ...config, apiToken: '' }); // Clear token after save
            toast.success('Configuration saved successfully');
        } catch (error) {
            toast.error('Failed to save configuration');
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            const result = await api.testJiraConnection();
            setTestResult(result);
        } catch (error) {
            setTestResult({ success: false, error: error.message });
        }
        setTesting(false);
    };

    return (
        <div className="space-y-4">
            <h3>JIRA Configuration</h3>
            
            <input
                type="url"
                placeholder="JIRA Base URL (e.g., https://company.atlassian.net)"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            />
            
            <input
                type="email"
                placeholder="Email"
                value={config.email}
                onChange={(e) => setConfig({ ...config, email: e.target.value })}
            />
            
            <input
                type="password"
                placeholder="API Token"
                value={config.apiToken}
                onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
            />
            
            <div className="flex gap-2">
                <button onClick={handleTest} disabled={testing}>
                    {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button onClick={handleSave} disabled={!testResult?.success}>
                    Save Configuration
                </button>
            </div>
            
            {testResult && <TestResult result={testResult} />}
        </div>
    );
};
```

#### Import Wizard Component
```jsx
const ImportWizard = () => {
    const [step, setStep] = useState(1);
    const [importConfig, setImportConfig] = useState({
        projects: [],
        dateRange: { from: null, to: null },
        ticketTypes: [],
        statuses: [],
        updateExisting: true
    });
    const [importId, setImportId] = useState(null);
    const [progress, setProgress] = useState(null);

    const steps = [
        { id: 1, name: 'Select Projects', component: ProjectSelector },
        { id: 2, name: 'Configure Filters', component: FilterConfiguration },
        { id: 3, name: 'Review & Import', component: ImportReview },
        { id: 4, name: 'Progress', component: ImportProgress }
    ];

    const startImport = async () => {
        const { importId } = await api.startImport(importConfig);
        setImportId(importId);
        setStep(4);
        
        // Poll for progress
        const interval = setInterval(async () => {
            const progress = await api.getImportProgress(importId);
            setProgress(progress);
            
            if (['completed', 'failed', 'cancelled'].includes(progress.status)) {
                clearInterval(interval);
            }
        }, 1000);
    };

    const CurrentStep = steps[step - 1].component;

    return (
        <div className="import-wizard">
            <StepIndicator steps={steps} currentStep={step} />
            
            <CurrentStep
                config={importConfig}
                setConfig={setImportConfig}
                onNext={() => setStep(step + 1)}
                onBack={() => setStep(step - 1)}
                onImport={startImport}
                progress={progress}
                importId={importId}
            />
        </div>
    );
};
```

### 5. Key Benefits

1. **Secure Credential Storage**: API tokens stored encrypted in database, not in files
2. **Flexible Import Profiles**: Save and reuse import configurations
3. **Progress Tracking**: Real-time import progress with ability to cancel
4. **Error Recovery**: Detailed error logging per ticket, can retry failed imports
5. **Project Mapping**: Clear UI for mapping JIRA projects to clients with tiers
6. **Batch Processing**: Handles large volumes efficiently
7. **Audit Trail**: Complete history of all imports

### 6. Implementation Steps

1. Create database schema for JIRA configuration
2. Build secure credential management endpoints
3. Implement JIRA client wrapper with error handling
4. Create import service with progress tracking
5. Build simple configuration UI
6. Create import wizard with filters
7. Add project mapping interface
8. Implement background import processing
9. Add import history view
10. Create automated import scheduling (optional)

This design provides a robust, user-friendly JIRA import system that addresses all your needs while being maintainable and extensible.