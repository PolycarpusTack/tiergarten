/**
 * TicketStorageService - Manages local storage of JIRA tickets using DuckDB
 * 
 * This service provides efficient CRUD operations for tickets, leveraging
 * DuckDB's analytical capabilities for fast querying and aggregation.
 */

const { logger } = require('../utils/logger');

class TicketStorageService {
    constructor(db) {
        this.db = db;
        this.batchSize = 1000; // Optimal batch size for DuckDB inserts
    }

    /**
     * Store or update a single ticket
     * @param {Object} ticket - Ticket data from JIRA
     * @param {number} clientId - Client ID in our system
     * @returns {Promise<Object>} Stored ticket with ID
     */
    async upsertTicket(ticket, clientId) {
        try {
            const {
                key,
                fields: {
                    summary,
                    description,
                    status,
                    priority,
                    issuetype,
                    assignee,
                    reporter,
                    created,
                    updated,
                    components = [],
                    labels = [],
                    ...customFields
                }
            } = ticket;

            // Extract custom field values
            const mgxPriority = customFields.customfield_10112;
            const customerPriority = customFields.customfield_10142;
            const mgxCustomers = customFields.customfield_10513 || [];
            const category = customFields.customfield_10200;

            // Build custom fields JSON
            const customFieldsJson = {
                mgxPriority,
                customerPriority,
                mgxCustomers,
                category,
                // Store all other custom fields
                ...Object.entries(customFields).reduce((acc, [key, value]) => {
                    if (key.startsWith('customfield_')) {
                        acc[key] = value;
                    }
                    return acc;
                }, {})
            };

            const result = await this.db.get(`
                INSERT INTO jira_tickets (
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
                    last_synced = CURRENT_TIMESTAMP
                RETURNING *
            `,
                key,
                clientId,
                summary,
                description,
                status?.name,
                priority?.name,
                issuetype?.name,
                assignee?.displayName || assignee?.emailAddress,
                reporter?.displayName || reporter?.emailAddress,
                created,
                updated,
                JSON.stringify(customFieldsJson),
                JSON.stringify(components.map(c => c.name)),
                JSON.stringify(labels)
            );

            logger.debug(`Ticket ${key} upserted successfully`, { ticketId: result.id });
            return result;
        } catch (error) {
            logger.error(`Error upserting ticket ${ticket.key}`, { error, ticket });
            throw error;
        }
    }

    /**
     * Batch insert/update tickets for optimal performance
     * @param {Array} tickets - Array of tickets with their client IDs
     * @returns {Promise<Object>} Insert statistics
     */
    async batchUpsertTickets(tickets) {
        try {
            const startTime = Date.now();
            let processed = 0;
            let errors = [];

            // Process in batches to optimize memory usage
            for (let i = 0; i < tickets.length; i += this.batchSize) {
                const batch = tickets.slice(i, i + this.batchSize);
                
                try {
                    // Prepare batch data
                    const values = batch.map(({ ticket, clientId }) => {
                        const fields = ticket.fields;
                        const customFieldsJson = this.extractCustomFields(fields);
                        
                        return [
                            ticket.key,
                            clientId,
                            fields.summary,
                            fields.description,
                            fields.status?.name,
                            fields.priority?.name,
                            fields.issuetype?.name,
                            fields.assignee?.displayName || fields.assignee?.emailAddress,
                            fields.reporter?.displayName || fields.reporter?.emailAddress,
                            fields.created,
                            fields.updated,
                            JSON.stringify(customFieldsJson),
                            JSON.stringify((fields.components || []).map(c => c.name)),
                            JSON.stringify(fields.labels || [])
                        ];
                    });

                    // Use DuckDB's efficient batch insert
                    await this.executeBatchInsert(values);
                    processed += batch.length;
                    
                    logger.debug(`Processed batch ${i / this.batchSize + 1}`, {
                        processed,
                        total: tickets.length
                    });
                } catch (batchError) {
                    logger.error(`Error processing batch starting at ${i}`, { error: batchError });
                    errors.push({
                        batchStart: i,
                        error: batchError.message,
                        tickets: batch.map(t => t.ticket.key)
                    });
                }
            }

            const duration = Date.now() - startTime;
            const stats = {
                total: tickets.length,
                processed,
                failed: tickets.length - processed,
                errors,
                duration,
                ticketsPerSecond: Math.round((processed / duration) * 1000)
            };

            logger.info('Batch upsert completed', stats);
            return stats;
        } catch (error) {
            logger.error('Fatal error in batch upsert', { error });
            throw error;
        }
    }

    /**
     * Execute batch insert using DuckDB's optimized method
     * @private
     */
    async executeBatchInsert(values) {
        // Create a temporary table for bulk loading
        const tempTable = `temp_tickets_${Date.now()}`;
        
        try {
            // Create temp table with same structure
            await this.db.exec(`
                CREATE TEMPORARY TABLE ${tempTable} AS 
                SELECT * FROM jira_tickets WHERE 1=0
            `);

            // Bulk insert into temp table
            const placeholders = values.map((_, i) => 
                `($${i * 14 + 1}, $${i * 14 + 2}, $${i * 14 + 3}, $${i * 14 + 4}, 
                  $${i * 14 + 5}, $${i * 14 + 6}, $${i * 14 + 7}, $${i * 14 + 8},
                  $${i * 14 + 9}, $${i * 14 + 10}, $${i * 14 + 11}, $${i * 14 + 12},
                  $${i * 14 + 13}, $${i * 14 + 14}, CURRENT_TIMESTAMP)`
            ).join(',');

            const flatValues = values.flat();
            
            await this.db.run(`
                INSERT INTO ${tempTable} (
                    ticket_key, client_id, summary, description, status, priority,
                    ticket_type, assignee, reporter, jira_created, jira_updated,
                    custom_fields, components, labels, last_synced
                ) VALUES ${placeholders}
            `, ...flatValues);

            // Merge from temp table to main table
            await this.db.exec(`
                INSERT INTO jira_tickets 
                SELECT * FROM ${tempTable}
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
                    last_synced = CURRENT_TIMESTAMP
            `);
        } finally {
            // Clean up temp table
            await this.db.exec(`DROP TABLE IF EXISTS ${tempTable}`);
        }
    }

