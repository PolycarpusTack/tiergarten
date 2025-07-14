// server.js - JIRA Tier Management System with DuckDB
const express = require('express');
const db = require('./duckdb-database');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const JiraFieldMapper = require('./jiraFieldMapper');
const jiraErrorHandler = require('./services/jira-error-handler');
const JiraConfigService = require('./services/jira-config-service');
const { validateRequest, schemas } = require('./middleware/validation');
const { logger, logError, handleApiError } = require('./utils/logger');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Debug environment variables
console.log('[ENV] Loading from:', path.join(__dirname, '.env'));
console.log('[ENV] JIRA_BASE_URL:', process.env.JIRA_BASE_URL || 'NOT SET');
console.log('[ENV] JIRA_EMAIL:', process.env.JIRA_EMAIL || 'NOT SET');
console.log('[ENV] JIRA_API_TOKEN:', process.env.JIRA_API_TOKEN ? 'SET (hidden)' : 'NOT SET');

const app = express();

// Set server limits before any middleware
app.set('trust proxy', 1);

// Configure JSON serialization to handle BigInt from DuckDB
app.set('json replacer', (key, value) => {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    return value;
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging
app.use(logger.middleware());

// Clean headers middleware
app.use((req, res, next) => {
    // Remove potentially large headers
    delete req.headers['cookie'];
    delete req.headers['authorization'];
    next();
});

// CORS configuration
app.use(cors({
    origin: ['http://localhost:36590', 'http://localhost:3002', 'http://127.0.0.1:36590', 'http://127.0.0.1:3002'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: false,
    optionsSuccessStatus: 200
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: db.isReady() ? 'connected' : 'disconnected',
        dbSize: db.getDatabaseSize()
    });
});

// Simple test endpoint for JIRA config
app.get('/api/test/jira-config', (req, res) => {
    console.log('[TEST] JIRA config request received');
    const config = {
        hasBaseUrl: !!process.env.JIRA_BASE_URL,
        hasEmail: !!process.env.JIRA_EMAIL,
        hasToken: !!process.env.JIRA_API_TOKEN,
        baseUrl: process.env.JIRA_BASE_URL || 'not-set',
        email: process.env.JIRA_EMAIL || 'not-set'
    };
    console.log('[TEST] Sending config:', config);
    res.json(config);
});

// Initialize services
let jiraConfigService;
let jiraImportService;
let jiraSyncOrchestrator;

// Initialize database
async function initDatabase() {
    await db.init();
    console.log('DuckDB database initialized');
    
    // Initialize services after database is ready
    jiraConfigService = new JiraConfigService(db);
    jira = new JiraIntegration(jiraConfigService);
    
    // Initialize import service
    const JiraImportService = require('./services/jira-import-service');
    jiraImportService = new JiraImportService(db, jiraConfigService);
    
    // Initialize JIRA Config 2 services
    const JiraConfig2Service = require('./services/jira-config2-service');
    const JiraImport2Service = require('./services/jira-import2-service');
    global.jiraConfig2Service = new JiraConfig2Service(db, jiraConfigService);
    global.jiraImport2Service = new JiraImport2Service(db, global.jiraConfig2Service);
    
    // Initialize sync orchestrator
    const JiraSyncOrchestrator = require('./services/jira-sync-orchestrator');
    jiraSyncOrchestrator = new JiraSyncOrchestrator(db, jiraConfigService);
    global.jiraSyncOrchestrator = jiraSyncOrchestrator;
    
    // Start scheduled incremental sync if configured
    if (process.env.ENABLE_AUTO_SYNC === 'true') {
        const syncInterval = parseInt(process.env.SYNC_INTERVAL) || 300000; // 5 minutes default
        jiraSyncOrchestrator.scheduleSync('incremental', syncInterval);
        logger.info('Auto-sync enabled', { interval: syncInterval });
    }
}

// JIRA API Integration
class JiraIntegration {
    constructor(jiraConfigService) {
        this.jiraConfigService = jiraConfigService;
        this.fieldMapper = null;
        
        // Add caching to prevent excessive API calls
        this.cache = {
            tickets: null,
            lastFetch: null,
            cacheDuration: 30000 // 30 seconds
        };
    }

    async getCredentials() {
        return await this.jiraConfigService.getCredentials();
    }

    async ensureFieldMapper() {
        if (!this.fieldMapper) {
            const creds = await this.getCredentials();
            if (creds) {
                this.fieldMapper = new JiraFieldMapper(creds.baseUrl, {
                    username: creds.email,
                    password: creds.apiToken
                });
            }
        }
        return this.fieldMapper;
    }

    async fetchProjects() {
        try {
            const creds = await this.getCredentials();
            
            if (!creds) {
                console.log('Using mock JIRA projects - no credentials configured');
                return [
                    { key: 'PROJ', name: 'Project Alpha' },
                    { key: 'WEB', name: 'Web Platform' },
                    { key: 'DATA', name: 'Data Services' }
                ];
            }
            
            const fetchOperation = async () => {
                const response = await axios.get(`${creds.baseUrl}/rest/api/2/project`, {
                    auth: {
                        username: creds.email,
                        password: creds.apiToken
                    },
                    timeout: 30000 // 30 second timeout
                });
                
                return response.data.map(project => ({
                    key: project.key,
                    name: project.name
                }));
            };
            
            // Use error handler with retry logic
            return await jiraErrorHandler.handleWithRetry(fetchOperation);
            
        } catch (error) {
            jiraErrorHandler.logError('fetchProjects', error);
            throw jiraErrorHandler.createErrorResponse(error);
        }
    }

    async fetchTickets() {
        try {
            // Check cache first to prevent excessive API calls
            const now = Date.now();
            if (this.cache.tickets && this.cache.lastFetch && 
                (now - this.cache.lastFetch) < this.cache.cacheDuration) {
                console.log('Returning cached tickets (age: ' + Math.round((now - this.cache.lastFetch) / 1000) + 's)');
                return this.cache.tickets;
            }
            
            console.log('Fetching fresh tickets from JIRA...');
            
            // Get import configuration
            const config = await db.get('SELECT * FROM import_config WHERE id = 1');
            const excludedProjects = JSON.parse(config?.excluded_projects || '[]');
            
            // Handle both JSON arrays and comma-separated strings for backward compatibility
            let selectedTicketTypes = [];
            try {
                selectedTicketTypes = JSON.parse(config?.selected_ticket_types || '[]');
            } catch (e) {
                // If it's not valid JSON, try splitting as comma-separated string
                if (config?.selected_ticket_types && typeof config.selected_ticket_types === 'string') {
                    selectedTicketTypes = config.selected_ticket_types.split(',').map(s => s.trim());
                }
            }
            
            let selectedTicketStatuses = [];
            try {
                selectedTicketStatuses = JSON.parse(config?.selected_ticket_statuses || '[]');
            } catch (e) {
                // If it's not valid JSON, try splitting as comma-separated string
                if (config?.selected_ticket_statuses && typeof config.selected_ticket_statuses === 'string') {
                    selectedTicketStatuses = config.selected_ticket_statuses.split(',').map(s => s.trim());
                }
            }
            
            // Get all clients
            const clients = await db.all('SELECT * FROM clients');
            
            if (clients.length === 0) {
                return [];
            }
            
            // Build JQL query
            const projectKeys = clients
                .map(c => c.jiraProjectKey)
                .filter(key => !excludedProjects.includes(key));
            
            if (projectKeys.length === 0) {
                return [];
            }
            
            // Build JQL with filters - limit to first 10 projects to avoid query length issues
            const limitedProjectKeys = projectKeys.slice(0, 10);
            console.log(`Building JQL for ${limitedProjectKeys.length} projects out of ${projectKeys.length} total`);
            let jql = `project in (${limitedProjectKeys.join(',')}) AND created >= -${config?.date_offset_days || 30}d`;
            
            // Add ticket type filter if specified
            if (selectedTicketTypes.length > 0) {
                jql += ` AND issuetype in (${selectedTicketTypes.map(t => `"${t}"`).join(',')})`;
            }
            
            // Add status filter if specified
            if (selectedTicketStatuses.length > 0) {
                jql += ` AND status in (${selectedTicketStatuses.map(s => `"${s}"`).join(',')})`;
            }
            
            jql += ' ORDER BY created DESC';
            
            console.log('Final JQL query:', jql);
            
            // Return mock data if no JIRA credentials or if using placeholder values
            const hasValidCredentials = this.baseUrl && 
                                      this.auth.username && 
                                      this.auth.password &&
                                      !this.baseUrl.includes('your-domain') &&
                                      !this.auth.username.includes('your-email') &&
                                      !this.auth.password.includes('your-api-token');
            
            if (!hasValidCredentials) {
                const mockTickets = this.getMockTickets(clients);
                
                // Cache mock data
                this.cache.tickets = mockTickets;
                this.cache.lastFetch = Date.now();
                
                return mockTickets;
            }
            
            const fetchOperation = async () => {
                // Get dynamic field list including custom fields
                const fields = await this.fieldMapper.getFieldsList();
                
                const response = await axios.get(`${this.baseUrl}/rest/api/2/search`, {
                    auth: this.auth,
                    params: {
                        jql: jql,
                        maxResults: 100,
                        fields: fields
                    },
                    timeout: 30000 // 30 second timeout
                });
                
                return response.data.issues.map(issue => {
                    // Use field mapper to extract custom priorities
                    const customerPriority = this.fieldMapper.extractCustomerPriority(issue);
                    const mgxPriority = this.fieldMapper.extractMgxPriority(issue);
                    
                    return {
                        key: issue.key,
                        summary: issue.fields.summary,
                        priority: issue.fields.priority?.name || 'Medium',
                        customerPriority: customerPriority,
                        mgxPriority: mgxPriority,
                        status: issue.fields.status?.name || 'Open',
                        projectKey: issue.fields.project.key,
                        created: issue.fields.created,
                        updated: issue.fields.updated,
                        assignee: issue.fields.assignee?.displayName || null,
                        assigneeEmail: issue.fields.assignee?.emailAddress || null,
                        labels: issue.fields.labels || [],
                        components: issue.fields.components?.map(c => c.name) || [],
                        duedate: issue.fields.duedate || null,
                        resolution: issue.fields.resolution?.name || null
                    };
                });
            };
            
            // Use error handler with retry logic
            const tickets = await jiraErrorHandler.handleWithRetry(fetchOperation);
            
            // Cache the results
            this.cache.tickets = tickets;
            this.cache.lastFetch = Date.now();
            
            return tickets;
            
        } catch (error) {
            jiraErrorHandler.logError('fetchTickets', error);
            
            // Check if it's a JQL error
            if (error.response?.status === 400 && error.response?.data?.errorMessages) {
                console.error('JQL Error:', error.response.data.errorMessages.join(', '));
            }
            
            // Return mock data on error for graceful degradation
            const clients = await db.all('SELECT * FROM clients');
            const mockTickets = this.getMockTickets(clients);
            
            // Cache mock data as well to prevent repeated errors
            this.cache.tickets = mockTickets;
            this.cache.lastFetch = Date.now();
            
            return mockTickets;
        }
    }

    getMockTickets(clients) {
        const mockTickets = [
            { key: 'PROJ-123', summary: 'Critical server outage', priority: 'Highest', status: 'Open', projectKey: 'PROJ' },
            { key: 'PROJ-124', summary: 'Database connection timeout', priority: 'High', status: 'In Progress', projectKey: 'PROJ' },
            { key: 'WEB-456', summary: 'Login page not loading', priority: 'High', status: 'Open', projectKey: 'WEB' },
            { key: 'DATA-789', summary: 'Report generation failed', priority: 'Medium', status: 'Open', projectKey: 'DATA' },
        ];
        
        return mockTickets.filter(ticket => 
            clients.some(client => client.jiraProjectKey === ticket.projectKey)
        );
    }
    
    // Method to clear cache when configuration changes
    clearCache() {
        console.log('Clearing JIRA cache');
        this.cache.tickets = null;
        this.cache.lastFetch = null;
    }
}

// Initialize JIRA integration (will be set after database init)
let jira;

// Helper function to determine action based on global rules
async function determineAction(ticket, client) {
    const rules = await db.all('SELECT * FROM global_rules ORDER BY id');
    
    for (const rule of rules) {
        const matchesCA = rule.isCA === null || rule.isCA === client.isCA;
        const matchesTier = rule.tier === null || rule.tier === client.tier;
        const matchesMgxPriority = !rule.mgxPriority || rule.mgxPriority === ticket.mgxPriority;
        const matchesCustomerPriority = !rule.customerPriority || rule.customerPriority === ticket.customerPriority;
        
        if (matchesCA && matchesTier && matchesMgxPriority && matchesCustomerPriority) {
            return rule.action;
        }
    }
    
    return 'MONITOR'; // Default action
}

// API Routes

// Note: Tickets endpoints have been migrated to use local storage
// See routes/tickets-routes.js for the new implementation

// Clients API
app.get('/api/clients', async (req, res) => {
    try {
        const clients = await db.all('SELECT * FROM clients ORDER BY name');
        res.json(clients);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

app.post('/api/clients', async (req, res) => {
    try {
        const { name, jiraProjectKey, tier, isCA, isException, isGlobal } = req.body;
        await db.run(
            'INSERT INTO clients (name, jiraProjectKey, tier, isCA, isException, isGlobal) VALUES (?, ?, ?, ?, ?, ?)',
            name, jiraProjectKey, tier, isCA ? 1 : 0, isException ? 1 : 0, isGlobal ? 1 : 0
        );
        
        // Get the newly created client
        const newClient = await db.get(
            'SELECT * FROM clients WHERE name = ? AND jiraProjectKey = ?',
            name, jiraProjectKey
        );
        
        // Clear cache when client configuration changes
        jira.clearCache();
        
        res.json({ id: newClient.id, message: 'Client created successfully' });
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const { name, jiraProjectKey, tier, isCA, isException, isGlobal } = req.body;
        await db.run(
            'UPDATE clients SET name = ?, jiraProjectKey = ?, tier = ?, isCA = ?, isException = ?, isGlobal = ? WHERE id = ?',
            name, jiraProjectKey, tier, isCA ? 1 : 0, isException ? 1 : 0, isGlobal ? 1 : 0, req.params.id
        );
        // Clear cache when client configuration changes
        jira.clearCache();
        
        res.json({ message: 'Client updated successfully' });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM clients WHERE id = ?', req.params.id);
        // Clear cache when client configuration changes
        jira.clearCache();
        
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

// Clear all clients (for testing)
app.delete('/api/clients/clear', async (req, res) => {
    try {
        await db.run('DELETE FROM clients');
        res.json({ message: 'All clients cleared' });
    } catch (error) {
        console.error('Error clearing clients:', error);
        res.status(500).json({ error: 'Failed to clear clients' });
    }
});

// Global Rules API
app.get('/api/global-rules', async (req, res) => {
    try {
        const rules = await db.all('SELECT * FROM global_rules ORDER BY isCA, tier, mgxPriority, customerPriority');
        res.json(rules);
    } catch (error) {
        console.error('Error fetching global rules:', error);
        res.status(500).json({ error: 'Failed to fetch global rules' });
    }
});

app.post('/api/global-rules', async (req, res) => {
    try {
        const { isCA, tier, mgxPriority, customerPriority, action } = req.body;
        await db.run(
            'INSERT INTO global_rules (isCA, tier, mgxPriority, customerPriority, action) VALUES (?, ?, ?, ?, ?)',
            isCA ? 1 : 0, tier || null, mgxPriority || null, customerPriority || null, action
        );
        
        // Get the last inserted rule - use a simpler query for DuckDB
        const newRule = await db.get(
            'SELECT * FROM global_rules ORDER BY id DESC LIMIT 1'
        );
        
        res.json({ id: newRule.id, message: 'Rule created successfully' });
    } catch (error) {
        console.error('Error creating rule:', error);
        res.status(500).json({ error: 'Failed to create rule' });
    }
});

app.put('/api/global-rules/:id', async (req, res) => {
    try {
        const { isCA, tier, mgxPriority, customerPriority, action } = req.body;
        await db.run(
            'UPDATE global_rules SET isCA = ?, tier = ?, mgxPriority = ?, customerPriority = ?, action = ? WHERE id = ?',
            isCA ? 1 : 0, tier || null, mgxPriority || null, customerPriority || null, action, req.params.id
        );
        res.json({ message: 'Rule updated successfully' });
    } catch (error) {
        console.error('Error updating rule:', error);
        res.status(500).json({ error: 'Failed to update rule' });
    }
});

app.delete('/api/global-rules/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM global_rules WHERE id = ?', req.params.id);
        res.json({ message: 'Rule deleted successfully' });
    } catch (error) {
        console.error('Error deleting rule:', error);
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});

// Clear all rules (for testing)
app.delete('/api/global-rules/clear', async (req, res) => {
    try {
        await db.run('DELETE FROM global_rules');
        res.json({ message: 'All rules cleared' });
    } catch (error) {
        console.error('Error clearing rules:', error);
        res.status(500).json({ error: 'Failed to clear rules' });
    }
});

// Helper function to convert BigInt values in results
function cleanDuckDBResult(data) {
    if (Array.isArray(data)) {
        return data.map(cleanDuckDBResult);
    } else if (data && typeof data === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'bigint') {
                cleaned[key] = Number(value);
            } else if (value && typeof value === 'object' && value.micros !== undefined) {
                // Handle DuckDB timestamp objects - convert BigInt to Number first
                const microseconds = typeof value.micros === 'bigint' ? Number(value.micros) : value.micros;
                cleaned[key] = new Date(microseconds / 1000).toISOString();
            } else if (value && typeof value === 'object') {
                cleaned[key] = cleanDuckDBResult(value);
            } else {
                cleaned[key] = value;
            }
        }
        return cleaned;
    }
    return data;
}

// Dashboard API
app.get('/api/dashboards', async (req, res) => {
    try {
        const dashboards = await db.all('SELECT * FROM dashboards ORDER BY display_order');
        res.json(cleanDuckDBResult(dashboards) || []);
    } catch (error) {
        console.error('Error fetching dashboards:', error);
        console.error('SQL Error Details:', error.message);
        
        // Check if table exists - use proper DuckDB syntax
        try {
            const tableCheck = await db.get("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_name = 'dashboards'");
            if (!tableCheck) {
                console.error('Dashboards table does not exist!');
                // Return default dashboards if table doesn't exist
                return res.json([
                    { id: 1, name: 'Overview', is_default: 1, display_order: 1 },
                    { id: 2, name: 'My Active Work', is_default: 0, display_order: 2 },
                    { id: 3, name: 'Planning View', is_default: 0, display_order: 3 },
                    { id: 4, name: 'Backlog Grooming', is_default: 0, display_order: 4 }
                ]);
            }
        } catch (checkError) {
            console.error('Error checking table existence:', checkError);
            // If information_schema fails, try to query the table directly
            return res.json([]);
        }
        
        res.status(500).json({ error: 'Failed to fetch dashboards' });
    }
});

app.post('/api/dashboards', async (req, res) => {
    try {
        const { name, is_default } = req.body;
        const user_id = 'default'; // For now, using default user
        
        // Get max display order
        const maxOrder = await db.get('SELECT MAX(display_order) as max_order FROM dashboards');
        const display_order = (maxOrder?.max_order || 0) + 1;
        
        await db.run(
            'INSERT INTO dashboards (name, user_id, is_default, display_order) VALUES (?, ?, ?, ?)',
            name, user_id, is_default ? 1 : 0, display_order
        );
        
        // Get the inserted dashboard
        const newDashboard = await db.get(
            'SELECT * FROM dashboards WHERE name = ? AND user_id = ?',
            name, user_id
        );
        
        res.json({ id: newDashboard.id, message: 'Dashboard created successfully' });
    } catch (error) {
        console.error('Error creating dashboard:', error);
        res.status(500).json({ error: 'Failed to create dashboard' });
    }
});

app.put('/api/dashboards/:id', async (req, res) => {
    try {
        const { name, is_default } = req.body;
        const { id } = req.params;
        
        // If setting as default, unset other defaults first
        if (is_default) {
            await db.run('UPDATE dashboards SET is_default = 0 WHERE is_default = 1');
        }
        
        await db.run(
            'UPDATE dashboards SET name = ?, is_default = ? WHERE id = ?',
            name, is_default ? 1 : 0, id
        );
        
        res.json({ id, message: 'Dashboard updated successfully' });
    } catch (error) {
        console.error('Error updating dashboard:', error);
        res.status(500).json({ error: 'Failed to update dashboard' });
    }
});

app.delete('/api/dashboards/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM dashboards WHERE id = ?', req.params.id);
        res.json({ message: 'Dashboard deleted successfully' });
    } catch (error) {
        console.error('Error deleting dashboard:', error);
        res.status(500).json({ error: 'Failed to delete dashboard' });
    }
});

// Widgets API
app.get('/api/widgets', async (req, res) => {
    try {
        const { dashboard_id } = req.query;
        let widgets;
        
        if (dashboard_id) {
            widgets = await db.all(
                'SELECT * FROM user_widgets WHERE dashboard_id = ? ORDER BY position',
                dashboard_id
            );
        } else {
            widgets = await db.all('SELECT * FROM user_widgets ORDER BY position');
        }
        
        // Parse cardConfig for each widget
        widgets = widgets.map(widget => ({
            ...widget,
            cardConfig: widget.cardConfig ? JSON.parse(widget.cardConfig) : null
        }));
        
        res.json(widgets);
    } catch (error) {
        console.error('Error fetching widgets:', error);
        res.status(500).json({ error: 'Failed to fetch widgets' });
    }
});

app.post('/api/widgets', async (req, res) => {
    try {
        const { dashboard_id, title, type, filters, position, cardConfig, size } = req.body;
        const user_id = 'default';
        
        // Ensure filters is properly stringified (avoid double stringification)
        let filtersJson = filters;
        if (typeof filters !== 'string') {
            filtersJson = JSON.stringify(filters || []);
        }
        
        // Handle cardConfig
        let cardConfigJson = null;
        if (cardConfig) {
            cardConfigJson = typeof cardConfig === 'string' ? cardConfig : JSON.stringify(cardConfig);
        }
        
        await db.run(
            'INSERT INTO user_widgets (user_id, dashboard_id, title, type, filters, position, cardConfig, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            user_id, dashboard_id, title, type, filtersJson, position || 0, cardConfigJson, size || 'large'
        );
        
        // Get the newly created widget
        const newWidget = await db.get(
            'SELECT * FROM user_widgets WHERE user_id = ? AND dashboard_id = ? AND title = ? ORDER BY id DESC LIMIT 1',
            user_id, dashboard_id, title
        );
        
        res.json({ id: newWidget.id, message: 'Widget created successfully' });
    } catch (error) {
        console.error('Error creating widget:', error);
        res.status(500).json({ error: 'Failed to create widget' });
    }
});

app.put('/api/widgets/:id', async (req, res) => {
    try {
        const { title, type, filters, position, cardConfig, size } = req.body;
        
        // Ensure filters is properly stringified (avoid double stringification)
        let filtersJson = filters;
        if (typeof filters !== 'string') {
            filtersJson = JSON.stringify(filters || []);
        }
        
        // Handle cardConfig
        let cardConfigJson = null;
        if (cardConfig !== undefined) {
            cardConfigJson = cardConfig === null ? null : (typeof cardConfig === 'string' ? cardConfig : JSON.stringify(cardConfig));
        }
        
        await db.run(
            'UPDATE user_widgets SET title = ?, type = ?, filters = ?, position = ?, cardConfig = ?, size = ? WHERE id = ?',
            title, type, filtersJson, position, cardConfigJson, size || 'large', req.params.id
        );
        res.json({ message: 'Widget updated successfully' });
    } catch (error) {
        console.error('Error updating widget:', error);
        res.status(500).json({ error: 'Failed to update widget' });
    }
});

// Clear widgets for a specific dashboard or all widgets
// Note: This route must come before /api/widgets/:id to avoid route conflicts
app.delete('/api/widgets/clear', async (req, res) => {
    try {
        const { dashboard_id } = req.query;
        
        if (dashboard_id) {
            // Clear widgets for specific dashboard only
            await db.run('DELETE FROM user_widgets WHERE dashboard_id = ?', dashboard_id);
            res.json({ message: `Widgets cleared for dashboard ${dashboard_id}` });
        } else {
            // Clear all widgets (legacy behavior)
            await db.run('DELETE FROM user_widgets');
            res.json({ message: 'All widgets cleared' });
        }
    } catch (error) {
        console.error('Error clearing widgets:', error);
        res.status(500).json({ error: 'Failed to clear widgets' });
    }
});

app.delete('/api/widgets/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM user_widgets WHERE id = ?', req.params.id);
        res.json({ message: 'Widget deleted successfully' });
    } catch (error) {
        console.error('Error deleting widget:', error);
        res.status(500).json({ error: 'Failed to delete widget' });
    }
});

