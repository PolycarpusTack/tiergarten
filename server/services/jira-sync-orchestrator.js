/**
 * JiraSyncOrchestrator - Orchestrates synchronization between JIRA and local storage
 * 
 * Handles both full and incremental syncs with proper error handling,
 * retry logic, and progress tracking.
 */

const EventEmitter = require('events');
const axios = require('axios');
const { logger } = require('../utils/logger');
const TicketStorageService = require('./ticket-storage-service');

class JiraSyncOrchestrator extends EventEmitter {
    constructor(db, jiraConfigService) {
        super();
        this.db = db;
        this.jiraConfigService = jiraConfigService;
        this.ticketStorage = new TicketStorageService(db);
        
        // Configuration
        this.config = {
            batchSize: 100,        // JIRA API batch size
            maxRetries: 3,         // Max retries for failed requests
            retryDelay: 1000,      // Initial retry delay (exponential backoff)
            syncInterval: 300000,  // 5 minutes default sync interval
            maxConcurrency: 3      // Max concurrent project syncs
        };
        
        // State tracking
        this.activeSyncs = new Map();
        this.syncSchedule = new Map();
        this.syncLock = new SyncLock();
    }

    /**
     * Start a full synchronization for all projects
     * @param {Object} options - Sync options
     * @returns {Promise<string>} Sync ID
     */
    async startFullSync(options = {}) {
        const syncId = `full_${Date.now()}`;
        let releaseLock;
        
        try {
            // Acquire sync lock
            releaseLock = await this.syncLock.acquire('full_sync', 3600000); // 1 hour timeout
            
            logger.info('Starting full sync', { syncId, options });
            
            // Get JIRA credentials
            const credentials = await this.jiraConfigService.getCredentials();
            if (!credentials) {
                throw new Error('JIRA credentials not configured');
            }

            // Create sync record
            await this.createSyncRecord(syncId, 'full', options);
            
            // Get all projects
            const projects = await this.fetchProjects(credentials);
            
            // Initialize sync state
            const syncState = {
                id: syncId,
                type: 'full',
                credentials,
                projects,
                options,
                startTime: Date.now(),
                status: 'running',
                progress: {
                    totalProjects: projects.length,
                    completedProjects: 0,
                    totalTickets: 0,
                    syncedTickets: 0,
                    errors: []
                }
            };
            
            this.activeSyncs.set(syncId, syncState);
            this.emit('syncStarted', { syncId, type: 'full', projects: projects.length });
            
            // Process projects with concurrency control
            await this.processSyncBatch(syncState);
            
            return syncId;
        } catch (error) {
            logger.error('Failed to start full sync', { error, syncId });
            await this.updateSyncStatus(syncId, 'failed', error.message);
            if (releaseLock) releaseLock();
            throw error;
        }
    }

