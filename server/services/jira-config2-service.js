const crypto = require('crypto');
const axios = require('axios');

class JiraConfig2Service {
    constructor(db, jiraConfigService) {
        this.db = db;
        this.jiraConfigService = jiraConfigService;
        this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    }

    // Encryption helpers
    encrypt(text) {
        if (!text) return null;
        try {
            // Use createCipheriv instead of deprecated createCipher
            const algorithm = 'aes-256-cbc';
            const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv(algorithm, key, iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Return iv + encrypted data
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            throw error;
        }
    }

    decrypt(encrypted) {
        if (!encrypted) return null;
        try {
            // Use createDecipheriv instead of deprecated createDecipher
            const algorithm = 'aes-256-cbc';
            const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
            
            // Split iv and encrypted data
            const parts = encrypted.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted format');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const encryptedData = parts[1];
            
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    // Configuration Management
    async createConfig(configData) {
        const {
            name,
            description,
            connectionSettings,
            filterSettings,
            fieldMappings,
            importSettings
        } = configData;

        try {
            // Encrypt sensitive connection data
            const encryptedConnection = {
                ...connectionSettings,
                apiToken: connectionSettings.apiToken ? this.encrypt(connectionSettings.apiToken) : null
            };

            // Use DuckDB's RETURNING clause to get the inserted ID
            const result = await this.db.get(
                `INSERT INTO jira_config2 (name, description, connection_settings, filter_settings, field_mappings, import_settings)
                 VALUES (?, ?, ?, ?, ?, ?)
                 RETURNING id`,
                name,
                description || '',
                JSON.stringify(encryptedConnection),
                JSON.stringify(filterSettings || {}),
                JSON.stringify(fieldMappings || {}),
                JSON.stringify(importSettings || {})
            );

            if (!result || !result.id) {
                throw new Error('Failed to create configuration');
            }

            return { id: result.id, success: true };
        } catch (error) {
            console.error('Error creating config:', error);
            console.error('SQL Error Details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            throw new Error(`Failed to create configuration: ${error.message}`);
        }
    }

    async getConfig(configId) {
        try {
            const config = await this.db.get('SELECT * FROM jira_config2 WHERE id = ?', configId);
            if (!config) return null;

            // Parse JSON fields and decrypt connection settings
            const connectionSettings = JSON.parse(config.connection_settings || '{}');
            if (connectionSettings.apiToken) {
                connectionSettings.apiToken = this.decrypt(connectionSettings.apiToken);
            }

            return {
                ...config,
                connection_settings: connectionSettings,
                filter_settings: JSON.parse(config.filter_settings || '{}'),
                field_mappings: JSON.parse(config.field_mappings || '{}'),
                import_settings: JSON.parse(config.import_settings || '{}')
            };
        } catch (error) {
            console.error('Error getting config:', error);
            throw error;
        }
    }

    async listConfigs() {
        try {
            const configs = await this.db.all('SELECT id, name, description, is_active, created_at, updated_at FROM jira_config2 ORDER BY created_at DESC');
            return configs || [];
        } catch (error) {
            console.error('Error listing configs:', error);
            return [];
        }
    }

    async updateConfig(configId, updates) {
        try {
            const current = await this.getConfig(configId);
            if (!current) throw new Error('Configuration not found');

            const fields = [];
            const values = [];

            // Handle each updatable field
            if (updates.name !== undefined) {
                fields.push('name = ?');
                values.push(updates.name);
            }

            if (updates.description !== undefined) {
                fields.push('description = ?');
                values.push(updates.description);
            }

            if (updates.connectionSettings !== undefined) {
                const encryptedConnection = {
                    ...updates.connectionSettings,
                    apiToken: updates.connectionSettings.apiToken ? 
                        this.encrypt(updates.connectionSettings.apiToken) : 
                        current.connection_settings.apiToken
                };
                fields.push('connection_settings = ?');
                values.push(JSON.stringify(encryptedConnection));
            }

            if (updates.filterSettings !== undefined) {
                fields.push('filter_settings = ?');
                values.push(JSON.stringify(updates.filterSettings));
            }

            if (updates.fieldMappings !== undefined) {
                fields.push('field_mappings = ?');
                values.push(JSON.stringify(updates.fieldMappings));
            }

            if (updates.importSettings !== undefined) {
                fields.push('import_settings = ?');
                values.push(JSON.stringify(updates.importSettings));
            }

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(configId);

            await this.db.run(
                `UPDATE jira_config2 SET ${fields.join(', ')} WHERE id = ?`,
                ...values
            );

            return { success: true };
        } catch (error) {
            console.error('Error updating config:', error);
            throw error;
        }
    }

    async setActiveConfig(configId) {
        try {
            // Deactivate all configs
            await this.db.run('UPDATE jira_config2 SET is_active = 0');
            
            // Activate the selected config
            await this.db.run('UPDATE jira_config2 SET is_active = 1 WHERE id = ?', configId);
            
            return { success: true };
        } catch (error) {
            console.error('Error setting active config:', error);
            throw error;
        }
    }

    async getActiveConfig() {
        try {
            const config = await this.db.get('SELECT * FROM jira_config2 WHERE is_active = 1 LIMIT 1');
            if (!config) return null;

            return this.getConfig(config.id);
        } catch (error) {
            console.error('Error getting active config:', error);
            return null;
        }
    }

    // Field Mapping Management
    async saveFieldMapping(configId, mapping) {
        const {
            jiraFieldId,
            jiraFieldName,
            jiraFieldType,
            tiergartenField,
            mappingType,
            transformRules,
            isEnabled
        } = mapping;

        try {
            // Check if mapping exists
            const existing = await this.db.get(
                'SELECT id FROM jira_field_mappings WHERE config_id = ? AND jira_field_id = ?',
                configId, jiraFieldId
            );

            if (existing) {
                // Update existing
                await this.db.run(
                    `UPDATE jira_field_mappings 
                     SET jira_field_name = ?, jira_field_type = ?, tiergarten_field = ?, 
                         mapping_type = ?, transform_rules = ?, is_enabled = ?
                     WHERE id = ?`,
                    jiraFieldName, jiraFieldType, tiergartenField,
                    mappingType || 'direct', JSON.stringify(transformRules || {}),
                    isEnabled !== false ? 1 : 0, existing.id
                );
            } else {
                // Insert new
                await this.db.run(
                    `INSERT INTO jira_field_mappings 
                     (config_id, jira_field_id, jira_field_name, jira_field_type, tiergarten_field, mapping_type, transform_rules, is_enabled)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    configId, jiraFieldId, jiraFieldName, jiraFieldType, tiergartenField,
                    mappingType || 'direct', JSON.stringify(transformRules || {}),
                    isEnabled !== false ? 1 : 0
                );
            }

            return { success: true };
        } catch (error) {
            console.error('Error saving field mapping:', error);
            throw error;
        }
    }

    async getFieldMappings(configId) {
        try {
            const mappings = await this.db.all(
                'SELECT * FROM jira_field_mappings WHERE config_id = ? ORDER BY jira_field_name',
                configId
            );

            return mappings.map(m => ({
                ...m,
                transform_rules: JSON.parse(m.transform_rules || '{}')
            }));
        } catch (error) {
            console.error('Error getting field mappings:', error);
            return [];
        }
    }

    // Filter Preset Management
    async saveFilterPreset(preset) {
        const { name, description, filterSettings, isDefault } = preset;

        try {
            if (isDefault) {
                // Remove default from other presets
                await this.db.run('UPDATE jira_filter_presets SET is_default = 0');
            }

            // Use DuckDB's RETURNING clause to get the inserted ID
            const result = await this.db.get(
                `INSERT INTO jira_filter_presets (name, description, filter_settings, is_default)
                 VALUES (?, ?, ?, ?)
                 RETURNING id`,
                name, description || '', JSON.stringify(filterSettings), isDefault ? 1 : 0
            );

            if (!result || !result.id) {
                throw new Error('Failed to create filter preset');
            }

            return { id: result.id, success: true };
        } catch (error) {
            console.error('Error saving filter preset:', error);
            throw error;
        }
    }

    async getFilterPresets() {
        try {
            const presets = await this.db.all('SELECT * FROM jira_filter_presets ORDER BY name');
            return presets.map(p => ({
                ...p,
                filter_settings: JSON.parse(p.filter_settings || '{}')
            }));
        } catch (error) {
            console.error('Error getting filter presets:', error);
            return [];
        }
    }

    // JIRA Field Discovery
    async discoverJiraFields(configId) {
        try {
            const config = await this.getConfig(configId);
            if (!config) throw new Error('Configuration not found');

            const { baseUrl, email, apiToken } = config.connection_settings;

            // Fetch field metadata from JIRA
            const response = await axios.get(`${baseUrl}/rest/api/2/field`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
                    'Accept': 'application/json'
                }
            });

            const fields = response.data;
            
            // Process and categorize fields
            const categorizedFields = {
                standard: [],
                custom: [],
                system: []
            };

            fields.forEach(field => {
                const fieldInfo = {
                    id: field.id || field.key,
                    name: field.name,
                    type: field.schema?.type || 'string',
                    custom: field.custom || false,
                    system: field.system || false,
                    items: field.schema?.items,
                    allowedValues: field.allowedValues
                };

                if (field.custom) {
                    categorizedFields.custom.push(fieldInfo);
                } else if (field.system) {
                    categorizedFields.system.push(fieldInfo);
                } else {
                    categorizedFields.standard.push(fieldInfo);
                }
            });

            return categorizedFields;
        } catch (error) {
            console.error('Error discovering JIRA fields:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    // Get field values for filter configuration
    async getFieldValues(configId, fieldId) {
        try {
            const config = await this.getConfig(configId);
            if (!config) throw new Error('Configuration not found');

            const { baseUrl, email, apiToken } = config.connection_settings;

            // Special handling for known fields
            const knownFieldValues = {
                'issuetype': '/rest/api/2/issuetype',
                'priority': '/rest/api/2/priority',
                'status': '/rest/api/2/status',
                'project': '/rest/api/2/project'
            };

            let endpoint = knownFieldValues[fieldId];
            
            // For custom fields, try to get allowed values
            if (!endpoint && fieldId.startsWith('customfield_')) {
                endpoint = `/rest/api/2/field/${fieldId}/option`;
            }

            if (!endpoint) {
                return { values: [], error: 'Unable to determine endpoint for field' };
            }

            try {
                const response = await axios.get(`${baseUrl}${endpoint}`, {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
                        'Accept': 'application/json'
                    }
                });

                const data = response.data;
            
                // Normalize the response based on field type
                let values = [];
                if (Array.isArray(data)) {
                    values = data.map(item => ({
                        id: item.id || item.value,
                        name: item.name || item.value,
                        description: item.description
                    }));
                } else if (data.values) {
                    values = data.values.map(item => ({
                        id: item.id || item.value,
                        name: item.name || item.value
                    }));
                }

                return { values, error: null };
            } catch (axiosError) {
                // Some custom fields don't have an options endpoint
                if (axiosError.response && axiosError.response.status === 404) {
                    return { values: [], error: 'No predefined values for this field' };
                }
                throw axiosError;
            }
        } catch (error) {
            console.error('Error getting field values:', error);
            return { values: [], error: error.message };
        }
    }

    // Import History
    async recordImportStart(configId, importId) {
        try {
            await this.db.run(
                `INSERT INTO jira_config2_imports (config_id, import_id, status, started_at)
                 VALUES (?, ?, 'running', CURRENT_TIMESTAMP)`,
                configId, importId
            );
            return { success: true };
        } catch (error) {
            console.error('Error recording import start:', error);
            throw error;
        }
    }

    async updateImportStatus(importId, status, statistics, errors) {
        try {
            const updates = ['status = ?'];
            const values = [status];

            if (statistics) {
                updates.push('statistics = ?');
                values.push(JSON.stringify(statistics));
            }

            if (errors) {
                updates.push('error_log = ?');
                values.push(JSON.stringify(errors));
            }

            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                updates.push('completed_at = CURRENT_TIMESTAMP');
            }

            values.push(importId);

            await this.db.run(
                `UPDATE jira_config2_imports SET ${updates.join(', ')} WHERE import_id = ?`,
                ...values
            );

            return { success: true };
        } catch (error) {
            console.error('Error updating import status:', error);
            throw error;
        }
    }

    async getImportHistory(configId, limit = 10) {
        try {
            const imports = await this.db.all(
                `SELECT * FROM jira_config2_imports 
                 WHERE config_id = ? 
                 ORDER BY started_at DESC 
                 LIMIT ?`,
                configId, limit
            );

            return imports.map(imp => ({
                ...imp,
                statistics: JSON.parse(imp.statistics || '{}'),
                error_log: JSON.parse(imp.error_log || '[]')
            }));
        } catch (error) {
            console.error('Error getting import history:', error);
            return [];
        }
    }
}

module.exports = JiraConfig2Service;