// JIRA Projects endpoint
app.get('/api/jira/projects', async (req, res) => {
    try {
        const projects = await jira.fetchProjects();
        res.json(projects);
    } catch (error) {
        // If error has our error handler format, use it
        if (error.error && error.type && error.message) {
            res.status(error.type === 'AUTHENTICATION_ERROR' ? 401 : 500).json(error);
        } else {
            // Fallback for unexpected errors
            const errorResponse = jiraErrorHandler.createErrorResponse(error);
            res.status(500).json(errorResponse);
        }
    }
});

// Ticket action override
app.put('/api/tickets/:key/action', async (req, res) => {
    try {
        const { action } = req.body;
        const ticket_key = req.params.key;
        
        // Check if override exists
        const existing = await db.get('SELECT * FROM ticket_actions WHERE ticket_key = ?', ticket_key);
        
        if (existing) {
            await db.run(
                'UPDATE ticket_actions SET action = ? WHERE ticket_key = ?',
                action, ticket_key
            );
        } else {
            await db.run(
                'INSERT INTO ticket_actions (ticket_key, action) VALUES (?, ?)',
                ticket_key, action
            );
        }
        
        res.json({ message: 'Ticket action updated successfully' });
    } catch (error) {
        console.error('Error updating ticket action:', error);
        res.status(500).json({ error: 'Failed to update ticket action' });
    }
});

