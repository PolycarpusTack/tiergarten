const axios = require('axios');
require('dotenv').config();

const jiraBaseUrl = process.env.JIRA_BASE_URL;
const jiraEmail = process.env.JIRA_EMAIL;
const jiraApiToken = process.env.JIRA_API_TOKEN;

if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
    console.log('JIRA credentials not configured. Please check your .env file.');
    process.exit(1);
}

const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');

async function getJiraFields() {
    try {
        // Get all fields
        const fieldsResponse = await axios.get(`${jiraBaseUrl}/rest/api/3/field`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });

        console.log('=== JIRA FIELDS CONFIGURATION ===\n');
        
        // Filter for custom fields and important standard fields
        const relevantFields = fieldsResponse.data.filter(field => 
            field.custom || 
            ['priority', 'status', 'issuetype', 'components', 'labels', 'assignee', 'reporter'].includes(field.key)
        );

        for (const field of relevantFields) {
            console.log(`Field: ${field.name}`);
            console.log(`  Key: ${field.key}`);
            console.log(`  ID: ${field.id}`);
            console.log(`  Type: ${field.schema?.type || 'N/A'}`);
            console.log(`  Custom: ${field.custom ? 'Yes' : 'No'}`);
            
            // Try to get allowed values for select fields
            if (field.schema?.type === 'option' || (field.schema?.type === 'array' && field.schema?.items === 'option')) {
                try {
                    const contextResponse = await axios.get(`${jiraBaseUrl}/rest/api/3/field/${field.id}/context`, {
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (contextResponse.data.values && contextResponse.data.values.length > 0) {
                        const contextId = contextResponse.data.values[0].id;
                        const optionsResponse = await axios.get(`${jiraBaseUrl}/rest/api/3/field/${field.id}/context/${contextId}/option`, {
                            headers: {
                                'Authorization': `Basic ${auth}`,
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (optionsResponse.data.values && optionsResponse.data.values.length > 0) {
                            console.log('  Allowed Values:');
                            optionsResponse.data.values.forEach(value => {
                                console.log(`    - ${value.value}`);
                            });
                        }
                    }
                } catch (e) {
                    // Field might not have predefined values
                }
            }
            console.log('');
        }

        // Get priority values
        console.log('\n=== PRIORITY VALUES ===');
        const prioritiesResponse = await axios.get(`${jiraBaseUrl}/rest/api/3/priority`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });
        
        prioritiesResponse.data.forEach(priority => {
            console.log(`  - ${priority.name} (ID: ${priority.id})`);
        });

        // Get status values
        console.log('\n=== STATUS VALUES ===');
        const statusesResponse = await axios.get(`${jiraBaseUrl}/rest/api/3/status`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });
        
        const uniqueStatuses = {};
        statusesResponse.data.forEach(status => {
            if (!uniqueStatuses[status.name]) {
                uniqueStatuses[status.name] = status;
                console.log(`  - ${status.name} (Category: ${status.statusCategory.name})`);
            }
        });

        // Get issue types
        console.log('\n=== ISSUE TYPES ===');
        const issueTypesResponse = await axios.get(`${jiraBaseUrl}/rest/api/3/issuetype`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });
        
        issueTypesResponse.data.forEach(type => {
            if (!type.subtask) {
                console.log(`  - ${type.name} (ID: ${type.id})`);
            }
        });

        // Look for specific custom fields that might be relevant
        console.log('\n=== POTENTIAL CUSTOM FIELDS FOR TIERGARTEN ===');
        const customFields = fieldsResponse.data.filter(field => field.custom);
        
        const interestingPatterns = ['priority', 'tier', 'sla', 'customer', 'mgx', 'ca', 'action', 'category', 'type'];
        
        customFields.forEach(field => {
            const nameLower = field.name.toLowerCase();
            if (interestingPatterns.some(pattern => nameLower.includes(pattern))) {
                console.log(`\nPotentially Relevant: ${field.name}`);
                console.log(`  Key: ${field.key}`);
                console.log(`  ID: ${field.id}`);
                console.log(`  Type: ${field.schema?.type || 'N/A'}`);
            }
        });

    } catch (error) {
        console.error('Error fetching JIRA fields:', error.response?.data || error.message);
    }
}

getJiraFields();