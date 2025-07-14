/**
 * TicketStorageService v2 - Improved version with proper error handling and safety
 * 
 * Provides optimized local storage for JIRA tickets using DuckDB
 * with enhanced error handling, transaction support, and connection safety
 */

const { logger } = require('../utils/logger');

class TicketStorageService {
    constructor(db) {
        if (!db) {
            throw new Error('Database connection required');
        }
        this.db = db;
        this.batchSize = 1000;
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * Upsert a single ticket with proper error handling
     */
    async upsertTicket(ticket, clientId) {
        if (!ticket?.key) {
            throw new Error('Invalid ticket: missing key');
        }
        if (!clientId) {
            throw new Error('Client ID is required');
        }

        const startTime = Date.now();
        
        try {
            // Extract fields safely
            const fields = ticket.fields || {};
            const customFields = this.extractCustomFields(fields);
            
            // Prepare data with validation
            const ticketData = {
                key: ticket.key,
                clientId: parseInt(clientId),
                summary: this.sanitizeString(fields.summary, 'No summary'),
                description: this.sanitizeString(fields.description),
                status: fields.status?.name,
                priority: fields.priority?.name,
                ticketType: fields.issuetype?.name,
                assignee: fields.assignee?.displayName,
                reporter: fields.reporter?.displayName,
                jiraCreated: this.parseDate(fields.created),
                jiraUpdated: this.parseDate(fields.updated),
                customFields: JSON.stringify(customFields),
                components: JSON.stringify(fields.components?.map(c => c.name) || []),
                labels: JSON.stringify(fields.labels || [])
            };

            // Use transaction for safety
            return await this.db.transaction(async () => {
                const result = await this.db.get(
                    `INSERT INTO jira_tickets (
                        ticket_key, client_id, summary, description, status, priority,
                        ticket_type, assignee, reporter, jira_created, jira_updated,
                        custom_fields, components, labels, last_synced
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT (ticket_key) DO UPDATE SET
                        client_id = EXCLUDED.client_id,
                        summary = EXCLUDED.summary,
                        description = EXCLUDED.description,
                        status = EXCLUDED.status,
                        priority = EXCLUDED.priority,
                        ticket_type = EXCLUDED.ticket_type,
                        assignee = EXCLUDED.assignee,
                        reporter = EXCLUDED.reporter,
                        jira_created = EXCLUDED.jira_created,
                        jira_updated = EXCLUDED.jira_updated,
                        custom_fields = EXCLUDED.custom_fields,
                        components = EXCLUDED.components,
                        labels = EXCLUDED.labels,
                        last_synced = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id, ticket_key`,
                    ticketData.key, ticketData.clientId, ticketData.summary,
                    ticketData.description, ticketData.status, ticketData.priority,
                    ticketData.ticketType, ticketData.assignee, ticketData.reporter,
                    ticketData.jiraCreated, ticketData.jiraUpdated,
                    ticketData.customFields, ticketData.components, ticketData.labels
                );

                logger.debug('Ticket upserted', { 
                    key: ticket.key, 
                    duration: Date.now() - startTime 
                });

                return result;
            });
        } catch (error) {
            logger.error('Failed to upsert ticket', { 
                key: ticket.key, 
                error: error.message,
                stack: error.stack 
            });
            throw new Error(`Failed to upsert ticket ${ticket.key}: ${error.message}`);
        }
    }

    /**
     * Batch upsert tickets with improved error handling and recovery
     */
    async batchUpsertTickets(ticketsWithClients) {
        if (!Array.isArray(ticketsWithClients)) {
            throw new Error('Invalid input: expected array of tickets');
        }

        const startTime = Date.now();
        const stats = {
            total: ticketsWithClients.length,
            processed: 0,
            failed: 0,
            errors: [],
            duration: 0
        };

        logger.info('Starting batch upsert', { total: stats.total });

        // Process in batches with proper error isolation
        for (let i = 0; i < ticketsWithClients.length; i += this.batchSize) {
            const batch = ticketsWithClients.slice(i, i + this.batchSize);
            const batchStart = i;
            
            try {
                await this.processBatchWithRetry(batch, batchStart, stats);
            } catch (error) {
                // Log batch failure but continue with next batch
                logger.error('Batch processing failed', {
                    batchStart,
                    batchSize: batch.length,
                    error: error.message
                });
                
                // Try individual inserts for failed batch
                await this.processIndividually(batch, stats);
            }
        }

        stats.duration = Date.now() - startTime;
        stats.ticketsPerSecond = stats.processed / (stats.duration / 1000);

        logger.info('Batch upsert completed', stats);
        return stats;
    }

    /**
     * Process batch with retry logic
     * @private
     */
    async processBatchWithRetry(batch, batchStart, stats, retryCount = 0) {
        try {
            await this.executeBatchInsert(batch);
            stats.processed += batch.length;
            
            logger.debug('Batch processed successfully', {
                batchStart,
                size: batch.length,
                processed: stats.processed
            });
        } catch (error) {
            if (retryCount < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, retryCount);
                logger.warn('Retrying batch', { 
                    batchStart, 
                    retryCount: retryCount + 1,
                    delay 
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.processBatchWithRetry(batch, batchStart, stats, retryCount + 1);
            }
            
            throw error;
        }
    }

    /**
     * Process tickets individually when batch fails
     * @private
     */
    async processIndividually(batch, stats) {
        logger.info('Processing tickets individually', { count: batch.length });
        
        for (const item of batch) {
            try {
                await this.upsertTicket(item.ticket, item.clientId);
                stats.processed++;
            } catch (error) {
                stats.failed++;
                stats.errors.push({
                    ticket: item.ticket?.key,
                    error: error.message
                });
            }
        }
    }

    /**
     * Execute batch insert with proper transaction handling
     * @private
     */
    async executeBatchInsert(ticketsWithClients) {
        const tempTable = `temp_tickets_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return await this.db.transaction(async () => {
            try {
                // Create temp table
                await this.db.run(`
                    CREATE TEMPORARY TABLE ${tempTable} (
                        ticket_key VARCHAR NOT NULL,
                        client_id INTEGER NOT NULL,
                        summary VARCHAR NOT NULL,
                        description VARCHAR,
                        status VARCHAR,
                        priority VARCHAR,
                        ticket_type VARCHAR,
                        assignee VARCHAR,
                        reporter VARCHAR,
                        jira_created TIMESTAMP,
                        jira_updated TIMESTAMP,
                        custom_fields VARCHAR,
                        components VARCHAR,
                        labels VARCHAR
                    )
                `);

                // Prepare batch data
                const values = [];
                for (const { ticket, clientId } of ticketsWithClients) {
                    if (!ticket?.key || !clientId) continue;
                    
                    const fields = ticket.fields || {};
                    values.push([
                        ticket.key,
                        parseInt(clientId),
                        this.sanitizeString(fields.summary, 'No summary'),
                        this.sanitizeString(fields.description),
                        fields.status?.name,
                        fields.priority?.name,
                        fields.issuetype?.name,
                        fields.assignee?.displayName,
                        fields.reporter?.displayName,
                        this.parseDate(fields.created),
                        this.parseDate(fields.updated),
                        JSON.stringify(this.extractCustomFields(fields)),
                        JSON.stringify(fields.components?.map(c => c.name) || []),
                        JSON.stringify(fields.labels || [])
                    ]);
                }

                if (values.length === 0) {
                    throw new Error('No valid tickets in batch');
                }

                // Insert into temp table using prepared statement
                const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
                const flatValues = values.flat();
                
                await this.db.run(
                    `INSERT INTO ${tempTable} VALUES ${placeholders}`,
                    ...flatValues
                );

                // Merge into main table
                const mergeResult = await this.db.run(`
                    INSERT INTO jira_tickets (
                        ticket_key, client_id, summary, description, status, priority,
                        ticket_type, assignee, reporter, jira_created, jira_updated,
                        custom_fields, components, labels, last_synced
                    )
                    SELECT *, CURRENT_TIMESTAMP FROM ${tempTable}
                    ON CONFLICT (ticket_key) DO UPDATE SET
                        client_id = EXCLUDED.client_id,
                        summary = EXCLUDED.summary,
                        description = EXCLUDED.description,
                        status = EXCLUDED.status,
                        priority = EXCLUDED.priority,
                        ticket_type = EXCLUDED.ticket_type,
                        assignee = EXCLUDED.assignee,
                        reporter = EXCLUDED.reporter,
                        jira_created = EXCLUDED.jira_created,
                        jira_updated = EXCLUDED.jira_updated,
                        custom_fields = EXCLUDED.custom_fields,
                        components = EXCLUDED.components,
                        labels = EXCLUDED.labels,
                        last_synced = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                `);

                // Clean up temp table
                await this.db.run(`DROP TABLE IF EXISTS ${tempTable}`);
                
                return mergeResult;
            } catch (error) {
                // Ensure temp table is cleaned up on error
                try {
                    await this.db.run(`DROP TABLE IF EXISTS ${tempTable}`);
                } catch (cleanupError) {
                    logger.error('Failed to cleanup temp table', { 
                        table: tempTable, 
                        error: cleanupError.message 
                    });
                }
                throw error;
            }
        });
    }

    /**
     * Get tickets with filtering and proper JSON parsing
     */
    async getTickets(filters = {}) {
        const whereClauses = [];
        const params = [];
        
        // Build WHERE clauses safely
        if (filters.clientId) {
            whereClauses.push('client_id = ?');
            params.push(parseInt(filters.clientId));
        }
        
        if (filters.status) {
            whereClauses.push('status = ?');
            params.push(filters.status);
        }
        
        if (filters.priority) {
            whereClauses.push('priority = ?');
            params.push(filters.priority);
        }
        
        if (filters.assignee) {
            whereClauses.push('assignee = ?');
            params.push(filters.assignee);
        }
        
        if (filters.keys && Array.isArray(filters.keys)) {
            const placeholders = filters.keys.map(() => '?').join(',');
            whereClauses.push(`ticket_key IN (${placeholders})`);
            params.push(...filters.keys);
        }
        
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const limit = Math.min(parseInt(filters.limit) || 1000, 10000);
        const offset = parseInt(filters.offset) || 0;
        
        try {
            const tickets = await this.db.all(
                `SELECT * FROM jira_tickets 
                 ${whereClause}
                 ORDER BY jira_updated DESC
                 LIMIT ? OFFSET ?`,
                ...params,
                limit,
                offset
            );
            
            // Parse JSON fields safely
            return tickets.map(ticket => this.parseTicketRow(ticket));
        } catch (error) {
            logger.error('Failed to fetch tickets', { error: error.message, filters });
            throw new Error(`Failed to fetch tickets: ${error.message}`);
        }
    }

    /**
     * Get a single ticket by key
     */
    async getTicket(ticketKey) {
        if (!ticketKey) {
            throw new Error('Ticket key is required');
        }

        try {
            const ticket = await this.db.get(
                'SELECT * FROM jira_tickets WHERE ticket_key = ?',
                ticketKey
            );
            
            return ticket ? this.parseTicketRow(ticket) : null;
        } catch (error) {
            logger.error('Failed to fetch ticket', { key: ticketKey, error: error.message });
            throw new Error(`Failed to fetch ticket ${ticketKey}: ${error.message}`);
        }
    }

    /**
     * Delete old tickets with safety checks
     */
    async deleteOldTickets(beforeDate) {
        if (!(beforeDate instanceof Date)) {
            throw new Error('Invalid date provided');
        }

        try {
            const result = await this.db.run(
                'DELETE FROM jira_tickets WHERE last_synced < ?',
                beforeDate.toISOString()
            );
            
            const deletedCount = result.changes || 0;
            logger.info('Deleted old tickets', { count: deletedCount, beforeDate });
            
            return deletedCount;
        } catch (error) {
            logger.error('Failed to delete old tickets', { error: error.message });
            throw new Error(`Failed to delete old tickets: ${error.message}`);
        }
    }

    /**
     * Get comprehensive statistics
     */
    async getStatistics() {
        try {
            const [basicStats, statusDist, topClients] = await Promise.all([
                this.getBasicStatistics(),
                this.getStatusDistribution(),
                this.getTopClients()
            ]);

            return {
                ...basicStats,
                status_distribution: statusDist,
                top_clients: topClients
            };
        } catch (error) {
            logger.error('Failed to get statistics', { error: error.message });
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */

    async getBasicStatistics() {
        return await this.db.get(`
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(DISTINCT client_id) as total_clients,
                COUNT(DISTINCT status) as unique_statuses,
                MIN(jira_created) as oldest_ticket,
                MAX(jira_updated) as latest_update,
                AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - jira_created)) / 86400) as avg_age_days
            FROM jira_tickets
        `);
    }

    async getStatusDistribution() {
        return await this.db.all(`
            SELECT status, COUNT(*) as count
            FROM jira_tickets
            GROUP BY status
            ORDER BY count DESC
        `);
    }

    async getTopClients() {
        return await this.db.all(`
            SELECT 
                c.name,
                c.tier,
                COUNT(t.id) as ticket_count
            FROM clients c
            JOIN jira_tickets t ON c.id = t.client_id
            GROUP BY c.id, c.name, c.tier
            ORDER BY ticket_count DESC
            LIMIT 10
        `);
    }

    parseTicketRow(row) {
        if (!row) return null;
        
        return {
            ...row,
            custom_fields: this.safeJsonParse(row.custom_fields, {}),
            components: this.safeJsonParse(row.components, []),
            labels: this.safeJsonParse(row.labels, [])
        };
    }

    safeJsonParse(jsonString, defaultValue) {
        if (!jsonString) return defaultValue;
        
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            logger.warn('Failed to parse JSON', { json: jsonString, error: error.message });
            return defaultValue;
        }
    }

    extractCustomFields(fields) {
        const customFields = {};
        
        // Standard custom field mappings
        if (fields.customfield_10112) {
            customFields.mgxPriority = fields.customfield_10112;
        }
        if (fields.customfield_10142) {
            customFields.customerPriority = fields.customfield_10142;
        }
        
        // Extract all custom fields
        for (const [key, value] of Object.entries(fields)) {
            if (key.startsWith('customfield_') && value !== null && value !== undefined) {
                customFields[key] = value;
            }
        }
        
        return customFields;
    }

    sanitizeString(str, defaultValue = null) {
        if (!str) return defaultValue;
        
        // Remove null bytes and trim
        return str.replace(/\0/g, '').trim() || defaultValue;
    }

    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date.toISOString();
        } catch (error) {
            return null;
        }
    }
}

module.exports = TicketStorageService;