// Import configuration
app.get('/api/import-config', async (req, res) => {
    try {
        const config = await db.get('SELECT * FROM import_config WHERE id = 1');
        res.json(config || { excluded_projects: '[]', date_offset_days: 30 });
    } catch (error) {
        console.error('Error fetching import config:', error);
        res.status(500).json({ error: 'Failed to fetch import config' });
    }
});

app.put('/api/import-config', async (req, res) => {
    try {
        const { excluded_projects, date_offset_days, selected_ticket_types, selected_ticket_statuses } = req.body;
        
        const existing = await db.get('SELECT * FROM import_config WHERE id = 1');
        
        if (existing) {
            await db.run(
                'UPDATE import_config SET excluded_projects = ?, date_offset_days = ?, selected_ticket_types = ?, selected_ticket_statuses = ? WHERE id = 1',
                JSON.stringify(excluded_projects || []), 
                date_offset_days || 30,
                JSON.stringify(selected_ticket_types || []),
                JSON.stringify(selected_ticket_statuses || [])
            );
        } else {
            await db.run(
                'INSERT INTO import_config (excluded_projects, date_offset_days, selected_ticket_types, selected_ticket_statuses) VALUES (?, ?, ?, ?)',
                JSON.stringify(excluded_projects || []), 
                date_offset_days || 30,
                JSON.stringify(selected_ticket_types || []),
                JSON.stringify(selected_ticket_statuses || [])
            );
        }
        
        // Clear cache when configuration changes
        jira.clearCache();
        
        res.json({ message: 'Import configuration updated successfully' });
    } catch (error) {
        console.error('Error updating import config:', error);
        res.status(500).json({ error: 'Failed to update import config' });
    }
});

