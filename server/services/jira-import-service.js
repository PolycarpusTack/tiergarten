const EventEmitter = require('events');
const axios = require('axios');

class JiraImportService extends EventEmitter {
    constructor(db, jiraConfigService) {
        super();
        this.db = db;
        this.jiraConfigService = jiraConfigService;
        this.activeImports = new Map();
    }

    // Start a new import
    async startImport(projectKeys, options = {}) {
        const importId = Date.now().toString();
        const credentials = await this.jiraConfigService.getCredentials();
        
        if (!credentials) {
            throw new Error('JIRA credentials not configured');
        }

        // Create import record
        await this.db.run(
            `INSERT INTO jira_imports (id, status, project_keys, total_projects, processed_projects, 
                                     total_tickets, processed_tickets, started_at)
             VALUES (?, 'running', ?, ?, 0, 0, 0, CURRENT_TIMESTAMP)`,
            importId, projectKeys.join(','), projectKeys.length
        );

        // Create import state
        const importState = {
            id: importId,
            projectKeys,
            credentials,
            options,
            status: 'running',
            progress: {
                totalProjects: projectKeys.length,
                processedProjects: 0,
                totalTickets: 0,
                processedTickets: 0,
                currentProject: null,
                errors: []
            }
        };

        this.activeImports.set(importId, importState);

        // Start async import process
        this.processImport(importState).catch(error => {
            console.error('Import failed:', error);
            this.updateImportStatus(importId, 'failed', error.message);
        });

        return { importId, status: 'started' };
    }

    // Process the import asynchronously
    async processImport(importState) {
        const { id, projectKeys, credentials } = importState;

        try {
            for (let i = 0; i < projectKeys.length; i++) {
                const projectKey = projectKeys[i];
                importState.progress.currentProject = projectKey;
                
                // Import tickets for this project
                await this.importProjectTickets(importState, projectKey);
                
                // Update progress
                importState.progress.processedProjects++;
                await this.updateImportProgress(id, importState.progress);
                
                // Emit progress event
                this.emit('progress', {
                    importId: id,
                    progress: importState.progress
                });
            }

            // Mark import as completed
            await this.updateImportStatus(id, 'completed');
            this.activeImports.delete(id);
            
            // Update last import timestamp
            await this.jiraConfigService.updateLastImport();
            
        } catch (error) {
            importState.progress.errors.push({
                timestamp: new Date().toISOString(),
                message: error.message,
                project: importState.progress.currentProject
            });
            
            await this.updateImportStatus(id, 'failed', error.message);
            this.activeImports.delete(id);
            throw error;
        }
    }

    // Import tickets for a single project
    async importProjectTickets(importState, projectKey) {
        const { credentials } = importState;
        let startAt = 0;
        const maxResults = 50;
        let totalIssues = 0;

        do {
            try {
                // Fetch tickets from JIRA
                const response = await axios.get(
                    `${credentials.baseUrl}/rest/api/2/search`,
                    {
                        params: {
                            jql: `project="${projectKey}" ORDER BY created DESC`,
                            startAt,
                            maxResults,
                            fields: 'key,summary,status,priority,created,updated,assignee,reporter,components,labels,issuetype'
                        },
                        auth: {
                            username: credentials.email,
                            password: credentials.apiToken
                        },
                        timeout: 30000
                    }
                );

                const { issues, total } = response.data;
                totalIssues = total;

                // Update total tickets count on first page
                if (startAt === 0) {
                    importState.progress.totalTickets += total;
                }

                // Process each ticket
                for (const issue of issues) {
                    await this.processTicket(projectKey, issue);
                    importState.progress.processedTickets++;
                    
                    // Emit progress every 10 tickets
                    if (importState.progress.processedTickets % 10 === 0) {
                        this.emit('progress', {
                            importId: importState.id,
                            progress: importState.progress
                        });
                    }
                }

                startAt += maxResults;
                
            } catch (error) {
                console.error(`Error importing project ${projectKey}:`, error.message);
                importState.progress.errors.push({
                    timestamp: new Date().toISOString(),
                    message: `Failed to import tickets from ${projectKey}: ${error.message}`,
                    project: projectKey
                });
                throw error;
            }
        } while (startAt < totalIssues);
    }

