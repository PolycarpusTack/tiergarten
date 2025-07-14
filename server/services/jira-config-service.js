const crypto = require('crypto');

class JiraConfigService {
    constructor(db) {
        this.db = db;
        // Use a fixed key for simplicity - in production, store this securely
        this.encryptionKey = process.env.ENCRYPTION_KEY || 'tiergarten-default-key-32-chars!!';
    }

    // Encrypt API token
    encrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
    }

    // Decrypt API token
    decrypt(encryptedText) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const [ivHex, encrypted] = encryptedText.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    // Get current JIRA configuration
    async getConfig() {
        try {
            const config = await this.db.get('SELECT * FROM jira_config WHERE is_active = 1 LIMIT 1');
            
            if (!config) {
                // Try to migrate from environment variables if no config exists
                if (process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
                    console.log('Migrating JIRA config from environment variables...');
                    await this.saveConfig({
                        baseUrl: process.env.JIRA_BASE_URL,
                        email: process.env.JIRA_EMAIL,
                        apiToken: process.env.JIRA_API_TOKEN
                    });
                    return await this.getConfig();
                }
                return null;
            }

            // Don't return the encrypted token
            return {
                id: config.id,
                baseUrl: config.base_url,
                email: config.email,
                isConfigured: true,
                lastTested: config.last_tested,
                lastImport: config.last_import
            };
        } catch (error) {
            console.error('Error getting JIRA config:', error);
            return null;
        }
    }

    // Get decrypted credentials for internal use
    async getCredentials() {
        try {
            const config = await this.db.get('SELECT * FROM jira_config WHERE is_active = 1 LIMIT 1');
            
            if (!config) {
                // Fallback to environment variables
                if (process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
                    return {
                        baseUrl: process.env.JIRA_BASE_URL,
                        email: process.env.JIRA_EMAIL,
                        apiToken: process.env.JIRA_API_TOKEN
                    };
                }
                return null;
            }

            const apiToken = this.decrypt(config.api_token_encrypted);
            if (!apiToken) {
                throw new Error('Failed to decrypt API token');
            }

            return {
                baseUrl: config.base_url,
                email: config.email,
                apiToken: apiToken
            };
        } catch (error) {
            console.error('Error getting JIRA credentials:', error);
            return null;
        }
    }

    // Save JIRA configuration
    async saveConfig({ baseUrl, email, apiToken }) {
        try {
            // Validate inputs
            if (!baseUrl || !email || !apiToken) {
                throw new Error('All fields are required');
            }

            // Clean up base URL
            baseUrl = baseUrl.trim().replace(/\/$/, '');
            
            // Encrypt the API token
            const encryptedToken = this.encrypt(apiToken);

            // Deactivate any existing configs
            await this.db.run('UPDATE jira_config SET is_active = 0');

            // Insert new config
            await this.db.run(
                `INSERT INTO jira_config (base_url, email, api_token_encrypted, is_active) 
                 VALUES (?, ?, ?, 1)`,
                baseUrl, email, encryptedToken
            );

            return { success: true };
        } catch (error) {
            console.error('Error saving JIRA config:', error);
            throw error;
        }
    }

    // Update last tested timestamp
    async updateLastTested() {
        await this.db.run(
            'UPDATE jira_config SET last_tested = CURRENT_TIMESTAMP WHERE is_active = 1'
        );
    }

    // Update last import timestamp
    async updateLastImport() {
        await this.db.run(
            'UPDATE jira_config SET last_import = CURRENT_TIMESTAMP WHERE is_active = 1'
        );
    }

    // Test JIRA connection
    async testConnection() {
        const credentials = await this.getCredentials();
        if (!credentials) {
            return { 
                success: false, 
                error: 'No JIRA configuration found' 
            };
        }

        try {
            const axios = require('axios');
            const response = await axios.get(
                `${credentials.baseUrl}/rest/api/2/myself`,
                {
                    auth: {
                        username: credentials.email,
                        password: credentials.apiToken
                    },
                    timeout: 10000
                }
            );

            await this.updateLastTested();

            return {
                success: true,
                user: {
                    displayName: response.data.displayName,
                    email: response.data.emailAddress,
                    accountId: response.data.accountId
                }
            };
        } catch (error) {
            if (error.response?.status === 401) {
                return {
                    success: false,
                    error: 'Invalid credentials',
                    details: 'Please check your email and API token'
                };
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return {
                    success: false,
                    error: 'Cannot connect to JIRA',
                    details: 'Please check your JIRA base URL'
                };
            } else {
                return {
                    success: false,
                    error: error.message || 'Connection failed',
                    details: error.response?.data?.message
                };
            }
        }
    }
}

module.exports = JiraConfigService;