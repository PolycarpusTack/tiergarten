#!/usr/bin/env node

/**
 * Initial Sync Script
 * 
 * This script performs an initial full synchronization from JIRA to local storage.
 * Run this after setting up the application to populate the local database.
 * 
 * Usage: node scripts/initial-sync.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../duckdb-database');
const JiraConfigService = require('../services/jira-config-service');
const JiraSyncOrchestrator = require('../services/jira-sync-orchestrator');
const { logger } = require('../utils/logger');

async function performInitialSync() {
    console.log('🚀 Starting initial JIRA synchronization...\n');
    
    try {
        // Initialize database
        console.log('📊 Initializing database...');
        await db.init();
        
        // Initialize services
        const jiraConfigService = new JiraConfigService(db);
        const syncOrchestrator = new JiraSyncOrchestrator(db, jiraConfigService);
        
        // Check JIRA configuration
        console.log('🔑 Checking JIRA configuration...');
        const credentials = await jiraConfigService.getCredentials();
        
        if (!credentials) {
            console.error('❌ No JIRA credentials configured!');
            console.log('\nPlease configure JIRA credentials through the web interface first.');
            process.exit(1);
        }
        
        console.log('✅ JIRA credentials found');
        console.log(`📍 JIRA URL: ${credentials.baseUrl}`);
        console.log(`👤 JIRA User: ${credentials.email}\n`);
        
        // Get existing data stats
        const stats = await db.get(`
            SELECT 
                COUNT(DISTINCT id) as total_clients,
                COUNT(DISTINCT ticket_key) as total_tickets
            FROM (
                SELECT id, NULL as ticket_key FROM clients
                UNION ALL
                SELECT NULL as id, ticket_key FROM jira_tickets
            )
        `);
        
        console.log('📈 Current database status:');
        console.log(`   - Clients: ${stats?.total_clients || 0}`);
        console.log(`   - Tickets: ${stats?.total_tickets || 0}\n`);
        
        // Listen to sync events
        syncOrchestrator.on('syncStarted', (data) => {
            console.log(`🔄 Sync started: ${data.type} sync for ${data.projects} projects`);
        });
        
        syncOrchestrator.on('projectProgress', (data) => {
            console.log(`   📁 ${data.project}: ${data.fetched}/${data.total} tickets`);
        });
        
        syncOrchestrator.on('syncCompleted', async (data) => {
            console.log(`\n✅ Sync completed successfully!`);
            console.log(`   - Duration: ${Math.round(data.duration / 1000)}s`);
            console.log(`   - Projects synced: ${data.progress.completedProjects}`);
            console.log(`   - Tickets synced: ${data.progress.syncedTickets}`);
            
            // Get final stats
            const finalStats = await db.get('SELECT COUNT(*) as count FROM jira_tickets');
            console.log(`   - Total tickets in database: ${finalStats.count}\n`);
            
            await cleanup();
        });
        
        syncOrchestrator.on('syncFailed', async (data) => {
            console.error(`\n❌ Sync failed: ${data.error}`);
            if (data.progress.errors.length > 0) {
                console.error('\nProject errors:');
                data.progress.errors.forEach(err => {
                    console.error(`   - ${err.project}: ${err.error}`);
                });
            }
            await cleanup();
        });
        
        // Start full sync
        console.log('🚀 Starting full synchronization...\n');
        const syncId = await syncOrchestrator.startFullSync({
            force: true,
            excludedTypes: ['Sub-task', 'Epic'] // Customize as needed
        });
        
        console.log(`📋 Sync ID: ${syncId}`);
        console.log('⏳ This may take several minutes depending on the number of tickets...\n');
        
        // Keep the process running until sync completes
        process.on('SIGINT', async () => {
            console.log('\n\n⚠️  Sync interrupted by user');
            try {
                await syncOrchestrator.cancelSync(syncId);
                console.log('🛑 Sync cancelled');
            } catch (error) {
                console.error('Error cancelling sync:', error.message);
            }
            await cleanup();
        });
        
    } catch (error) {
        console.error('\n❌ Error during initial sync:', error.message);
        console.error(error.stack);
        await cleanup();
    }
}

async function cleanup() {
    try {
        await db.close();
        console.log('🔒 Database connection closed');
    } catch (error) {
        console.error('Error closing database:', error.message);
    }
    process.exit(0);
}

// Run the sync
performInitialSync();