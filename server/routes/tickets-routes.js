/**
 * Tickets Routes - API endpoints for ticket management using local storage
 * 
 * Migrated from direct JIRA API calls to use local DuckDB storage
 * for improved performance and analytical capabilities
 */

const express = require('express');
const { validateRequest, schemas } = require('../middleware/validation');
const { logger, handleApiError } = require('../utils/logger');
const TicketStorageService = require('../services/ticket-storage-service');
const { validateTicketKey, validateClientId, validatePagination, apiRateLimiter } = require('../utils/validation');


const router = express.Router();

/**
 * Initialize tickets routes with dependencies
 */
function initializeTicketsRoutes(db, jiraSyncOrchestrator) {
    const ticketStorage = new TicketStorageService(db);
    
    /**
     * GET /api/tickets
     * Get tickets with client and action information
     * Now queries local storage instead of JIRA API
     */
    router.get('/', async (req, res) => {
        try {
            // Rate limiting
            apiRateLimiter.check(req.ip || 'anonymous');
            
            logger.debug('Fetching tickets from local storage');
            
            // Get filter parameters from query
            const filters = {
                clientId: req.query.clientId,
                status: req.query.status,
                priority: req.query.priority,
                assignee: req.query.assignee,
                limit: parseInt(req.query.limit) || 1000,
                offset: parseInt(req.query.offset) || 0
            };
            
            // Remove undefined filters
            Object.keys(filters).forEach(key => 
                filters[key] === undefined && delete filters[key]
            );
            
            // Get all clients and overrides for enrichment
            const [clients, overrides] = await Promise.all([
                db.all('SELECT * FROM clients'),
                db.all('SELECT * FROM ticket_actions')
            ]);
            
            // Create lookup maps
            const clientMap = new Map(clients.map(c => [c.id, c]));
            const overrideMap = new Map(overrides.map(o => [o.ticket_key, o.action]));
            
            // Fetch tickets from local storage
            const tickets = await ticketStorage.getTickets(filters);
            
            // Process and enrich tickets
            const processedTickets = await Promise.all(tickets.map(async ticket => {
                const client = clientMap.get(ticket.client_id);
                
                if (!client) {
                    logger.warn('Ticket without matching client', { 
                        ticket_key: ticket.ticket_key, 
                        client_id: ticket.client_id 
                    });
                    return null;
                }
                
                // Check for manual override first
                const overrideAction = overrideMap.get(ticket.ticket_key);
                const assignedAction = overrideAction || await determineAction(ticket, client);
                
                // Calculate age in days
                const age = ticket.jira_created ? 
                    Math.floor((Date.now() - new Date(ticket.jira_created)) / (1000 * 60 * 60 * 24)) : 0;
                
                return {
                    id: ticket.ticket_key,
                    key: ticket.ticket_key,
                    summary: ticket.summary,
                    client: {
                        id: client.id,
                        name: client.name,
                        tier: client.tier,
                        isCA: Boolean(client.isCA),
                        isException: Boolean(client.isException)
                    },
                    priority: ticket.priority,
                    customerPriority: ticket.custom_fields?.customerPriority,
                    mgxPriority: ticket.custom_fields?.mgxPriority,
                    status: ticket.status,
                    assignedAction,
                    isManualOverride: !!overrideAction,
                    created: ticket.jira_created,
                    updated: ticket.jira_updated,
                    assignee: ticket.assignee,
                    labels: ticket.labels || [],
                    components: ticket.components || [],
                    duedate: ticket.custom_fields?.duedate,
                    resolution: ticket.custom_fields?.resolution,
                    age,
                    lastSynced: ticket.last_synced
                };
            }));
            
            // Filter out nulls and separate exceptions
            const validTickets = processedTickets.filter(t => t !== null);
            const exceptions = validTickets.filter(t => t.client.isException);
            const regularTickets = validTickets.filter(t => !t.client.isException);
            
            // Check if sync is needed
            const syncStatus = await checkSyncStatus(db, jiraSyncOrchestrator);
            
            res.json({
                exceptions,
                regularTickets,
                total: validTickets.length,
                lastUpdated: new Date().toISOString(),
                syncStatus
            });
        } catch (error) {
            handleApiError(res, error, 'getTickets');
        }
    });
    
    /**
     * GET /api/tickets/stats
     * Get ticket statistics from local storage
     */
    router.get('/stats', async (req, res) => {
        try {
            const stats = await ticketStorage.getStatistics();
            res.json(stats);
        } catch (error) {
            handleApiError(res, error, 'getTicketStats');
        }
    });
    
    /**
     * GET /api/tickets/:ticketKey
     * Get a specific ticket by key
     */
    router.get('/:ticketKey', async (req, res) => {
        try {
            const { ticketKey } = req.params;
            const ticket = await ticketStorage.getTicket(ticketKey);
            
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            
            // Enrich with client information
            const client = await db.get(
                'SELECT * FROM clients WHERE id = ?',
                ticket.client_id
            );
            
            if (!client) {
                return res.status(404).json({ error: 'Client not found for ticket' });
            }
            
            // Check for manual override
            const override = await db.get(
                'SELECT action FROM ticket_actions WHERE ticket_key = ?',
                ticketKey
            );
            
            const assignedAction = override?.action || await determineAction(ticket, client);
            
            res.json({
                ...ticket,
                client: {
                    id: client.id,
                    name: client.name,
                    tier: client.tier,
                    isCA: Boolean(client.isCA),
                    isException: Boolean(client.isException)
                },
                assignedAction,
                isManualOverride: !!override
            });
        } catch (error) {
            handleApiError(res, error, 'getTicketByKey');
        }
    });
    
    /**
     * GET /api/tickets/search
     * Search tickets using DuckDB's full-text capabilities
     */
    router.get('/search', async (req, res) => {
        try {
            const { q, fields = 'summary,description', limit = 50 } = req.query;
            
            if (!q) {
                return res.status(400).json({ error: 'Search query required' });
            }
            
            // Build search query using LIKE for now (can be optimized with FTS later)
            const searchFields = fields.split(',').map(f => f.trim());
            const whereConditions = searchFields.map(field => 
                `LOWER(${field}) LIKE LOWER(?)`
            ).join(' OR ');
            
            const searchPattern = `%${q}%`;
            const params = new Array(searchFields.length).fill(searchPattern);
            
            const tickets = await db.all(
                `SELECT * FROM jira_tickets 
                 WHERE ${whereConditions}
                 ORDER BY jira_updated DESC
                 LIMIT ?`,
                ...params,
                limit
            );
            
            res.json({
                query: q,
                fields: searchFields,
                results: tickets,
                count: tickets.length
            });
        } catch (error) {
            handleApiError(res, error, 'searchTickets');
        }
    });
    
    /**
     * POST /api/tickets/sync
     * Trigger a sync from JIRA to local storage
     */
    router.post('/sync', async (req, res) => {
        try {
            const { type = 'incremental', force = false } = req.body;
            
            // Check if sync is already running
            const activeSyncs = Array.from(jiraSyncOrchestrator.activeSyncs.values());
            const runningSync = activeSyncs.find(s => s.status === 'running');
            
            if (runningSync && !force) {
                return res.status(409).json({
                    error: 'Sync already in progress',
                    syncId: runningSync.id,
                    type: runningSync.type
                });
            }
            
            // Start sync
            let syncId;
            if (type === 'full') {
                syncId = await jiraSyncOrchestrator.startFullSync();
            } else {
                syncId = await jiraSyncOrchestrator.startIncrementalSync();
            }
            
            res.json({
                syncId,
                type,
                message: 'Sync started successfully',
                statusUrl: `/api/sync/${syncId}`
            });
        } catch (error) {
            handleApiError(res, error, 'startTicketSync');
        }
    });
    
    /**
     * GET /api/tickets/analytics/by-client
     * Get ticket analytics grouped by client using DuckDB's analytical features
     */
    router.get('/analytics/by-client', async (req, res) => {
        try {
            const analytics = await db.all(`
                SELECT 
                    c.id as client_id,
                    c.name as client_name,
                    c.tier,
                    c.isCA,
                    COUNT(t.id) as total_tickets,
                    COUNT(CASE WHEN t.status = 'Open' THEN 1 END) as open_tickets,
                    COUNT(CASE WHEN t.status = 'In Progress' THEN 1 END) as in_progress_tickets,
                    COUNT(CASE WHEN t.status = 'Closed' THEN 1 END) as closed_tickets,
                    COUNT(CASE WHEN t.priority IN ('Highest', 'High') THEN 1 END) as high_priority_tickets,
                    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.jira_created)) / 86400) as avg_age_days,
                    MAX(t.jira_updated) as last_activity
                FROM clients c
                LEFT JOIN jira_tickets t ON c.id = t.client_id
                GROUP BY c.id, c.name, c.tier, c.isCA
                ORDER BY total_tickets DESC
            `);
            
            res.json(analytics);
        } catch (error) {
            handleApiError(res, error, 'getTicketAnalyticsByClient');
        }
    });
    
    /**
     * GET /api/tickets/analytics/trends
     * Get ticket trends over time
     */
    router.get('/analytics/trends', async (req, res) => {
        try {
            const { days = 30 } = req.query;
            
            const trends = await db.all(`
                WITH date_series AS (
                    SELECT CURRENT_DATE - INTERVAL '${days - 1} days' + INTERVAL (i || ' days') as date
                    FROM generate_series(0, ${days - 1}) as s(i)
                ),
                daily_counts AS (
                    SELECT 
                        DATE(jira_created) as created_date,
                        COUNT(*) as tickets_created
                    FROM jira_tickets
                    WHERE jira_created >= CURRENT_DATE - INTERVAL '${days} days'
                    GROUP BY DATE(jira_created)
                )
                SELECT 
                    d.date,
                    COALESCE(dc.tickets_created, 0) as tickets_created
                FROM date_series d
                LEFT JOIN daily_counts dc ON d.date = dc.created_date
                ORDER BY d.date
            `);
            
            res.json({
                period_days: days,
                trends
            });
        } catch (error) {
            handleApiError(res, error, 'getTicketTrends');
        }
    });
    
    return router;
}