    /**
     * Extract and structure custom fields from JIRA ticket
     * @private
     */
    extractCustomFields(fields) {
        const customFields = {};
        
        // Known important custom fields
        const importantFields = {
            customfield_10112: 'mgxPriority',
            customfield_10142: 'customerPriority',
            customfield_10513: 'mgxCustomers',
            customfield_10200: 'category',
            customfield_10507: 'priority',
            customfield_10611: 'squad',
            customfield_10511: 'team'
        };

        Object.entries(fields).forEach(([key, value]) => {
            if (key.startsWith('customfield_')) {
                // Use friendly name if available
                const friendlyName = importantFields[key];
                if (friendlyName) {
                    customFields[friendlyName] = value;
                }
                // Always store by field ID as well
                customFields[key] = value;
            }
        });

        return customFields;
    }

    /**
     * Get a single ticket by key
     * @param {string} ticketKey - JIRA ticket key
     * @returns {Promise<Object|null>} Ticket data or null
     */
    async getTicket(ticketKey) {
        try {
            const ticket = await this.db.get(
                'SELECT * FROM jira_tickets WHERE ticket_key = ?',
                ticketKey
            );

            if (ticket) {
                // Parse JSON fields
                ticket.custom_fields = JSON.parse(ticket.custom_fields || '{}');
                ticket.components = JSON.parse(ticket.components || '[]');
                ticket.labels = JSON.parse(ticket.labels || '[]');
            }

            return ticket;
        } catch (error) {
            logger.error(`Error fetching ticket ${ticketKey}`, { error });
            throw error;
        }
    }

    /**
     * Get multiple tickets with filtering
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Array>} Array of tickets
     */
    async getTickets(filters = {}) {
        try {
            let query = 'SELECT * FROM jira_tickets WHERE 1=1';
            const params = [];

            // Build dynamic query based on filters
            if (filters.clientId) {
                query += ' AND client_id = ?';
                params.push(filters.clientId);
            }

            if (filters.status) {
                query += ' AND status = ?';
                params.push(filters.status);
            }

            if (filters.assignee) {
                query += ' AND assignee = ?';
                params.push(filters.assignee);
            }

            if (filters.updatedSince) {
                query += ' AND jira_updated > ?';
                params.push(filters.updatedSince);
            }

            if (filters.keys && filters.keys.length > 0) {
                const placeholders = filters.keys.map(() => '?').join(',');
                query += ` AND ticket_key IN (${placeholders})`;
                params.push(...filters.keys);
            }

            // Add ordering
            query += ' ORDER BY jira_updated DESC';

            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
            }

            const tickets = await this.db.all(query, ...params);

            // Parse JSON fields
            return tickets.map(ticket => ({
                ...ticket,
                custom_fields: JSON.parse(ticket.custom_fields || '{}'),
                components: JSON.parse(ticket.components || '[]'),
                labels: JSON.parse(ticket.labels || '[]')
            }));
        } catch (error) {
            logger.error('Error fetching tickets', { error, filters });
            throw error;
        }
    }

    /**
     * Delete tickets older than specified date
     * @param {Date} beforeDate - Delete tickets not updated since this date
     * @returns {Promise<number>} Number of deleted tickets
     */
    async deleteOldTickets(beforeDate) {
        try {
            const result = await this.db.run(
                'DELETE FROM jira_tickets WHERE last_synced < ? RETURNING *',
                beforeDate
            );

            const deletedCount = result.changes || 0;
            logger.info(`Deleted ${deletedCount} old tickets`, { beforeDate });
            
            return deletedCount;
        } catch (error) {
            logger.error('Error deleting old tickets', { error, beforeDate });
            throw error;
        }
    }

    /**
     * Get ticket statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const stats = await this.db.get(`
                SELECT 
                    COUNT(*) as total_tickets,
                    COUNT(DISTINCT client_id) as total_clients,
                    COUNT(DISTINCT status) as unique_statuses,
                    MIN(jira_created) as oldest_ticket,
                    MAX(jira_updated) as latest_update,
                    AVG(EXTRACT(DAY FROM CURRENT_TIMESTAMP - jira_created)) as avg_age_days
                FROM jira_tickets
            `);

            // Get status distribution
            const statusDist = await this.db.all(`
                SELECT status, COUNT(*) as count
                FROM jira_tickets
                GROUP BY status
                ORDER BY count DESC
            `);

            // Get client distribution
            const clientDist = await this.db.all(`
                SELECT c.name, c.tier, COUNT(t.id) as ticket_count
                FROM jira_tickets t
                JOIN clients c ON t.client_id = c.id
                GROUP BY c.id, c.name, c.tier
                ORDER BY ticket_count DESC
                LIMIT 10
            `);

            return {
                ...stats,
                status_distribution: statusDist,
                top_clients: clientDist
            };
        } catch (error) {
            logger.error('Error getting statistics', { error });
            throw error;
        }
    }
}

module.exports = TicketStorageService;