    /**
     * Start an incremental sync for updated tickets
     * @param {Object} options - Sync options
     * @returns {Promise<string>} Sync ID
     */
    async startIncrementalSync(options = {}) {
        const syncId = `incr_${Date.now()}`;
        
        try {
            logger.info('Starting incremental sync', { syncId, options });
            
            // Get last successful sync time
            const lastSync = await this.getLastSuccessfulSync();
            const updatedSince = options.updatedSince || lastSync?.completed_at || new Date(Date.now() - 86400000); // 24h default
            
            // Get credentials
            const credentials = await this.jiraConfigService.getCredentials();
            if (!credentials) {
                throw new Error('JIRA credentials not configured');
            }

            // Create sync record
            await this.createSyncRecord(syncId, 'incremental', { ...options, updatedSince });
            
            // Get projects with recent updates
            const projects = await this.fetchProjectsWithUpdates(credentials, updatedSince);
            
            if (projects.length === 0) {
                logger.info('No projects with updates since last sync', { updatedSince });
                await this.updateSyncStatus(syncId, 'completed', 'No updates');
                return syncId;
            }
            
            // Initialize sync state
            const syncState = {
                id: syncId,
                type: 'incremental',
                credentials,
                projects,
                options: { ...options, updatedSince },
                startTime: Date.now(),
                status: 'running',
                progress: {
                    totalProjects: projects.length,
                    completedProjects: 0,
                    totalTickets: 0,
                    syncedTickets: 0,
                    errors: []
                }
            };
            
            this.activeSyncs.set(syncId, syncState);
            this.emit('syncStarted', { syncId, type: 'incremental', projects: projects.length });
            
            // Process projects
            await this.processSyncBatch(syncState);
            
            return syncId;
        } catch (error) {
            logger.error('Failed to start incremental sync', { error, syncId });
            await this.updateSyncStatus(syncId, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Process sync batch with concurrency control
     * @private
     */
    async processSyncBatch(syncState) {
        const { projects, id: syncId } = syncState;
        const chunks = [];
        
        // Split projects into chunks for concurrent processing
        for (let i = 0; i < projects.length; i += this.config.maxConcurrency) {
            chunks.push(projects.slice(i, i + this.config.maxConcurrency));
        }
        
        try {
            // Process each chunk
            for (const chunk of chunks) {
                await Promise.all(
                    chunk.map(project => this.syncProject(syncState, project))
                );
            }
            
            // Mark sync as completed
            await this.completeSyncRecord(syncId, syncState.progress);
            syncState.status = 'completed';
            
            // Release lock if this was a full sync
            if (syncState.type === 'full' && syncState.releaseLock) {
                syncState.releaseLock();
            }
            
            this.emit('syncCompleted', {
                syncId,
                duration: Date.now() - syncState.startTime,
                progress: syncState.progress
            });
            
        } catch (error) {
            logger.error('Sync batch processing failed', { error, syncId });
            syncState.status = 'failed';
            await this.updateSyncStatus(syncId, 'failed', error.message);
            
            this.emit('syncFailed', {
                syncId,
                error: error.message,
                progress: syncState.progress
            });
        } finally {
            this.activeSyncs.delete(syncId);
        }
    }

    /**
     * Sync a single project
     * @private
     */
    async syncProject(syncState, project) {
        const { credentials, type, options } = syncState;
        
        try {
            logger.debug('Syncing project', { project: project.key, syncId: syncState.id });
            
            // Ensure client exists
            const clientId = await this.ensureClient(project);
            
            // Build JQL query
            const jql = this.buildJQL(project.key, type, options);
            
            let startAt = 0;
            let totalIssues = 0;
            const tickets = [];
            
            // Fetch tickets in batches
            while (true) {
                const response = await this.fetchTicketBatch(
                    credentials,
                    jql,
                    startAt,
                    this.config.batchSize
                );
                
                const { issues, total } = response;
                totalIssues = total;
                
                if (issues.length === 0) break;
                
                // Add client ID to each ticket
                tickets.push(...issues.map(ticket => ({
                    ticket,
                    clientId
                })));
                
                startAt += issues.length;
                
                // Update progress
                this.updateProgress(syncState, {
                    totalTickets: syncState.progress.totalTickets + (startAt === issues.length ? total : 0)
                });
                
                // Emit progress event
                this.emit('projectProgress', {
                    syncId: syncState.id,
                    project: project.key,
                    fetched: startAt,
                    total: totalIssues
                });
                
                if (startAt >= total) break;
            }
            
            // Store tickets in batches
            if (tickets.length > 0) {
                const stats = await this.ticketStorage.batchUpsertTickets(tickets);
                
                // Update progress
                this.updateProgress(syncState, {
                    syncedTickets: syncState.progress.syncedTickets + stats.processed,
                    completedProjects: syncState.progress.completedProjects + 1
                });
                
                logger.info('Project sync completed', {
                    project: project.key,
                    tickets: tickets.length,
                    stats
                });
            }
            
            // Update project sync timestamp
            await this.updateProjectSyncTime(project.key);
            
        } catch (error) {
            logger.error('Failed to sync project', { 
                error, 
                project: project.key, 
                syncId: syncState.id 
            });
            
            syncState.progress.errors.push({
                project: project.key,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            // Don't throw - continue with other projects
        }
    }

    /**
     * Build JQL query for ticket fetching
     * @private
     */
    buildJQL(projectKey, syncType, options) {
        const parts = [`project = "${projectKey}"`];
        
        if (syncType === 'incremental' && options.updatedSince) {
            const date = new Date(options.updatedSince);
            const jiraDate = date.toISOString().split('T')[0];
            parts.push(`updated >= "${jiraDate}"`);
        }
        
        // Add any custom JQL from options
        if (options.customJQL) {
            parts.push(`(${options.customJQL})`);
        }
        
        // Exclude certain issue types if configured
        const excludedTypes = options.excludedTypes || ['Sub-task'];
        if (excludedTypes.length > 0) {
            parts.push(`issuetype NOT IN (${excludedTypes.map(t => `"${t}"`).join(', ')})`);
        }
        
        return parts.join(' AND ');
    }

    /**
     * Fetch tickets from JIRA with retry logic
     * @private
     */
    async fetchTicketBatch(credentials, jql, startAt, maxResults, retryCount = 0) {
        try {
            const response = await axios.get(
                `${credentials.baseUrl}/rest/api/2/search`,
                {
                    params: {
                        jql,
                        startAt,
                        maxResults,
                        fields: '*all', // Get all fields for comprehensive storage
                        expand: 'changelog,renderedFields'
                    },
                    auth: {
                        username: credentials.email,
                        password: credentials.apiToken
                    },
                    timeout: 30000
                }
            );
            
            return response.data;
        } catch (error) {
            if (retryCount < this.config.maxRetries && this.isRetryableError(error)) {
                const delay = this.config.retryDelay * Math.pow(2, retryCount);
                logger.warn('Retrying JIRA request', { 
                    jql, 
                    startAt, 
                    retryCount, 
                    delay,
                    error: error.message 
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchTicketBatch(credentials, jql, startAt, maxResults, retryCount + 1);
            }
            
            throw error;
        }
    }

    /**
     * Check if error is retryable
     * @private
     */
    isRetryableError(error) {
        if (!error.response) return true; // Network errors
        
        const status = error.response.status;
        return status === 429 || status === 503 || status >= 500;
    }

    /**
     * Fetch all projects from JIRA
     * @private
     */
    async fetchProjects(credentials) {
        try {
            const response = await axios.get(
                `${credentials.baseUrl}/rest/api/2/project`,
                {
                    auth: {
                        username: credentials.email,
                        password: credentials.apiToken
                    },
                    timeout: 10000
                }
            );
            
            return response.data.map(p => ({
                key: p.key,
                name: p.name,
                id: p.id
            }));
        } catch (error) {
            logger.error('Failed to fetch projects', { error });
            throw error;
        }
    }

    /**
     * Fetch projects with recent updates
     * @private
     */
    async fetchProjectsWithUpdates(credentials, updatedSince) {
        // First get all projects
        const allProjects = await this.fetchProjects(credentials);
        
        // Check each project for updates (could be optimized with a single JQL query)
        const projectsWithUpdates = [];
        
        for (const project of allProjects) {
            const jql = this.buildJQL(project.key, 'incremental', { updatedSince });
            
            try {
                const response = await axios.get(
                    `${credentials.baseUrl}/rest/api/2/search`,
                    {
                        params: {
                            jql,
                            maxResults: 1,
                            fields: 'key'
                        },
                        auth: {
                            username: credentials.email,
                            password: credentials.apiToken
                        }
                    }
                );
                
                if (response.data.total > 0) {
                    projectsWithUpdates.push(project);
                }
            } catch (error) {
                logger.warn('Failed to check project for updates', { 
                    project: project.key, 
                    error: error.message 
                });
            }
        }
        
        return projectsWithUpdates;
    }

    /**
     * Ensure client exists for project
     * @private
     */
    async ensureClient(project) {
        // Check if client exists
        let client = await this.db.get(
            'SELECT id FROM clients WHERE jiraProjectKey = ?',
            project.key
        );
        
        if (!client) {
            // Create client with default values
            await this.db.run(
                `INSERT INTO clients (name, jiraProjectKey, tier, isCA, isException) 
                 VALUES (?, ?, 3, 0, 0)`,
                project.name,
                project.key
            );
            
            client = await this.db.get(
                'SELECT id FROM clients WHERE jiraProjectKey = ?',
                project.key
            );
            
            logger.info('Created new client for project', { 
                project: project.key, 
                clientId: client.id 
            });
        }
        
        return client.id;
    }

    /**
     * Update sync progress
     * @private
     */
    updateProgress(syncState, updates) {
        Object.assign(syncState.progress, updates);
        
        // Persist progress periodically
        if (syncState.progress.syncedTickets % 100 === 0) {
            this.updateSyncProgress(syncState.id, syncState.progress).catch(err => 
                logger.error('Failed to update sync progress', { error: err })
            );
        }
    }

    /**
     * Database operations for sync tracking
     */
    
    async createSyncRecord(syncId, type, options) {
        await this.db.run(
            `INSERT INTO sync_history (id, type, status, options, started_at)
             VALUES (?, ?, 'running', ?, CURRENT_TIMESTAMP)`,
            syncId, type, JSON.stringify(options)
        );
    }
    
    async updateSyncStatus(syncId, status, error = null) {
        await this.db.run(
            `UPDATE sync_history 
             SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            status, error, syncId
        );
    }
    
    async updateSyncProgress(syncId, progress) {
        await this.db.run(
            `UPDATE sync_history 
             SET progress = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            JSON.stringify(progress), syncId
        );
    }
    
    async completeSyncRecord(syncId, progress) {
        await this.db.run(
            `UPDATE sync_history 
             SET status = 'completed', progress = ?, completed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            JSON.stringify(progress), syncId
        );
    }
    
    async getLastSuccessfulSync() {
        return await this.db.get(
            `SELECT * FROM sync_history 
             WHERE status = 'completed' AND type = 'incremental'
             ORDER BY completed_at DESC 
             LIMIT 1`
        );
    }
    
    async updateProjectSyncTime(projectKey) {
        await this.db.run(
            `UPDATE clients 
             SET last_synced = CURRENT_TIMESTAMP 
             WHERE jiraProjectKey = ?`,
            projectKey
        );
    }

    /**
     * Get sync status
     */
    getSyncStatus(syncId) {
        const sync = this.activeSyncs.get(syncId);
        if (sync) {
            return {
                id: syncId,
                status: sync.status,
                progress: sync.progress,
                duration: Date.now() - sync.startTime
            };
        }
        
        // Return null if not found in active syncs
        return null;
    }

    /**
     * Cancel an active sync
     */
    async cancelSync(syncId) {
        const sync = this.activeSyncs.get(syncId);
        if (!sync) {
            throw new Error('Sync not found or already completed');
        }
        
        sync.status = 'cancelled';
        await this.updateSyncStatus(syncId, 'cancelled', 'User cancelled');
        this.activeSyncs.delete(syncId);
        
        this.emit('syncCancelled', { syncId });
        
        return { success: true };
    }

    /**
     * Schedule automatic syncs
     */
    scheduleSync(type = 'incremental', interval = this.config.syncInterval) {
        const scheduleId = `${type}_schedule`;
        
        // Clear existing schedule
        if (this.syncSchedule.has(scheduleId)) {
            clearInterval(this.syncSchedule.get(scheduleId));
        }
        
        // Set new schedule
        const intervalId = setInterval(async () => {
            try {
                logger.info('Running scheduled sync', { type, interval });
                
                if (type === 'incremental') {
                    await this.startIncrementalSync();
                } else {
                    await this.startFullSync();
                }
            } catch (error) {
                logger.error('Scheduled sync failed', { error, type });
            }
        }, interval);
        
        this.syncSchedule.set(scheduleId, intervalId);
        logger.info('Sync scheduled', { type, interval });
    }

    /**
     * Stop all scheduled syncs
     */
    stopScheduledSyncs() {
        for (const [id, intervalId] of this.syncSchedule) {
            clearInterval(intervalId);
            logger.info('Stopped scheduled sync', { id });
        }
        this.syncSchedule.clear();
    }
}

/**
 * Sync lock implementation to prevent concurrent syncs
 */
class SyncLock {
    constructor() {
        this.locks = new Map();
    }
    
    async acquire(key, timeout = 30000) {
        if (this.locks.has(key)) {
            const existingLock = this.locks.get(key);
            const age = Date.now() - existingLock.acquired;
            
            // If lock is stale, force release
            if (age > timeout) {
                logger.warn('Releasing stale lock', { key, age });
                this.release(key);
            } else {
                throw new Error(`Sync already in progress (locked ${Math.round(age/1000)}s ago)`);
            }
        }
        
        const lock = {
            acquired: Date.now(),
            timeout: setTimeout(() => {
                logger.warn('Lock timeout reached, auto-releasing', { key });
                this.release(key);
            }, timeout)
        };
        
        this.locks.set(key, lock);
        return () => this.release(key);
    }
    
    release(key) {
        const lock = this.locks.get(key);
        if (lock) {
            clearTimeout(lock.timeout);
            this.locks.delete(key);
            logger.debug('Lock released', { key });
        }
    }
    
    isLocked(key) {
        return this.locks.has(key);
    }
}

module.exports = JiraSyncOrchestrator;