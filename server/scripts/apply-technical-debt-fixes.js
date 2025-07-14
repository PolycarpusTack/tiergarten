#!/usr/bin/env node

/**
 * Apply Technical Debt Fixes
 * 
 * This script applies critical fixes identified in the technical debt review:
 * - Replaces ticket-storage-service with v2 (enhanced error handling)
 * - Updates validation imports
 * - Adds new database indexes
 * - Backs up existing code before changes
 */

const fs = require('fs').promises;
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backups', `backup_${Date.now()}`);

async function createBackup() {
    console.log('📦 Creating backup...');
    
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    const filesToBackup = [
        'services/ticket-storage-service.js',
        'routes/tickets-routes.js',
        'services/jira-sync-orchestrator.js',
        'routes/sync-routes.js'
    ];
    
    for (const file of filesToBackup) {
        const src = path.join(__dirname, '..', file);
        const dest = path.join(BACKUP_DIR, file);
        
        try {
            await fs.mkdir(path.dirname(dest), { recursive: true });
            await fs.copyFile(src, dest);
            console.log(`  ✓ Backed up ${file}`);
        } catch (error) {
            console.warn(`  ⚠ Could not backup ${file}: ${error.message}`);
        }
    }
    
    console.log(`\n✅ Backup created at: ${BACKUP_DIR}\n`);
}