/**
 * Helper function to determine action based on global rules
 */
async function determineAction(ticket, client) {
    const db = require('../duckdb-database');
    const rules = await db.all('SELECT * FROM global_rules ORDER BY id');
    
    for (const rule of rules) {
        const matchesCA = rule.isCA === null || rule.isCA === client.isCA;
        const matchesTier = rule.tier === null || rule.tier === client.tier;
        const matchesMgxPriority = !rule.mgxPriority || rule.mgxPriority === ticket.custom_fields?.mgxPriority;
        const matchesCustomerPriority = !rule.customerPriority || rule.customerPriority === ticket.custom_fields?.customerPriority;
        
        if (matchesCA && matchesTier && matchesMgxPriority && matchesCustomerPriority) {
            return rule.action;
        }
    }
    
    return 'MONITOR'; // Default action
}

/**
 * Check sync status and determine if sync is needed
 */
async function checkSyncStatus(db, syncOrchestrator) {
    try {
        // Get last successful sync
        const lastSync = await db.get(`
            SELECT * FROM sync_history 
            WHERE status = 'completed'
            ORDER BY completed_at DESC 
            LIMIT 1
        `);
        
        // Get ticket statistics
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total_tickets,
                MAX(last_synced) as latest_sync,
                MIN(last_synced) as oldest_sync
            FROM jira_tickets
        `);
        
        const now = Date.now();
        const lastSyncTime = lastSync ? new Date(lastSync.completed_at).getTime() : 0;
        const timeSinceSync = now - lastSyncTime;
        const syncRecommended = timeSinceSync > 300000; // 5 minutes
        
        return {
            lastSync: lastSync ? {
                id: lastSync.id,
                type: lastSync.type,
                completedAt: lastSync.completed_at,
                ticketsSynced: JSON.parse(lastSync.progress || '{}').syncedTickets || 0
            } : null,
            timeSinceSync,
            syncRecommended,
            totalTicketsInDb: stats.total_tickets,
            isActiveSync: syncOrchestrator.activeSyncs.size > 0
        };
    } catch (error) {
        logger.error('Failed to check sync status', { error });
        return {
            error: 'Failed to check sync status',
            syncRecommended: true
        };
    }
}

module.exports = { initializeTicketsRoutes };