// Structured logging utility for better error handling and debugging
const path = require('path');
const fs = require('fs').promises;

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logToFile = process.env.LOG_TO_FILE === 'true';
        this.logDir = path.join(__dirname, '..', 'logs');
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        // Ensure log directory exists
        if (this.logToFile) {
            this.ensureLogDir();
        }
    }

    async ensureLogDir() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const formatted = {
            timestamp,
            level,
            message,
            ...meta
        };

        // Add request context if available
        if (meta.req) {
            formatted.request = {
                method: meta.req.method,
                url: meta.req.url,
                ip: meta.req.ip,
                userAgent: meta.req.get('user-agent')
            };
            delete formatted.req;
        }

        // Add error details if present
        if (meta.error) {
            formatted.error = {
                message: meta.error.message,
                stack: meta.error.stack,
                code: meta.error.code
            };
            delete formatted.error;
        }

        return formatted;
    }

    async writeToFile(logEntry) {
        if (!this.logToFile) return;

        try {
            const date = new Date().toISOString().split('T')[0];
            const filename = path.join(this.logDir, `${date}.log`);
            const line = JSON.stringify(logEntry) + '\n';
            await fs.appendFile(filename, line, 'utf8');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const logEntry = this.formatMessage(level, message, meta);

        // Console output
        const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        if (process.env.NODE_ENV === 'development') {
            // Pretty print in development
            console[consoleMethod](`[${level.toUpperCase()}] ${message}`, meta);
        } else {
            // JSON format in production
            console[consoleMethod](JSON.stringify(logEntry));
        }

        // File output
        this.writeToFile(logEntry);

        // In production, you might want to send critical errors to a monitoring service
        if (level === 'error' && process.env.NODE_ENV === 'production') {
            // Example: sendToMonitoringService(logEntry);
        }
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    // Express middleware for request logging
    middleware() {
        return (req, res, next) => {
            const start = Date.now();
            
            // Log request
            this.info(`${req.method} ${req.url}`, {
                req,
                query: req.query,
                body: req.method !== 'GET' ? req.body : undefined
            });

            // Capture response
            const originalSend = res.send;
            res.send = function(data) {
                res.send = originalSend;
                const duration = Date.now() - start;
                
                // Log response
                const logData = {
                    req,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`
                };

                if (res.statusCode >= 400) {
                    logger.warn(`${req.method} ${req.url} - ${res.statusCode}`, logData);
                } else {
                    logger.debug(`${req.method} ${req.url} - ${res.statusCode}`, logData);
                }

                return res.send(data);
            };

            next();
        };
    }

    // Express error handler middleware
    errorHandler() {
        return (err, req, res, next) => {
            this.error(`Unhandled error: ${err.message}`, {
                error: err,
                req
            });

            // Don't leak error details in production
            const message = process.env.NODE_ENV === 'production' 
                ? 'Internal Server Error' 
                : err.message;

            res.status(err.status || 500).json({
                error: message,
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
            });
        };
    }
}

// Create singleton instance
const logger = new Logger();

// Helper function to safely log errors
const logError = (context, error, additionalInfo = {}) => {
    logger.error(`Error in ${context}`, {
        error,
        ...additionalInfo
    });
};

// Helper function for API error responses
const handleApiError = (res, error, context, statusCode = 500) => {
    logError(context, error);
    
    const response = {
        error: process.env.NODE_ENV === 'production' 
            ? 'An error occurred' 
            : error.message
    };

    if (process.env.NODE_ENV === 'development') {
        response.details = error.stack;
    }

    res.status(statusCode).json(response);
};

module.exports = {
    logger,
    logError,
    handleApiError
};