// JIRA Metadata endpoint - returns available ticket types and statuses
app.get('/api/jira/metadata', async (req, res) => {
    try {
        // In a real implementation, these would be fetched from JIRA
        // For now, return common types and statuses
        const metadata = {
            ticketTypes: ['Bug', 'Task', 'Story', 'Epic', 'Sub-task', 'Improvement', 'New Feature'],
            ticketStatuses: ['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened', 'Done', 'To Do', 'In Review']
        };
        res.json(metadata);
    } catch (error) {
        console.error('Error fetching JIRA metadata:', error);
        res.status(500).json({ error: 'Failed to fetch JIRA metadata' });
    }
});

// JIRA Configuration endpoints
app.get('/api/jira/config', async (req, res) => {
    try {
        if (!jiraConfigService) {
            console.error('JIRA config service not initialized');
            return res.status(503).json({ error: 'Service initializing, please try again' });
        }
        const config = await jiraConfigService.getConfig();
        const cleanedConfig = config ? cleanDuckDBResult(config) : null;
        res.json({
            configured: !!cleanedConfig,
            ...cleanedConfig
        });
    } catch (error) {
        console.error('Error getting JIRA config:', error);
        res.status(500).json({ error: 'Failed to get JIRA configuration' });
    }
});

app.post('/api/jira/config', async (req, res) => {
    try {
        const { baseUrl, email, apiToken } = req.body;
        
        if (!baseUrl || !email || !apiToken) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        await jiraConfigService.saveConfig({ baseUrl, email, apiToken });
        res.json({ success: true, message: 'Configuration saved successfully' });
    } catch (error) {
        console.error('Error saving JIRA config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

app.post('/api/jira/test', async (req, res) => {
    try {
        const result = await jiraConfigService.testConnection();
        res.json(result);
    } catch (error) {
        console.error('Error testing JIRA connection:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to test connection',
            details: error.message 
        });
    }
});

// Legacy endpoint for backward compatibility
app.get('/api/jira/credentials-status', async (req, res) => {
    try {
        const config = await jiraConfigService.getConfig();
        const cleanedConfig = config ? cleanDuckDBResult(config) : null;
        res.json({
            isConfigured: !!cleanedConfig,
            jiraBaseUrl: cleanedConfig?.baseUrl || '',
            jiraEmail: cleanedConfig?.email || ''
        });
    } catch (error) {
        console.error('Error checking JIRA credentials:', error);
        res.status(500).json({ error: 'Failed to check JIRA credentials' });
    }
});

// Legacy endpoint - redirect to new config endpoint
app.put('/api/jira/credentials', async (req, res) => {
    // Forward to new endpoint
    req.url = '/api/jira/config';
    req.method = 'POST';
    
    const { jiraBaseUrl, jiraEmail, jiraApiToken } = req.body;
    req.body = {
        baseUrl: jiraBaseUrl,
        email: jiraEmail,
        apiToken: jiraApiToken
    };
    
    return app.handle(req, res);
});

// Test connection endpoint
app.post('/api/jira/test-connection', async (req, res) => {
    try {
        const { baseUrl, email, apiToken } = req.body;
        
        if (!baseUrl || !email || !apiToken) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: 'baseUrl, email, and apiToken are required'
            });
        }

        // Test the connection
        const response = await axios.get(`${baseUrl}/rest/api/2/myself`, {
            auth: {
                username: email,
                password: apiToken
            },
            timeout: 10000
        });

        res.json({ 
            success: true, 
            user: response.data.displayName || response.data.name,
            message: 'Connection successful'
        });
    } catch (error) {
        logger.error('JIRA connection test failed', { error, body: req.body });
        res.status(400).json({ 
            error: 'Connection failed',
            details: error.response?.data?.errorMessages?.[0] || error.message
        });
    }
});

