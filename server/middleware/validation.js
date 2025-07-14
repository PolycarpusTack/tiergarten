// Input validation middleware for API security
// This middleware provides validation without breaking existing functionality

const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            // Only validate if schema is provided
            if (!schema) {
                return next();
            }

            const errors = [];

            // Validate body
            if (schema.body) {
                const bodyErrors = validateObject(req.body, schema.body, 'body');
                errors.push(...bodyErrors);
            }

            // Validate params
            if (schema.params) {
                const paramErrors = validateObject(req.params, schema.params, 'params');
                errors.push(...paramErrors);
            }

            // Validate query
            if (schema.query) {
                const queryErrors = validateObject(req.query, schema.query, 'query');
                errors.push(...queryErrors);
            }

            // If there are validation errors, return them
            if (errors.length > 0) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors
                });
            }

            // All validations passed
            next();
        } catch (error) {
            // If validation logic fails, don't break the request
            console.error('Validation middleware error:', error);
            next();
        }
    };
};

function validateObject(obj, schema, location) {
    const errors = [];

    // Check required fields
    if (schema.required) {
        for (const field of schema.required) {
            if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
                errors.push({
                    field: `${location}.${field}`,
                    message: `${field} is required`
                });
            }
        }
    }

    // Validate field types and constraints
    if (schema.fields) {
        for (const [field, rules] of Object.entries(schema.fields)) {
            const value = obj[field];

            // Skip if field is not present and not required
            if (value === undefined && (!schema.required || !schema.required.includes(field))) {
                continue;
            }

            // Type validation
            if (rules.type && value !== undefined) {
                const valid = validateType(value, rules.type);
                if (!valid) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: `${field} must be of type ${rules.type}`
                    });
                }
            }

            // String length validation
            if (rules.type === 'string' && typeof value === 'string') {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: `${field} must be at least ${rules.minLength} characters`
                    });
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: `${field} must not exceed ${rules.maxLength} characters`
                    });
                }
                if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: `${field} has invalid format`
                    });
                }
            }

            // Number range validation
            if (rules.type === 'number' && typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: `${field} must be at least ${rules.min}`
                    });
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: `${field} must not exceed ${rules.max}`
                    });
                }
            }

            // Array validation
            if (rules.type === 'array' && Array.isArray(value)) {
                if (rules.minItems && value.length < rules.minItems) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: `${field} must contain at least ${rules.minItems} items`
                    });
                }
                if (rules.maxItems && value.length > rules.maxItems) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: `${field} must not exceed ${rules.maxItems} items`
                    });
                }
            }

            // Enum validation
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push({
                    field: `${location}.${field}`,
                    message: `${field} must be one of: ${rules.enum.join(', ')}`
                });
            }

            // Custom validation function
            if (rules.validate && typeof rules.validate === 'function') {
                const customError = rules.validate(value);
                if (customError) {
                    errors.push({
                        field: `${location}.${field}`,
                        message: customError
                    });
                }
            }
        }
    }

    return errors;
}

function validateType(value, type) {
    switch (type) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number' && !isNaN(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'array':
            return Array.isArray(value);
        case 'object':
            return value !== null && typeof value === 'object' && !Array.isArray(value);
        case 'email':
            return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        case 'url':
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        default:
            return true;
    }
}

// Pre-defined validation schemas for common endpoints
const schemas = {
    // Client validation schemas
    createClient: {
        body: {
            required: ['name', 'jiraProjectKey'],
            fields: {
                name: { type: 'string', minLength: 1, maxLength: 255 },
                jiraProjectKey: { type: 'string', minLength: 1, maxLength: 50 },
                tier: { type: 'number', min: 1, max: 3 },
                isCA: { type: 'boolean' },
                isException: { type: 'boolean' }
            }
        }
    },
    
    updateClient: {
        params: {
            required: ['id'],
            fields: {
                id: { type: 'number', min: 1 }
            }
        },
        body: {
            fields: {
                name: { type: 'string', minLength: 1, maxLength: 255 },
                jiraProjectKey: { type: 'string', minLength: 1, maxLength: 50 },
                tier: { type: 'number', min: 1, max: 3 },
                isCA: { type: 'boolean' },
                isException: { type: 'boolean' }
            }
        }
    },

    // Widget validation schemas
    createWidget: {
        body: {
            required: ['type', 'config'],
            fields: {
                type: { type: 'string', enum: ['overview', 'list', 'chart', 'custom'] },
                config: { type: 'object' },
                position: { type: 'object' }
            }
        }
    },

    // JIRA Config 2 validation schemas
    createJiraConfig2: {
        body: {
            required: ['name', 'connectionSettings'],
            fields: {
                name: { type: 'string', minLength: 1, maxLength: 255 },
                description: { type: 'string', maxLength: 1000 },
                connectionSettings: {
                    type: 'object',
                    validate: (value) => {
                        if (!value.baseUrl || !value.email || !value.apiToken) {
                            return 'connectionSettings must include baseUrl, email, and apiToken';
                        }
                        try {
                            new URL(value.baseUrl);
                        } catch {
                            return 'connectionSettings.baseUrl must be a valid URL';
                        }
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
                            return 'connectionSettings.email must be a valid email';
                        }
                        return null;
                    }
                },
                filterSettings: { type: 'object' },
                fieldMappings: { type: 'object' },
                importSettings: { type: 'object' }
            }
        }
    },

    // JIRA import validation
    startJiraImport: {
        params: {
            required: ['id'],
            fields: {
                id: { type: 'number', min: 1 }
            }
        },
        body: {
            required: ['projects'],
            fields: {
                projects: {
                    type: 'array',
                    minItems: 1,
                    validate: (value) => {
                        for (const project of value) {
                            if (!project.key || !project.name) {
                                return 'Each project must have key and name';
                            }
                        }
                        return null;
                    }
                },
                options: { type: 'object' }
            }
        }
    },

    // Ticket action validation
    createTicketAction: {
        body: {
            required: ['ticket_key', 'action'],
            fields: {
                ticket_key: { type: 'string', minLength: 1, maxLength: 50 },
                action: { type: 'string', enum: ['viewed', 'edited', 'commented', 'assigned'] },
                details: { type: 'object' },
                performed_by: { type: 'string', maxLength: 255 }
            }
        }
    }
};

// Sanitization helpers
const sanitize = {
    string: (value) => {
        if (typeof value !== 'string') return value;
        // Remove potential XSS vectors while preserving legitimate content
        return value
            .replace(/[<>]/g, '') // Remove HTML brackets
            .trim();
    },
    
    sql: (value) => {
        if (typeof value !== 'string') return value;
        // Basic SQL injection prevention
        return value.replace(/['";\\]/g, '');
    },

    number: (value) => {
        const num = Number(value);
        return isNaN(num) ? 0 : num;
    }
};

module.exports = {
    validateRequest,
    schemas,
    sanitize
};