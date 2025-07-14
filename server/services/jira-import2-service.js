const EventEmitter = require('events');
const axios = require('axios');

class JiraImport2Service extends EventEmitter {
    constructor(db, jiraConfig2Service) {
        super();
        this.db = db;
        this.jiraConfig2Service = jiraConfig2Service;
        this.activeImports = new Map();
    }

    // Start a new import with enhanced configuration
    async startImport(configId, projectsWithNames, options = {}) {
        const importId = Date.now().toString();
        
        try {
            // Get configuration
            const config = await this.jiraConfig2Service.getConfig(configId);
            if (!config) {
                throw new Error('Configuration not found');
            }

            const { baseUrl, email, apiToken } = config.connection_settings;
            
            // Record import start
            await this.jiraConfig2Service.recordImportStart(configId, importId);

            // Create import state with full project information
            const importState = {
                id: importId,
                configId,
                projects: projectsWithNames, // Array of {key, name} objects
                credentials: { baseUrl, email, apiToken },
                config,
                options,
                status: 'running',
                progress: {
                    totalProjects: projectsWithNames.length,
                    processedProjects: 0,
                    totalTickets: 0,
                    processedTickets: 0,
                    createdClients: 0,
                    updatedClients: 0,
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
        } catch (error) {
            console.error('Error starting import:', error);
            throw error;
        }
    }

    // Process the import with enhanced field mapping
    async processImport(importState) {
        const { id, projects, config, configId } = importState;
        this.currentImportId = id;

        try {
            // Get field mappings for this configuration
            const fieldMappings = await this.jiraConfig2Service.getFieldMappings(configId);
            
            for (let i = 0; i < projects.length; i++) {
                const project = projects[i];
                importState.progress.currentProject = project.key;
                
                // Import tickets for this project
                await this.importProjectTickets(importState, project, fieldMappings);
                
                // Update progress
                importState.progress.processedProjects++;
                await this.updateImportProgress(id, importState.progress);
                
                // Emit progress event
                this.emit('progress', {
                    importId: id,
                    progress: importState.progress
                });
            }

            // Update final statistics
            const statistics = {
                totalTickets: importState.progress.totalTickets,
                processedTickets: importState.progress.processedTickets,
                createdClients: importState.progress.createdClients,
                updatedClients: importState.progress.updatedClients,
                projects: projects.map(p => p.key)
            };

            await this.jiraConfig2Service.updateImportStatus(id, 'completed', statistics, importState.progress.errors);
            this.activeImports.delete(id);
            
        } catch (error) {
            importState.progress.errors.push({
                timestamp: new Date().toISOString(),
                message: error.message,
                project: importState.progress.currentProject
            });
            
            await this.jiraConfig2Service.updateImportStatus(id, 'failed', null, importState.progress.errors);
            this.activeImports.delete(id);
            throw error;
        }
    }

    // Import tickets for a single project with field mapping
    async importProjectTickets(importState, project, fieldMappings) {
        const { credentials, config } = importState;
        const { filterSettings } = config;
        
        let startAt = 0;
        const maxResults = 50;
        let totalIssues = 0;

        // Build JQL query from filter settings
        const jql = this.buildJQLQuery(project.key, filterSettings);

        do {
            try {
                // Build field list from mappings
                const fields = this.buildFieldsList(fieldMappings);
                
                // Fetch tickets from JIRA
                const response = await axios.get(
                    `${credentials.baseUrl}/rest/api/2/search`,
                    {
                        params: {
                            jql,
                            startAt,
                            maxResults,
                            fields: fields.join(',')
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
                    await this.processTicket(project, issue, fieldMappings, importState);
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
                console.error(`Error importing project ${project.key}:`, error.message);
                importState.progress.errors.push({
                    timestamp: new Date().toISOString(),
                    message: `Failed to import tickets from ${project.key}: ${error.message}`,
                    project: project.key
                });
                throw error;
            }
        } while (startAt < totalIssues);
    }

    // Build JQL query from filter settings
    buildJQLQuery(projectKey, filterSettings) {
        const parts = [`project="${projectKey}"`];
        
        // Date range
        if (filterSettings.dateRange) {
            const { type, value, customStart, customEnd } = filterSettings.dateRange;
            switch (type) {
                case 'days':
                    parts.push(`created >= -${value}d`);
                    break;
                case 'months':
                    parts.push(`created >= -${value * 30}d`);
                    break;
                case 'custom':
                    if (customStart) parts.push(`created >= "${customStart}"`);
                    if (customEnd) parts.push(`created <= "${customEnd}"`);
                    break;
                // 'all' - no date filter
            }
        }

        // Ticket types
        if (filterSettings.ticketTypes && filterSettings.ticketTypes.length > 0) {
            const types = filterSettings.ticketTypes.map(t => `"${t}"`).join(',');
            parts.push(`issuetype in (${types})`);
        }

        // Ticket statuses
        if (filterSettings.ticketStatuses && filterSettings.ticketStatuses.length > 0) {
            const statuses = filterSettings.ticketStatuses.map(s => `"${s}"`).join(',');
            parts.push(`status in (${statuses})`);
        }

        // Priority levels
        if (filterSettings.priorities && filterSettings.priorities.length > 0) {
            const priorities = filterSettings.priorities.map(p => `"${p}"`).join(',');
            parts.push(`priority in (${priorities})`);
        }

        // Additional filters
        if (filterSettings.additionalFilters) {
            if (filterSettings.additionalFilters.onlyUnassigned) {
                parts.push('assignee is EMPTY');
            }
            if (filterSettings.additionalFilters.hasAttachments) {
                parts.push('attachments is not EMPTY');
            }
            if (filterSettings.additionalFilters.hasComments) {
                parts.push('comment ~ "*"');
            }
            if (filterSettings.additionalFilters.recentlyUpdated) {
                parts.push('updated >= -7d');
            }
        }

        // Custom JQL
        if (filterSettings.customJQL) {
            parts.push(`(${filterSettings.customJQL})`);
        }

        return parts.join(' AND ') + ' ORDER BY created DESC';
    }

    // Build fields list from mappings
    buildFieldsList(fieldMappings) {
        const fields = new Set(['key', 'summary', 'created', 'updated']);
        
        fieldMappings.forEach(mapping => {
            if (mapping.is_enabled) {
                fields.add(mapping.jira_field_id);
            }
        });

        return Array.from(fields);
    }

    // Process a single ticket with enhanced field mapping
    async processTicket(project, issue, fieldMappings, importState) {
        try {
            // Check if client exists, create/update with proper name
            let client = await this.db.get('SELECT * FROM clients WHERE jiraProjectKey = ?', project.key);
            
            if (!client) {
                // Create client with the actual project name
                await this.db.run(
                    'INSERT INTO clients (name, jiraProjectKey, tier, isCA, isException) VALUES (?, ?, 2, 0, 0)',
                    project.name, // Use the actual project name
                    project.key   // Use the key for jiraProjectKey
                );
                client = await this.db.get('SELECT * FROM clients WHERE jiraProjectKey = ?', project.key);
                importState.progress.createdClients++;
            } else if (client.name === project.key && client.name !== project.name) {
                // Update client name if it was previously set to the key
                await this.db.run(
                    'UPDATE clients SET name = ? WHERE id = ?',
                    project.name,
                    client.id
                );
                importState.progress.updatedClients++;
            }

            // Map fields according to configuration
            const mappedData = this.mapFields(issue, fieldMappings);
            
            // Store ticket data
            await this.storeTicket(client.id, issue.key, mappedData);
            
            console.log(`Imported ticket ${issue.key}: ${issue.fields.summary}`);
            
        } catch (error) {
            console.error(`Error processing ticket ${issue.key}:`, error);
            throw error;
        }
    }

    // Map JIRA fields to Tiergarten fields
    mapFields(issue, fieldMappings) {
        const mapped = {
            key: issue.key,
            summary: issue.fields.summary,
            created: issue.fields.created,
            updated: issue.fields.updated,
            // Standard fields
            description: issue.fields.description,
            status: issue.fields.status?.name,
            priority: issue.fields.priority?.name,
            ticket_type: issue.fields.issuetype?.name,
            assignee: issue.fields.assignee?.displayName || issue.fields.assignee?.emailAddress,
            reporter: issue.fields.reporter?.displayName || issue.fields.reporter?.emailAddress,
            components: issue.fields.components?.map(c => c.name) || [],
            labels: issue.fields.labels || []
        };

        // Apply custom field mappings
        fieldMappings.forEach(mapping => {
            if (!mapping.is_enabled) return;
            
            const value = this.getFieldValue(issue.fields, mapping.jira_field_id);
            if (value === undefined) return;

            // Apply transformation if needed
            const transformedValue = this.applyTransform(value, mapping);
            
            // Store in mapped data
            mapped[mapping.tiergarten_field] = transformedValue;
        });

        return mapped;
    }

    // Get field value from JIRA issue
    getFieldValue(fields, fieldId) {
        // Handle nested field access (e.g., "priority.name")
        const parts = fieldId.split('.');
        let value = fields;
        
        for (const part of parts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    // Apply field transformation
    applyTransform(value, mapping) {
        if (mapping.mapping_type === 'direct') {
            return value;
        }

        const rules = mapping.transform_rules || {};
        
        switch (mapping.mapping_type) {
            case 'transform':
                // Value mapping (e.g., priority names to P1-P4)
                if (rules.valueMap && rules.valueMap[value]) {
                    return rules.valueMap[value];
                }
                break;
                
            case 'custom':
                // Custom transformation logic
                if (rules.type === 'array_to_string' && Array.isArray(value)) {
                    return value.map(v => v.name || v.value || v).join(', ');
                }
                if (rules.type === 'extract_field' && value && typeof value === 'object') {
                    return value[rules.field] || value.name || value.value;
                }
                break;
        }
        
        return value;
    }

    // Store ticket data
    async storeTicket(clientId, ticketKey, ticketData) {
        try {
            // Check if ticket exists
            const existing = await this.db.get(
                'SELECT id FROM jira_tickets WHERE ticket_key = ?',
                ticketKey
            );

            const customFields = {};
            const standardFields = [
                'key', 'summary', 'created', 'updated', 'status', 'priority',
                'ticket_type', 'assignee', 'reporter', 'description',
                'components', 'labels'
            ];

            // Separate custom fields from standard fields
            Object.keys(ticketData).forEach(key => {
                if (!standardFields.includes(key)) {
                    customFields[key] = ticketData[key];
                }
            });

            if (existing) {
                // Update existing ticket
                await this.db.run(
                    `UPDATE jira_tickets SET
                        summary = ?,
                        description = ?,
                        status = ?,
                        priority = ?,
                        ticket_type = ?,
                        assignee = ?,
                        reporter = ?,
                        jira_created = ?,
                        jira_updated = ?,
                        custom_fields = ?,
                        components = ?,
                        labels = ?,
                        last_synced = CURRENT_TIMESTAMP
                    WHERE id = ?`,
                    ticketData.summary,
                    ticketData.description || null,
                    ticketData.status || null,
                    ticketData.priority || null,
                    ticketData.ticket_type || null,
                    ticketData.assignee || null,
                    ticketData.reporter || null,
                    ticketData.created,
                    ticketData.updated,
                    JSON.stringify(customFields),
                    JSON.stringify(ticketData.components || []),
                    JSON.stringify(ticketData.labels || []),
                    existing.id
                );
            } else {
                // Insert new ticket
                await this.db.run(
                    `INSERT INTO jira_tickets (
                        ticket_key, client_id, summary, description, status, priority,
                        ticket_type, assignee, reporter, jira_created, jira_updated,
                        custom_fields, components, labels, import_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    ticketKey,
                    clientId,
                    ticketData.summary,
                    ticketData.description || null,
                    ticketData.status || null,
                    ticketData.priority || null,
                    ticketData.ticket_type || null,
                    ticketData.assignee || null,
                    ticketData.reporter || null,
                    ticketData.created,
                    ticketData.updated,
                    JSON.stringify(customFields),
                    JSON.stringify(ticketData.components || []),
                    JSON.stringify(ticketData.labels || []),
                    this.currentImportId
                );
            }
        } catch (error) {
            console.error(`Error storing ticket ${ticketKey}:`, error);
            throw error;
        }
    }

    // Update import progress in database
    async updateImportProgress(importId, progress) {
        const statistics = {
            processedProjects: progress.processedProjects,
            totalTickets: progress.totalTickets,
            processedTickets: progress.processedTickets,
            currentProject: progress.currentProject,
            createdClients: progress.createdClients,
            updatedClients: progress.updatedClients
        };

        await this.jiraConfig2Service.updateImportStatus(
            importId, 
            'running', 
            statistics,
            progress.errors
        );
    }

    // Update import status
    async updateImportStatus(importId, status, errorMessage = null) {
        const importState = this.activeImports.get(importId);
        if (importState) {
            importState.status = status;
            if (errorMessage) {
                importState.progress.errors.push({
                    timestamp: new Date().toISOString(),
                    message: errorMessage
                });
            }
        }
    }

    // Get import status
    getImportStatus(importId) {
        const activeImport = this.activeImports.get(importId);
        if (activeImport) {
            return {
                id: importId,
                status: activeImport.status,
                progress: activeImport.progress
            };
        }
        return null;
    }

    // Cancel an active import
    async cancelImport(importId) {
        const activeImport = this.activeImports.get(importId);
        
        if (!activeImport) {
            throw new Error('Import not found or already completed');
        }

        activeImport.status = 'cancelled';
        await this.jiraConfig2Service.updateImportStatus(importId, 'cancelled');
        this.activeImports.delete(importId);
        
        return { success: true };
    }
}

module.exports = JiraImport2Service;