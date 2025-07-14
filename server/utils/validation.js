/**
 * Enhanced validation utilities for security and data integrity
 */

const { logger } = require('./logger');

/**
 * Validate and sanitize ticket key
 */
function validateTicketKey(key) {
    if (!key || typeof key !== 'string') {
        throw new Error('Invalid ticket key: must be a string');
    }
    
    // JIRA ticket key format: PROJECT-NUMBER
    const ticketKeyPattern = /^[A-Z][A-Z0-9_]{1,9}-\d{1,10}$/;
    
    if (!ticketKeyPattern.test(key)) {
        throw new Error(`Invalid ticket key format: ${key}`);
    }
    
    return key.trim();
}

/**
 * Validate and sanitize client ID
 */
function validateClientId(clientId) {
    const id = parseInt(clientId);
    
    if (isNaN(id) || id < 1) {
        throw new Error('Invalid client ID: must be a positive integer');
    }
    
    return id;
}

/**
 * Sanitize string input to prevent SQL injection
 */
function sanitizeString(str, maxLength = 1000) {
    if (!str) return null;
    
    if (typeof str !== 'string') {
        str = String(str);
    }
    
    // Remove null bytes
    str = str.replace(/\0/g, '');
    
    // Trim and limit length
    str = str.trim().substring(0, maxLength);
    
    // Escape single quotes for SQL (though we should use parameterized queries)
    // This is a safety net only
    str = str.replace(/'/g, "''");
    
    return str;
}

/**
 * Validate date string
 */
function validateDate(dateStr) {
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${dateStr}`);
    }
    
    // Ensure date is reasonable (not too far in past or future)
    const now = Date.now();
    const dateTime = date.getTime();
    const yearInMs = 365 * 24 * 60 * 60 * 1000;
    
    if (dateTime < now - (50 * yearInMs) || dateTime > now + (10 * yearInMs)) {
        throw new Error(`Date out of reasonable range: ${dateStr}`);
    }
    
    return date.toISOString();
}

/**
 * Validate JSON string
 */
function validateJson(jsonStr, maxSize = 50000) {
    if (!jsonStr) return '{}';
    
    if (typeof jsonStr === 'object') {
        jsonStr = JSON.stringify(jsonStr);
    }
    
    if (jsonStr.length > maxSize) {
        throw new Error(`JSON too large: ${jsonStr.length} bytes (max: ${maxSize})`);
    }
    
    try {
        JSON.parse(jsonStr);
        return jsonStr;
    } catch (error) {
        throw new Error(`Invalid JSON: ${error.message}`);
    }
}

/**
 * Validate array of strings
 */
function validateStringArray(arr, maxItems = 100, maxItemLength = 200) {
    if (!arr) return '[]';
    
    if (!Array.isArray(arr)) {
        throw new Error('Invalid array: must be an array');
    }
    
    if (arr.length > maxItems) {
        throw new Error(`Array too large: ${arr.length} items (max: ${maxItems})`);
    }
    
    const sanitized = arr
        .filter(item => item != null)
        .map(item => sanitizeString(String(item), maxItemLength));
    
    return JSON.stringify(sanitized);
}

/**
 * Validate sync options
 */
function validateSyncOptions(options) {
    const validated = {};
    
    if (options.updatedSince) {
        validated.updatedSince = validateDate(options.updatedSince);
    }
    
    if (options.customJQL) {
        // Basic JQL validation - prevent obvious injection attempts
        const jql = sanitizeString(options.customJQL, 500);
        if (jql.includes(';') || jql.toLowerCase().includes('drop')) {
            throw new Error('Invalid JQL: suspicious content detected');
        }
        validated.customJQL = jql;
    }
    
    if (options.excludedTypes) {
        if (!Array.isArray(options.excludedTypes)) {
            throw new Error('excludedTypes must be an array');
        }
        validated.excludedTypes = options.excludedTypes
            .slice(0, 20)
            .map(type => sanitizeString(type, 50));
    }
    
    return validated;
}

/**
 * Validate pagination parameters
 */
function validatePagination(limit, offset) {
    const validatedLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 10000);
    const validatedOffset = Math.max(parseInt(offset) || 0, 0);
    
    if (validatedOffset > 1000000) {
        throw new Error('Offset too large');
    }
    
    return { limit: validatedLimit, offset: validatedOffset };
}

/**
 * Create a safe SQL identifier (table/column name)
 */
function safeSqlIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
        throw new Error('Invalid SQL identifier');
    }
    
    // Only allow alphanumeric and underscore
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error(`Invalid SQL identifier: ${identifier}`);
    }
    
    return identifier;
}

/**
 * Validate ticket data for storage
 */
function validateTicketData(ticket, clientId) {
    const errors = [];
    
    try {
        validateTicketKey(ticket.key);
    } catch (error) {
        errors.push(`key: ${error.message}`);
    }
    
    try {
        validateClientId(clientId);
    } catch (error) {
        errors.push(`clientId: ${error.message}`);
    }
    
    if (!ticket.fields?.summary) {
        errors.push('summary: required field missing');
    }
    
    if (errors.length > 0) {
        throw new Error(`Ticket validation failed: ${errors.join(', ')}`);
    }
    
    return {
        key: validateTicketKey(ticket.key),
        clientId: validateClientId(clientId),
        fields: ticket.fields
    };
}

/**
 * Rate limiting helper
 */
class RateLimiter {
    constructor(maxRequests = 100, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }
    
    check(key) {
        const now = Date.now();
        const userRequests = this.requests.get(key) || [];
        
        // Remove old requests
        const validRequests = userRequests.filter(time => now - time < this.windowMs);
        
        if (validRequests.length >= this.maxRequests) {
            const resetTime = validRequests[0] + this.windowMs;
            const waitTime = Math.ceil((resetTime - now) / 1000);
            throw new Error(`Rate limit exceeded. Try again in ${waitTime} seconds`);
        }
        
        validRequests.push(now);
        this.requests.set(key, validRequests);
        
        return true;
    }
    
    // Clean up old entries periodically
    cleanup() {
        const now = Date.now();
        for (const [key, requests] of this.requests.entries()) {
            const validRequests = requests.filter(time => now - time < this.windowMs);
            if (validRequests.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, validRequests);
            }
        }
    }
}

// Create rate limiter instances
const apiRateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
const syncRateLimiter = new RateLimiter(5, 300000); // 5 syncs per 5 minutes

// Cleanup old rate limit entries every minute
setInterval(() => {
    apiRateLimiter.cleanup();
    syncRateLimiter.cleanup();
}, 60000);

module.exports = {
    validateTicketKey,
    validateClientId,
    sanitizeString,
    validateDate,
    validateJson,
    validateStringArray,
    validateSyncOptions,
    validatePagination,
    safeSqlIdentifier,
    validateTicketData,
    apiRateLimiter,
    syncRateLimiter
};