// Legacy test connection endpoint - redirect to new endpoint
app.get('/api/jira/test-connection', async (req, res) => {
    // Forward to new endpoint
    req.url = '/api/jira/test';
    req.method = 'POST';
    return app.handle(req, res);
});

// Debug endpoint to check field mappings
app.get('/api/jira/debug-fields', async (req, res) => {
    try {
        // Check if JIRA is configured
        const hasValidCredentials = !!(
            process.env.JIRA_BASE_URL && 
            process.env.JIRA_EMAIL && 
            process.env.JIRA_API_TOKEN &&
            !process.env.JIRA_BASE_URL.includes('your-domain') &&
            !process.env.JIRA_EMAIL.includes('your-email') &&
            !process.env.JIRA_API_TOKEN.includes('your-api-token')
        );
        
        if (!hasValidCredentials) {
            return res.json({
                configured: false,
                message: 'JIRA credentials not configured'
            });
        }
        
        // Get field mappings
        const fieldMapping = await jira.fieldMapper.getFieldMapping();
        
        // Get a sample ticket to show field values
        const sampleTicket = await jira.fetchTickets();
        const firstTicket = sampleTicket[0];
        
        res.json({
            configured: true,
            fieldMapping: fieldMapping,
            sampleTicket: firstTicket ? {
                key: firstTicket.key,
                priority: firstTicket.priority,
                customerPriority: firstTicket.customerPriority,
                mgxPriority: firstTicket.mgxPriority,
                rawCustomerPriorityField: fieldMapping.customerPriority,
                rawMgxPriorityField: fieldMapping.mgxPriority
            } : null,
            message: 'Field mapping debug information'
        });
    } catch (error) {
        console.error('Field debug error:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack 
        });
    }
});

