/**
 * Sync Routes - API endpoints for JIRA synchronization management
 * 
 * Provides monitoring, control, and status endpoints for sync operations
 */

const express = require('express');
const { validateRequest, schemas } = require('../middleware/validation');
const { logger, handleApiError } = require('../utils/logger');

const router = express.Router();

// Validation schemas
const syncSchemas = {
    startSync: {
        body: {
            fields: {
                type: { type: 'string', enum: ['full', 'incremental'] },
                options: {
                    type: 'object',
                    validate: (value) => {
                        if (value.updatedSince && !Date.parse(value.updatedSince)) {
                            return 'options.updatedSince must be a valid date';
                        }
                        return null;
                    }
                }
            }
        }
    }
};

/**
 * Initialize sync routes with dependencies
 */
function initializeSyncRoutes(syncOrchestrator) {
    
    /**
     * GET /api/sync/status
     * Get overall sync system status
     */
    router.get('/status', async (req, res) => {
        try {
            // Get active syncs
            const activeSyncs = Array.from(syncOrchestrator.activeSyncs.keys())
                .map(syncId => syncOrchestrator.getSyncStatus(syncId));
            
            // Get recent sync history
            const recentSyncs = await syncOrchestrator.db.all(`
                SELECT id, type, status, started_at, completed_at,
                       JSON_EXTRACT(progress, '$.totalTickets') as total_tickets,
                       JSON_EXTRACT(progress, '$.syncedTickets') as synced_tickets
                FROM sync_history
                ORDER BY started_at DESC
                LIMIT 10
            `);
            
            // Get sync statistics
            const stats = await syncOrchestrator.db.get(`
                SELECT 
                    COUNT(*) as total_syncs,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
                    AVG(CASE 
                        WHEN status = 'completed' 
                        THEN EXTRACT(EPOCH FROM (completed_at - started_at))
                    END) as avg_duration_seconds
                FROM sync_history
                WHERE started_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
            `);
            
            res.json({
                active_syncs: activeSyncs,
                recent_syncs: recentSyncs,
                statistics: stats,
                scheduled_syncs: Array.from(syncOrchestrator.syncSchedule.keys())
            });
        } catch (error) {
            handleApiError(res, error, 'getSyncStatus');
        }
    });

    /**
     * POST /api/sync/start
     * Start a new sync operation
     */
    router.post('/start', validateRequest(syncSchemas.startSync), async (req, res) => {
        try {
            const { type = 'incremental', options = {} } = req.body;
            
            // Check if sync is already running
            const activeSyncs = Array.from(syncOrchestrator.activeSyncs.values());
            const runningSync = activeSyncs.find(s => s.status === 'running');
            
            if (runningSync) {
                return res.status(409).json({
                    error: 'Sync already in progress',
                    syncId: runningSync.id,
                    type: runningSync.type
                });
            }
            
            let syncId;
            if (type === 'full') {
                syncId = await syncOrchestrator.startFullSync(options);
            } else {
                syncId = await syncOrchestrator.startIncrementalSync(options);
            }
            
            res.json({
                syncId,
                type,
                status: 'started',
                message: `${type} sync initiated successfully`
            });
        } catch (error) {
            handleApiError(res, error, 'startSync');
        }
    });

    /**
     * GET /api/sync/:syncId
     * Get specific sync status
     */
    router.get('/:syncId', async (req, res) => {
        try {
            const { syncId } = req.params;
            
            // Check active syncs first
            let syncStatus = syncOrchestrator.getSyncStatus(syncId);
            
            if (!syncStatus) {
                // Check database for completed/failed syncs
                const dbSync = await syncOrchestrator.db.get(
                    'SELECT * FROM sync_history WHERE id = ?',
                    syncId
                );
                
                if (!dbSync) {
                    return res.status(404).json({ error: 'Sync not found' });
                }
                
                syncStatus = {
                    id: dbSync.id,
                    type: dbSync.type,
                    status: dbSync.status,
                    progress: JSON.parse(dbSync.progress || '{}'),
                    error: dbSync.error,
                    started_at: dbSync.started_at,
                    completed_at: dbSync.completed_at,
                    duration: dbSync.completed_at ? 
                        new Date(dbSync.completed_at) - new Date(dbSync.started_at) : null
                };
            }
            
            res.json(syncStatus);
        } catch (error) {
            handleApiError(res, error, 'getSyncById');
        }
    });

    /**
     * POST /api/sync/:syncId/cancel
     * Cancel an active sync
     */
    router.post('/:syncId/cancel', async (req, res) => {
        try {
            const { syncId } = req.params;
            
            await syncOrchestrator.cancelSync(syncId);
            
            res.json({
                syncId,
                status: 'cancelled',
                message: 'Sync cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Sync not found or already completed') {
                return res.status(404).json({ error: error.message });
            }
            handleApiError(res, error, 'cancelSync');
        }
    });

    /**
     * GET /api/sync/:syncId/progress
     * Server-Sent Events endpoint for real-time progress
     */
    router.get('/:syncId/progress', (req, res) => {
        const { syncId } = req.params;
        let heartbeatInterval;
        let isCleanedUp = false;
        
        // Set up SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no' // Disable nginx buffering
        });
        
        // Send initial status
        const initialStatus = syncOrchestrator.getSyncStatus(syncId);
        if (initialStatus) {
            res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);
        }
        
        // Set up event listeners
        const progressHandler = (data) => {
            if (data.syncId === syncId && !isCleanedUp) {
                try {
                    res.write(`data: ${JSON.stringify({
                        event: 'progress',
                        ...data
                    })}\n\n`);
                } catch (error) {
                    logger.error('Failed to write progress', { error: error.message });
                    cleanup();
                }
            }
        };
        
        const completedHandler = (data) => {
            if (data.syncId === syncId && !isCleanedUp) {
                try {
                    res.write(`data: ${JSON.stringify({
                        event: 'completed',
                        ...data
                    })}\n\n`);
                } catch (error) {
                    logger.error('Failed to write completion', { error: error.message });
                }
                cleanup();
            }
        };
        
        const failedHandler = (data) => {
            if (data.syncId === syncId && !isCleanedUp) {
                try {
                    res.write(`data: ${JSON.stringify({
                        event: 'failed',
                        ...data
                    })}\n\n`);
                } catch (error) {
                    logger.error('Failed to write failure', { error: error.message });
                }
                cleanup();
            }
        };
        
        // Cleanup function
        const cleanup = () => {
            if (isCleanedUp) return;
            isCleanedUp = true;
            
            syncOrchestrator.removeListener('projectProgress', progressHandler);
            syncOrchestrator.removeListener('syncCompleted', completedHandler);
            syncOrchestrator.removeListener('syncFailed', failedHandler);
            
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
            
            try {
                res.end();
            } catch (error) {
                // Connection already closed
            }
        };
        
        // Register listeners
        syncOrchestrator.on('projectProgress', progressHandler);
        syncOrchestrator.on('syncCompleted', completedHandler);
        syncOrchestrator.on('syncFailed', failedHandler);
        
        // Heartbeat to detect dead connections
        heartbeatInterval = setInterval(() => {
            if (!isCleanedUp) {
                try {
                    res.write(':heartbeat\n\n');
                } catch (error) {
                    logger.debug('Heartbeat failed, cleaning up', { syncId });
                    cleanup();
                }
            }
        }, 30000);
        
        // Handle all disconnect scenarios
        req.on('close', cleanup);
        req.on('error', cleanup);
        res.on('error', cleanup);
        res.on('close', cleanup);
        
        // Timeout safety net
        setTimeout(() => {
            if (!isCleanedUp) {
                logger.warn('SSE connection timeout reached', { syncId });
                cleanup();
            }
        }, 3600000); // 1 hour timeout
    });

    /**
     * GET /api/sync/schedule
     * Get scheduled sync configuration
     */
    router.get('/schedule', async (req, res) => {
        try {
            const schedules = Array.from(syncOrchestrator.syncSchedule.keys()).map(id => {
                const [type] = id.split('_');
                return {
                    id,
                    type,
                    interval: syncOrchestrator.config.syncInterval,
                    active: true
                };
            });
            
            res.json({ schedules });
        } catch (error) {
            handleApiError(res, error, 'getSchedule');
        }
    });

    /**
     * POST /api/sync/schedule
     * Configure scheduled syncs
     */
    router.post('/schedule', async (req, res) => {
        try {
            const { type = 'incremental', interval = 300000, enabled = true } = req.body;
            
            if (enabled) {
                syncOrchestrator.scheduleSync(type, interval);
                res.json({
                    type,
                    interval,
                    enabled: true,
                    message: `Scheduled ${type} sync every ${interval}ms`
                });
            } else {
                syncOrchestrator.stopScheduledSyncs();
                res.json({
                    enabled: false,
                    message: 'Scheduled syncs disabled'
                });
            }
        } catch (error) {
            handleApiError(res, error, 'updateSchedule');
        }
    });

    /**
     * GET /api/sync/health
     * Health check endpoint for sync system
     */
    router.get('/health', async (req, res) => {
        try {
            // Check JIRA connectivity
            const credentials = await syncOrchestrator.jiraConfigService.getCredentials();
            let jiraHealthy = false;
            let jiraError = null;
            
            if (credentials) {
                try {
                    await syncOrchestrator.fetchProjects(credentials);
                    jiraHealthy = true;
                } catch (error) {
                    jiraError = error.message;
                }
            }
            
            // Check database
            const dbStats = await syncOrchestrator.ticketStorage.getStatistics();
            
            // Get last sync info
            const lastSync = await syncOrchestrator.getLastSuccessfulSync();
            
            res.json({
                status: jiraHealthy ? 'healthy' : 'degraded',
                checks: {
                    jira: {
                        status: jiraHealthy ? 'up' : 'down',
                        error: jiraError
                    },
                    database: {
                        status: 'up',
                        tickets: dbStats.total_tickets,
                        clients: dbStats.total_clients
                    },
                    sync: {
                        last_successful: lastSync?.completed_at,
                        active_syncs: syncOrchestrator.activeSyncs.size
                    }
                }
            });
        } catch (error) {
            handleApiError(res, error, 'syncHealth');
        }
    });

    /**
     * POST /api/sync/cleanup
     * Clean up old sync records and tickets
     */
    router.post('/cleanup', async (req, res) => {
        try {
            const { 
                syncHistoryDays = 30, 
                ticketDays = 90,
                dryRun = true 
            } = req.body;
            
            const results = {
                sync_history: 0,
                old_tickets: 0,
                dry_run: dryRun
            };
            
            if (dryRun) {
                // Count records that would be deleted
                const syncCount = await syncOrchestrator.db.get(`
                    SELECT COUNT(*) as count FROM sync_history
                    WHERE completed_at < CURRENT_TIMESTAMP - INTERVAL '${syncHistoryDays} days'
                `);
                results.sync_history = syncCount.count;
                
                const ticketCount = await syncOrchestrator.db.get(`
                    SELECT COUNT(*) as count FROM jira_tickets
                    WHERE last_synced < CURRENT_TIMESTAMP - INTERVAL '${ticketDays} days'
                `);
                results.old_tickets = ticketCount.count;
            } else {
                // Perform actual cleanup
                await syncOrchestrator.db.run(`
                    DELETE FROM sync_history
                    WHERE completed_at < CURRENT_TIMESTAMP - INTERVAL '${syncHistoryDays} days'
                `);
                
                results.old_tickets = await syncOrchestrator.ticketStorage.deleteOldTickets(
                    new Date(Date.now() - ticketDays * 86400000)
                );
            }
            
            res.json({
                message: dryRun ? 'Cleanup simulation complete' : 'Cleanup complete',
                results
            });
        } catch (error) {
            handleApiError(res, error, 'syncCleanup');
        }
    });

    return router;
}

module.exports = { initializeSyncRoutes };