async function applyFixes() {
    console.log('🔧 Applying fixes...\n');
    
    // 1. Replace ticket-storage-service with v2
    console.log('1. Updating ticket-storage-service...');
    const v2Path = path.join(__dirname, '..', 'services', 'ticket-storage-service-v2.js');
    const originalPath = path.join(__dirname, '..', 'services', 'ticket-storage-service.js');
    
    try {
        await fs.access(v2Path);
        await fs.rename(originalPath, originalPath + '.old');
        await fs.rename(v2Path, originalPath);
        console.log('  ✓ Replaced with enhanced version');
    } catch (error) {
        console.error('  ✗ Failed to update ticket-storage-service:', error.message);
    }
    
    // 2. Update imports in tickets-routes.js
    console.log('\n2. Updating tickets routes...');
    const ticketsRoutesPath = path.join(__dirname, '..', 'routes', 'tickets-routes.js');
    
    try {
        let content = await fs.readFile(ticketsRoutesPath, 'utf8');
        
        // Add validation import
        if (!content.includes('../utils/validation')) {
            const validationImport = "const { validateTicketKey, validateClientId, validatePagination, apiRateLimiter } = require('../utils/validation');\n";
            content = content.replace(
                "const TicketStorageService = require('../services/ticket-storage-service');",
                "const TicketStorageService = require('../services/ticket-storage-service');\n" + validationImport
            );
        }
        
        // Add rate limiting to main endpoint
        if (!content.includes('apiRateLimiter.check')) {
            content = content.replace(
                'router.get(\'/\', async (req, res) => {',
                `router.get('/', async (req, res) => {
        try {
            // Rate limiting
            apiRateLimiter.check(req.ip || 'anonymous');`
            );
        }
        
        await fs.writeFile(ticketsRoutesPath, content);
        console.log('  ✓ Updated imports and rate limiting');
    } catch (error) {
        console.error('  ✗ Failed to update tickets routes:', error.message);
    }
    
    // 3. Create database migration for indexes
    console.log('\n3. Creating index migration...');
    const migrationContent = `-- Technical debt fix: Add missing performance indexes
-- Generated: ${new Date().toISOString()}

-- Performance critical indexes for ticket queries
CREATE INDEX IF NOT EXISTS idx_jira_tickets_client_status ON jira_tickets(client_id, status);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_updated_status ON jira_tickets(jira_updated, status);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_assignee ON jira_tickets(assignee) WHERE assignee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_history_started ON sync_history(started_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_jira_tickets_client_priority ON jira_tickets(client_id, priority);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_status_updated ON jira_tickets(status, jira_updated);

-- Add updated_at trigger simulation for DuckDB
-- Note: DuckDB doesn't support triggers, so this must be handled in application code
`;
    
    const migrationPath = path.join(__dirname, '..', 'migrations', `add_performance_indexes_${Date.now()}.sql`);
    await fs.mkdir(path.dirname(migrationPath), { recursive: true });
    await fs.writeFile(migrationPath, migrationContent);
    console.log('  ✓ Created migration file');
    
    // 4. Update package.json scripts
    console.log('\n4. Updating package.json scripts...');
    const packagePath = path.join(__dirname, '..', 'package.json');
    
    try {
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        
        if (!packageJson.scripts['db:migrate']) {
            packageJson.scripts['db:migrate'] = 'node scripts/run-migrations.js';
        }
        
        if (!packageJson.scripts['test:security']) {
            packageJson.scripts['test:security'] = 'npm audit && node scripts/security-check.js';
        }
        
        if (!packageJson.scripts['sync:full']) {
            packageJson.scripts['sync:full'] = 'node scripts/initial-sync.js';
        }
        
        await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
        console.log('  ✓ Added utility scripts');
    } catch (error) {
        console.error('  ✗ Failed to update package.json:', error.message);
    }
    
    // 5. Create security check script
    console.log('\n5. Creating security check script...');
    const securityCheckContent = `#!/usr/bin/env node

/**
 * Security Check Script
 * Validates configuration and checks for common security issues
 */

const fs = require('fs').promises;
const path = require('path');

async function checkSecurity() {
    console.log('🔒 Running security checks...\\n');
    
    const issues = [];
    
    // Check for .env file permissions
    try {
        const stats = await fs.stat(path.join(__dirname, '..', '.env'));
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        if (mode !== '600' && mode !== '640') {
            issues.push('⚠️  .env file has loose permissions: ' + mode);
        }
    } catch (error) {
        // .env might not exist
    }
    
    // Check for exposed credentials in code
    const filesToCheck = [
        'server.js',
        'services/jira-config-service.js',
        'services/jira-sync-orchestrator.js'
    ];
    
    for (const file of filesToCheck) {
        try {
            const content = await fs.readFile(path.join(__dirname, '..', file), 'utf8');
            
            // Check for hardcoded credentials
            if (content.match(/password\\s*=\\s*["'][^"']+["']/i)) {
                issues.push(\`⚠️  Possible hardcoded password in \${file}\`);
            }
            
            if (content.match(/api[_-]?token\\s*=\\s*["'][^"']+["']/i)) {
                issues.push(\`⚠️  Possible hardcoded API token in \${file}\`);
            }
        } catch (error) {
            // File might not exist
        }
    }
    
    // Check database file permissions
    try {
        const dbPath = path.join(__dirname, '..', 'database', 'tiergarten.duckdb');
        const stats = await fs.stat(dbPath);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        if (mode === '777' || mode === '666') {
            issues.push('⚠️  Database file has loose permissions: ' + mode);
        }
    } catch (error) {
        // Database might not exist yet
    }
    
    if (issues.length === 0) {
        console.log('✅ No security issues found!');
    } else {
        console.log('Security issues found:\\n');
        issues.forEach(issue => console.log(issue));
    }
}

checkSecurity().catch(console.error);
`;
    
    const securityCheckPath = path.join(__dirname, 'security-check.js');
    await fs.writeFile(securityCheckPath, securityCheckContent);
    await fs.chmod(securityCheckPath, '755');
    console.log('  ✓ Created security check script');
}

async function showNextSteps() {
    console.log('\n📋 Next steps:\n');
    console.log('1. Run database migrations:');
    console.log('   npm run db:migrate\n');
    console.log('2. Run security checks:');
    console.log('   npm run test:security\n');
    console.log('3. Restart the server:');
    console.log('   npm restart\n');
    console.log('4. Run a test sync:');
    console.log('   curl -X POST http://localhost:3600/api/sync/start -H "Content-Type: application/json" -d \'{"type":"incremental"}\'');
    console.log('\n⚠️  If issues occur, restore from backup:');
    console.log(`   ${BACKUP_DIR}`);
}

async function main() {
    console.log('🚀 Technical Debt Fix Application\n');
    
    try {
        await createBackup();
        await applyFixes();
        await showNextSteps();
        
        console.log('\n✅ Fixes applied successfully!');
    } catch (error) {
        console.error('\n❌ Error applying fixes:', error);
        console.error('\nRestore from backup if needed:', BACKUP_DIR);
        process.exit(1);
    }
}

main();