// Data Export endpoint
app.get('/api/data/export', async (req, res) => {
    try {
        // Gather all configuration data
        const exportData = {
            version: '1.0',
            exported: new Date().toISOString(),
            application: 'Tiergarten',
            data: {
                clients: await db.all('SELECT * FROM clients'),
                globalRules: await db.all('SELECT * FROM global_rules'),
                dashboards: await db.all('SELECT * FROM dashboards'),
                widgets: await db.all('SELECT * FROM user_widgets'),
                importConfig: await db.get('SELECT * FROM import_config WHERE id = 1')
            }
        };
        
        // Set headers for file download
        const filename = `tiergarten-export-${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Send formatted JSON
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Import Tickets endpoint - Start a new import
app.post('/api/jira/import-tickets', async (req, res) => {
    try {
        const { projectKeys, options } = req.body;
        
        if (!projectKeys || !Array.isArray(projectKeys) || projectKeys.length === 0) {
            return res.status(400).json({ error: 'Project keys are required' });
        }
        
        const result = await jiraImportService.startImport(projectKeys, options);
        res.json(result);
    } catch (error) {
        console.error('Error starting import:', error);
        res.status(500).json({ error: error.message || 'Failed to start import' });
    }
});

// Get import status
app.get('/api/jira/import/:importId', async (req, res) => {
    try {
        const status = await jiraImportService.getImportStatus(req.params.importId);
        
        if (!status) {
            return res.status(404).json({ error: 'Import not found' });
        }
        
        const cleanedStatus = cleanDuckDBResult(status);
        res.json(cleanedStatus);
    } catch (error) {
        console.error('Error getting import status:', error);
        res.status(500).json({ error: 'Failed to get import status' });
    }
});

// Get import history
app.get('/api/jira/imports', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const history = await jiraImportService.getImportHistory(limit);
        const cleanedHistory = history.map(item => cleanDuckDBResult(item));
        res.json(cleanedHistory);
    } catch (error) {
        console.error('Error getting import history:', error);
        res.status(500).json({ error: 'Failed to get import history' });
    }
});

// Cancel an import
app.post('/api/jira/import/:importId/cancel', async (req, res) => {
    try {
        const result = await jiraImportService.cancelImport(req.params.importId);
        res.json(result);
    } catch (error) {
        console.error('Error cancelling import:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel import' });
    }
});

// Import progress SSE endpoint
app.get('/api/jira/import/:importId/progress', (req, res) => {
    const { importId } = req.params;
    
    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    
    // Send initial status
    jiraImportService.getImportStatus(importId).then(status => {
        if (status) {
            const cleanedStatus = cleanDuckDBResult(status);
            res.write(`data: ${JSON.stringify(cleanedStatus)}\n\n`);
        }
    });
    
    // Listen for progress updates
    const progressHandler = (data) => {
        if (data.importId === importId) {
            const cleanedData = cleanDuckDBResult(data);
            res.write(`data: ${JSON.stringify(cleanedData)}\n\n`);
        }
    };
    
    jiraImportService.on('progress', progressHandler);
    
    // Clean up on disconnect
    req.on('close', () => {
        jiraImportService.off('progress', progressHandler);
    });
});

// ===== JIRA Config 2 API Endpoints =====

// List all configurations
app.get('/api/jira/config2', async (req, res) => {
    try {
        const configs = await global.jiraConfig2Service.listConfigs();
        res.json(configs);
    } catch (error) {
        console.error('Error listing configs:', error);
        res.status(500).json({ error: 'Failed to list configurations' });
    }
});

// Get specific configuration
app.get('/api/jira/config2/:id', async (req, res) => {
    try {
        const config = await global.jiraConfig2Service.getConfig(req.params.id);
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        res.json(config);
    } catch (error) {
        console.error('Error getting config:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
    }
});

// Create new configuration
app.post('/api/jira/config2', validateRequest(schemas.createJiraConfig2), async (req, res) => {
    try {
        const result = await global.jiraConfig2Service.createConfig(req.body);
        res.json(result);
    } catch (error) {
        handleApiError(res, error, 'createJiraConfig2');
    }
});

// Update configuration
app.put('/api/jira/config2/:id', async (req, res) => {
    try {
        const result = await global.jiraConfig2Service.updateConfig(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// Set active configuration
app.post('/api/jira/config2/:id/activate', async (req, res) => {
    try {
        const result = await global.jiraConfig2Service.setActiveConfig(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error activating config:', error);
        res.status(500).json({ error: 'Failed to activate configuration' });
    }
});

// Get active configuration
app.get('/api/jira/config2/active', async (req, res) => {
    try {
        const config = await global.jiraConfig2Service.getActiveConfig();
        res.json({ active: config });
    } catch (error) {
        console.error('Error getting active config:', error);
        res.status(500).json({ error: 'Failed to get active configuration' });
    }
});

// Discover JIRA fields
app.get('/api/jira/config2/:id/discover-fields', async (req, res) => {
    try {
        const fields = await global.jiraConfig2Service.discoverJiraFields(req.params.id);
        res.json(fields);
    } catch (error) {
        console.error('Error discovering fields:', error);
        res.status(500).json({ error: 'Failed to discover JIRA fields' });
    }
});

// Get field values (for filters)
app.get('/api/jira/config2/:id/field-values/:fieldId', async (req, res) => {
    try {
        const result = await global.jiraConfig2Service.getFieldValues(req.params.id, req.params.fieldId);
        res.json(result);
    } catch (error) {
        console.error('Error getting field values:', error);
        res.status(500).json({ error: 'Failed to get field values' });
    }
});

// Get field mappings
app.get('/api/jira/config2/:id/field-mappings', async (req, res) => {
    try {
        const mappings = await global.jiraConfig2Service.getFieldMappings(req.params.id);
        res.json(mappings);
    } catch (error) {
        console.error('Error getting field mappings:', error);
        res.status(500).json({ error: 'Failed to get field mappings' });
    }
});

// Save field mapping
app.post('/api/jira/config2/:id/field-mappings', async (req, res) => {
    try {
        const result = await global.jiraConfig2Service.saveFieldMapping(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Error saving field mapping:', error);
        res.status(500).json({ error: 'Failed to save field mapping' });
    }
});

// Get filter presets
app.get('/api/jira/filter-presets', async (req, res) => {
    try {
        const presets = await global.jiraConfig2Service.getFilterPresets();
        res.json(presets);
    } catch (error) {
        console.error('Error getting filter presets:', error);
        res.status(500).json({ error: 'Failed to get filter presets' });
    }
});

// Save filter preset
app.post('/api/jira/filter-presets', async (req, res) => {
    try {
        const result = await global.jiraConfig2Service.saveFilterPreset(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error saving filter preset:', error);
        res.status(500).json({ error: 'Failed to save filter preset' });
    }
});

// Start import with Config 2
app.post('/api/jira/config2/:id/import', validateRequest(schemas.startJiraImport), async (req, res) => {
    try {
        const { projects, options } = req.body;
        const result = await global.jiraImport2Service.startImport(req.params.id, projects, options);
        res.json(result);
    } catch (error) {
        console.error('Error starting import:', error);
        res.status(500).json({ error: 'Failed to start import' });
    }
});

// Get import history for config
app.get('/api/jira/config2/:id/imports', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const imports = await global.jiraConfig2Service.getImportHistory(req.params.id, limit);
        res.json(imports);
    } catch (error) {
        console.error('Error getting import history:', error);
        res.status(500).json({ error: 'Failed to get import history' });
    }
});

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../build')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../build', 'index.html'));
    });
}

// Add error handler middleware at the end
app.use(logger.errorHandler());

// Start server
const PORT = process.env.PORT || 3600;

initDatabase().then(() => {
    // Mount sync routes after services are initialized
    const { initializeSyncRoutes } = require('./routes/sync-routes');
    app.use('/api/sync', initializeSyncRoutes(jiraSyncOrchestrator));
    
    // Mount tickets routes (migrated to use local storage)
    const { initializeTicketsRoutes } = require('./routes/tickets-routes');
    app.use('/api/tickets', initializeTicketsRoutes(db, jiraSyncOrchestrator));
    
    const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Database location: ${path.join(__dirname, 'database', 'tiergarten.duckdb')}`);
    });
    
    // Increase header size limit
    server.maxHeaderSize = 16384; // 16KB
    server.headersTimeout = 60000; // 60 seconds
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});