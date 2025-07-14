#!/usr/bin/env node

/**
 * Security Check Script
 * Validates configuration and checks for common security issues
 */

const fs = require('fs').promises;
const path = require('path');

async function checkSecurity() {
    console.log('🔒 Running security checks...\n');
    
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
            if (content.match(/password\s*=\s*["'][^"']+["']/i)) {
                issues.push(`⚠️  Possible hardcoded password in ${file}`);
            }
            
            if (content.match(/api[_-]?token\s*=\s*["'][^"']+["']/i)) {
                issues.push(`⚠️  Possible hardcoded API token in ${file}`);
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
        console.log('Security issues found:\n');
        issues.forEach(issue => console.log(issue));
    }
}

checkSecurity().catch(console.error);
