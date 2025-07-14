// JIRA Error Handler Service
// Provides comprehensive error handling for JIRA API interactions

class JiraErrorHandler {
    constructor() {
        this.errorTypes = {
            NETWORK: 'NETWORK_ERROR',
            AUTH: 'AUTHENTICATION_ERROR',
            RATE_LIMIT: 'RATE_LIMIT_ERROR',
            PERMISSION: 'PERMISSION_ERROR',
            NOT_FOUND: 'NOT_FOUND_ERROR',
            TIMEOUT: 'TIMEOUT_ERROR',
            INVALID_REQUEST: 'INVALID_REQUEST_ERROR',
            SERVER_ERROR: 'SERVER_ERROR',
            UNKNOWN: 'UNKNOWN_ERROR'
        };

        this.retryableErrors = new Set([
            this.errorTypes.NETWORK,
            this.errorTypes.RATE_LIMIT,
            this.errorTypes.TIMEOUT,
            this.errorTypes.SERVER_ERROR
        ]);
    }

    // Analyze error and return structured error info
    analyzeError(error) {
        // Network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            return {
                type: this.errorTypes.NETWORK,
                message: 'Unable to connect to JIRA. Please check your network connection and JIRA URL.',
                details: error.message,
                retryable: true
            };
        }

        // Axios response errors
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            // Authentication errors
            if (status === 401) {
                return {
                    type: this.errorTypes.AUTH,
                    message: 'Authentication failed. Please check your JIRA email and API token.',
                    details: data?.message || 'Invalid credentials',
                    retryable: false
                };
            }

            // Permission errors
            if (status === 403) {
                return {
                    type: this.errorTypes.PERMISSION,
                    message: 'Permission denied. Your JIRA account may not have access to this resource.',
                    details: data?.message || 'Insufficient permissions',
                    retryable: false
                };
            }

            // Not found errors
            if (status === 404) {
                return {
                    type: this.errorTypes.NOT_FOUND,
                    message: 'Resource not found. The JIRA endpoint or resource may not exist.',
                    details: data?.message || error.message,
                    retryable: false
                };
            }

            // Rate limiting
            if (status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                return {
                    type: this.errorTypes.RATE_LIMIT,
                    message: 'JIRA API rate limit exceeded. Please wait before retrying.',
                    details: `Retry after ${retryAfter || '60'} seconds`,
                    retryable: true,
                    retryAfter: parseInt(retryAfter) || 60
                };
            }

            // Bad request
            if (status === 400) {
                return {
                    type: this.errorTypes.INVALID_REQUEST,
                    message: 'Invalid request to JIRA API.',
                    details: data?.message || data?.errors || 'Bad request',
                    retryable: false
                };
            }

            // Server errors
            if (status >= 500) {
                return {
                    type: this.errorTypes.SERVER_ERROR,
                    message: 'JIRA server error. The service may be temporarily unavailable.',
                    details: `Status ${status}: ${data?.message || 'Internal server error'}`,
                    retryable: true
                };
            }
        }

        // Timeout errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return {
                type: this.errorTypes.TIMEOUT,
                message: 'Request to JIRA timed out. The server may be slow or unresponsive.',
                details: error.message,
                retryable: true
            };
        }

        // Unknown errors
        return {
            type: this.errorTypes.UNKNOWN,
            message: 'An unexpected error occurred while communicating with JIRA.',
            details: error.message || 'Unknown error',
            retryable: false
        };
    }

    // Create user-friendly error response
    createErrorResponse(error) {
        const analysis = this.analyzeError(error);
        
        return {
            error: true,
            type: analysis.type,
            message: analysis.message,
            details: analysis.details,
            retryable: analysis.retryable,
            retryAfter: analysis.retryAfter,
            timestamp: new Date().toISOString()
        };
    }

    // Handle error with retry logic
    async handleWithRetry(operation, maxRetries = 3, initialDelay = 1000) {
        let lastError;
        let delay = initialDelay;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                const analysis = this.analyzeError(error);

                // Don't retry non-retryable errors
                if (!analysis.retryable) {
                    throw error;
                }

                // Don't retry if this is the last attempt
                if (attempt === maxRetries) {
                    throw error;
                }

                // Handle rate limiting with specific delay
                if (analysis.type === this.errorTypes.RATE_LIMIT && analysis.retryAfter) {
                    delay = analysis.retryAfter * 1000;
                }

                console.log(`JIRA request failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
                await this.sleep(delay);

                // Exponential backoff for subsequent retries
                delay = Math.min(delay * 2, 30000); // Max 30 seconds
            }
        }

        throw lastError;
    }

    // Helper function for delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Log error with context
    logError(context, error) {
        const analysis = this.analyzeError(error);
        const timestamp = new Date().toISOString();

        console.error(`[${timestamp}] JIRA Error in ${context}:`);
        console.error(`  Type: ${analysis.type}`);
        console.error(`  Message: ${analysis.message}`);
        console.error(`  Details: ${analysis.details}`);
        console.error(`  Retryable: ${analysis.retryable}`);
        
        if (process.env.NODE_ENV === 'development') {
            console.error('  Stack:', error.stack);
        }
    }

    // Check if error is retryable
    isRetryable(error) {
        const analysis = this.analyzeError(error);
        return analysis.retryable;
    }

    // Get suggested action for error
    getSuggestedAction(error) {
        const analysis = this.analyzeError(error);

        switch (analysis.type) {
            case this.errorTypes.AUTH:
                return 'Please verify your JIRA credentials in the server configuration.';
            case this.errorTypes.NETWORK:
                return 'Check your internet connection and JIRA URL configuration.';
            case this.errorTypes.PERMISSION:
                return 'Contact your JIRA administrator to request the necessary permissions.';
            case this.errorTypes.RATE_LIMIT:
                return `Wait ${analysis.retryAfter || 60} seconds before trying again.`;
            case this.errorTypes.TIMEOUT:
                return 'Try again in a few moments or contact your JIRA administrator.';
            default:
                return 'Please try again or contact support if the issue persists.';
        }
    }
}

module.exports = new JiraErrorHandler();