// JIRA Field Mapper - Discovers and maps custom fields

const axios = require('axios');

class JiraFieldMapper {
    constructor(baseUrl, auth) {
        this.baseUrl = baseUrl;
        this.auth = auth;
        this.fieldMap = null;
    }

    async getFieldMapping() {
        if (this.fieldMap) return this.fieldMap;
        
        try {
            // Fetch all field definitions from JIRA
            const response = await axios.get(`${this.baseUrl}/rest/api/2/field`, {
                auth: this.auth
            });
            
            this.fieldMap = {};
            
            // Map field names to IDs
            response.data.forEach(field => {
                const name = field.name.toLowerCase();
                const originalName = field.name;
                
                // Look for customer priority field - exact match first
                if (originalName === 'Customer Prio[Dropdown]' || 
                    originalName === 'Customer Prio' ||
                    originalName === 'Customer Priority') {
                    this.fieldMap.customerPriority = field.id;
                    console.log(`Found Customer Priority field: ${field.name} (${field.id})`);
                }
                // Fallback to pattern matching
                else if (name.includes('customer') && (name.includes('prio') || name.includes('priority'))) {
                    this.fieldMap.customerPriority = field.id;
                    console.log(`Found Customer Priority field: ${field.name} (${field.id})`);
                }
                
                // Look for MGX priority field
                if (originalName === 'MGX Prio[Dropdown]' || 
                    originalName === 'MGX Prio' ||
                    originalName === 'MGX Priority') {
                    this.fieldMap.mgxPriority = field.id;
                    console.log(`Found MGX Priority field: ${field.name} (${field.id})`);
                }
                // Fallback to pattern matching for MGX priority
                else if (name.includes('mgx') && (name.includes('prio') || name.includes('priority'))) {
                    this.fieldMap.mgxPriority = field.id;
                    console.log(`Found MGX Priority field: ${field.name} (${field.id})`);
                }
                
                // Map other potentially useful custom fields
                if (name.includes('sla')) {
                    this.fieldMap.sla = field.id;
                }
                
                if (name.includes('severity')) {
                    this.fieldMap.severity = field.id;
                }
            });
            
            return this.fieldMap;
        } catch (error) {
            console.error('Error fetching JIRA field definitions:', error.message);
            return {};
        }
    }
    
    // Build dynamic field list for API request
    async getFieldsList() {
        const mapping = await this.getFieldMapping();
        
        // Base fields always included
        const baseFields = [
            'key', 'summary', 'priority', 'status', 'project',
            'created', 'updated', 'assignee', 'labels', 'components',
            'duedate', 'resolution'
        ];
        
        // Add discovered custom fields
        Object.values(mapping).forEach(fieldId => {
            if (fieldId && !baseFields.includes(fieldId)) {
                baseFields.push(fieldId);
            }
        });
        
        return baseFields.join(',');
    }
    
    // Extract customer priority from issue
    extractCustomerPriority(issue) {
        if (!this.fieldMap || !this.fieldMap.customerPriority) {
            return null;
        }
        
        const fieldValue = issue.fields[this.fieldMap.customerPriority];
        
        // Handle different field types
        if (!fieldValue) return null;
        
        // Option field (dropdown)
        if (fieldValue.value) return fieldValue.value;
        
        // Simple string field
        if (typeof fieldValue === 'string') return fieldValue;
        
        // Array field (multi-select)
        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            return fieldValue[0].value || fieldValue[0];
        }
        
        return null;
    }
    
    // Extract MGX priority from issue
    extractMgxPriority(issue) {
        if (!this.fieldMap || !this.fieldMap.mgxPriority) {
            return null;
        }
        
        const fieldValue = issue.fields[this.fieldMap.mgxPriority];
        
        // Handle different field types
        if (!fieldValue) return null;
        
        // Option field (dropdown)
        if (fieldValue.value) return fieldValue.value;
        
        // Simple string field
        if (typeof fieldValue === 'string') return fieldValue;
        
        // Array field (multi-select)
        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            return fieldValue[0].value || fieldValue[0];
        }
        
        return null;
    }
}

module.exports = JiraFieldMapper;