    // Process a single ticket
    async processTicket(projectKey, issue) {
        try {
            // Check if client exists, create if not
            let client = await this.db.get('SELECT * FROM clients WHERE jiraProjectKey = ?', projectKey);
            
            if (!client) {
                // Create client with default tier
                await this.db.run(
                    'INSERT INTO clients (name, jiraProjectKey, tier, isCA, isException) VALUES (?, ?, 2, 0, 0)',
                    projectKey, projectKey
                );
                client = await this.db.get('SELECT * FROM clients WHERE jiraProjectKey = ?', projectKey);
            }

            // Map JIRA priority to our system
            const priorityMap = {
                'Highest': 'P1',
                'High': 'P2',
                'Medium': 'P3',
                'Low': 'P4',
                'Lowest': 'P4'
            };

            const priority = priorityMap[issue.fields.priority?.name] || 'P3';
            
            // Store ticket data (we'll just log for now, in real implementation would update database)
            console.log(`Imported ticket ${issue.key}: ${issue.fields.summary} (${priority})`);
            
        } catch (error) {
            console.error(`Error processing ticket ${issue.key}:`, error);
            throw error;
        }
    }

    // Update import progress in database
    async updateImportProgress(importId, progress) {
        await this.db.run(
            `UPDATE jira_imports 
             SET processed_projects = ?, total_tickets = ?, processed_tickets = ?, current_project = ?
             WHERE id = ?`,
            progress.processedProjects, progress.totalTickets, progress.processedTickets, 
            progress.currentProject, importId
        );
    }

    // Update import status
    async updateImportStatus(importId, status, errorMessage = null) {
        await this.db.run(
            `UPDATE jira_imports 
             SET status = ?, error_message = ?, completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id = ?`,
            status, errorMessage, status, importId
        );
    }

    // Get import status
    async getImportStatus(importId) {
        const dbImport = await this.db.get('SELECT * FROM jira_imports WHERE id = ?', importId);
        
        if (!dbImport) {
            return null;
        }

        // If import is active, get live progress
        const activeImport = this.activeImports.get(importId);
        if (activeImport) {
            return {
                id: importId,
                status: activeImport.status,
                progress: activeImport.progress,
                startedAt: dbImport.started_at,
                projectKeys: dbImport.project_keys.split(',')
            };
        }

        // Return database record
        return {
            id: dbImport.id,
            status: dbImport.status,
            progress: {
                totalProjects: dbImport.total_projects,
                processedProjects: dbImport.processed_projects,
                totalTickets: dbImport.total_tickets,
                processedTickets: dbImport.processed_tickets,
                currentProject: dbImport.current_project,
                errors: []
            },
            startedAt: dbImport.started_at,
            completedAt: dbImport.completed_at,
            errorMessage: dbImport.error_message,
            projectKeys: dbImport.project_keys.split(',')
        };
    }

    // Get import history
    async getImportHistory(limit = 10) {
        const imports = await this.db.all(
            `SELECT * FROM jira_imports 
             ORDER BY started_at DESC 
             LIMIT ?`,
            limit
        );

        return imports.map(imp => ({
            id: imp.id,
            status: imp.status,
            projectKeys: imp.project_keys.split(','),
            totalProjects: imp.total_projects,
            processedProjects: imp.processed_projects,
            totalTickets: imp.total_tickets,
            processedTickets: imp.processed_tickets,
            startedAt: imp.started_at,
            completedAt: imp.completed_at,
            errorMessage: imp.error_message
        }));
    }

    // Cancel an active import
    async cancelImport(importId) {
        const activeImport = this.activeImports.get(importId);
        
        if (!activeImport) {
            throw new Error('Import not found or already completed');
        }

        activeImport.status = 'cancelled';
        await this.updateImportStatus(importId, 'cancelled');
        this.activeImports.delete(importId);
        
        return { success: true };
    }
}

module.exports = JiraImportService;