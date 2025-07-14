import React from 'react';
import AppV2 from './components/V2/AppV2';
import { API_BASE } from './utils/api-config';

// Helper function for fetch with standard options
const fetchWithOptions = (url, options = {}) => {
    console.log(`Fetching: ${url}`, options);
    
    // Minimal headers to avoid 431 error
    const headers = {};
    if (options.method && options.method !== 'GET') {
        headers['Content-Type'] = 'application/json';
    }
    
    return fetch(url, {
        method: options.method || 'GET',
        body: options.body,
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        headers: headers
    }).then(response => {
        console.log(`Response from ${url}:`, response.status, response.statusText);
        return response;
    }).catch(error => {
        console.error(`Network error for ${url}:`, error);
        throw error;
    });
};

// API Service
const api = {
    async getTickets() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/tickets`);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response from /tickets:', text.substring(0, 200));
                throw new Error('Server returned non-JSON response');
            }
            
            const data = await response.json();
            
            // Check if the response contains JIRA error info
            if (!response.ok && data.error && data.type) {
                throw data; // Throw the error object to be caught by loadTickets
            }
            
            if (!response.ok) throw new Error('Failed to fetch tickets');
            
            return data;
        } catch (error) {
            console.error('Error fetching tickets:', error);
            // Re-throw if it's a JIRA error
            if (error.error && error.type) {
                throw error;
            }
            // Return empty data if API fails
            return { exceptions: [], regularTickets: [] };
        }
    },
    
    async getClients() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/clients`);
            if (!response.ok) throw new Error('Failed to fetch clients');
            return response.json();
        } catch (error) {
            console.error('Error fetching clients:', error);
            return [];
        }
    },
    
    async saveClient(clientData) {
        try {
            const url = clientData.id ? `${API_BASE}/clients/${clientData.id}` : `${API_BASE}/clients`;
            const method = clientData.id ? 'PUT' : 'POST';
            
            const response = await fetchWithOptions(url, {
                method,
                body: JSON.stringify(clientData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response:', response.status, errorText);
                throw new Error(`Failed to save client: ${response.status} ${errorText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error saving client:', error);
            throw error;
        }
    },
    
    async deleteClient(clientId) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/clients/${clientId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete client');
            return response.json();
        } catch (error) {
            console.error('Error deleting client:', error);
            throw error;
        }
    },
    
    async getGlobalRules() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/global-rules`);
            if (!response.ok) throw new Error('Failed to fetch global rules');
            return response.json();
        } catch (error) {
            console.error('Error fetching global rules:', error);
            return [];
        }
    },
    
    async saveGlobalRule(ruleData) {
        try {
            const url = ruleData.id ? `${API_BASE}/global-rules/${ruleData.id}` : `${API_BASE}/global-rules`;
            const method = ruleData.id ? 'PUT' : 'POST';
            
            const response = await fetchWithOptions(url, {
                method,
                body: JSON.stringify(ruleData)
            });
            
            if (!response.ok) throw new Error('Failed to save global rule');
            return response.json();
        } catch (error) {
            console.error('Error saving global rule:', error);
            throw error;
        }
    },
    
    async deleteGlobalRule(ruleId) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/global-rules/${ruleId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete global rule');
            return response.json();
        } catch (error) {
            console.error('Error deleting global rule:', error);
            throw error;
        }
    },
    
    async getJiraProjects() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/jira/projects`);
            if (!response.ok) throw new Error('Failed to fetch JIRA projects');
            return response.json();
        } catch (error) {
            console.error('Error fetching JIRA projects:', error);
            return [];
        }
    },
    
    async getDashboards() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/dashboards`);
            if (!response.ok) throw new Error('Failed to fetch dashboards');
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response from /dashboards:', text.substring(0, 200));
                throw new Error('Server returned non-JSON response');
            }
            
            return response.json();
        } catch (error) {
            console.error('Error fetching dashboards:', error);
            // Return default dashboards if API fails
            return [
                { id: 1, name: 'Overview', is_default: true, display_order: 1 },
                { id: 2, name: 'My Active Work', is_default: false, display_order: 2 },
                { id: 3, name: 'Planning View', is_default: false, display_order: 3 }
            ];
        }
    },
    
    async saveDashboard(dashboardData) {
        try {
            const url = dashboardData.id ? `${API_BASE}/dashboards/${dashboardData.id}` : `${API_BASE}/dashboards`;
            const method = dashboardData.id ? 'PUT' : 'POST';
            
            const response = await fetchWithOptions(url, {
                method,
                body: JSON.stringify(dashboardData)
            });
            
            if (!response.ok) throw new Error('Failed to save dashboard');
            return response.json();
        } catch (error) {
            console.error('Error saving dashboard:', error);
            throw error;
        }
    },
    
    async deleteDashboard(dashboardId) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/dashboards/${dashboardId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete dashboard');
            return response.json();
        } catch (error) {
            console.error('Error deleting dashboard:', error);
            throw error;
        }
    },
    
    async getWidgets(dashboardId) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/widgets?dashboard_id=${dashboardId}`);
            if (!response.ok) throw new Error('Failed to fetch widgets');
            return response.json();
        } catch (error) {
            console.error('Error fetching widgets:', error);
            return [];
        }
    },
    
    async saveWidget(widgetData) {
        try {
            const url = widgetData.id ? `${API_BASE}/widgets/${widgetData.id}` : `${API_BASE}/widgets`;
            const method = widgetData.id ? 'PUT' : 'POST';
            
            const response = await fetchWithOptions(url, {
                method,
                body: JSON.stringify(widgetData)
            });
            
            if (!response.ok) throw new Error('Failed to save widget');
            return response.json();
        } catch (error) {
            console.error('Error saving widget:', error);
            throw error;
        }
    },
    
    async deleteWidget(widgetId) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/widgets/${widgetId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete widget');
            return response.json();
        } catch (error) {
            console.error('Error deleting widget:', error);
            throw error;
        }
    },
    
    async clearGlobalRules() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/global-rules/clear`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Failed to clear global rules: ${response.status} ${errorData}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error clearing global rules:', error);
            throw error;
        }
    },
    
    async clearClients() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/clients/clear`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Failed to clear clients: ${response.status} ${errorData}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error clearing clients:', error);
            throw error;
        }
    },
    
    async clearWidgets(dashboardId) {
        try {
            const url = dashboardId ? 
                `${API_BASE}/widgets/clear?dashboard_id=${dashboardId}` : 
                `${API_BASE}/widgets/clear`;
            const response = await fetchWithOptions(url, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Failed to clear widgets: ${response.status} ${errorData}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error clearing widgets:', error);
            throw error;
        }
    },
    
    async updateTicketAction(ticketKey, action) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/tickets/${ticketKey}/action`, {
                method: 'PUT',
                body: JSON.stringify({ action })
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`Failed to update ticket action: ${response.status} ${response.statusText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error updating ticket action:', error);
            console.error('Ticket key:', ticketKey, 'Action:', action);
            throw error;
        }
    },
    
    async getImportConfig() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/import-config`);
            if (!response.ok) throw new Error('Failed to fetch import config');
            return response.json();
        } catch (error) {
            console.error('Error fetching import config:', error);
            return { excluded_projects: '[]', date_offset_days: 30 };
        }
    },
    
    async updateImportConfig(config) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/import-config`, {
                method: 'PUT',
                body: JSON.stringify(config)
            });
            if (!response.ok) throw new Error('Failed to update import config');
            return response.json();
        } catch (error) {
            console.error('Error updating import config:', error);
            throw error;
        }
    },
    
    async getJiraMetadata() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/jira/metadata`);
            if (!response.ok) throw new Error('Failed to fetch JIRA metadata');
            return response.json();
        } catch (error) {
            console.error('Error fetching JIRA metadata:', error);
            return { ticketTypes: [], ticketStatuses: [] };
        }
    },
    
    async getJiraCredentialsStatus() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/jira/credentials-status`);
            if (!response.ok) throw new Error('Failed to fetch credentials status');
            return response.json();
        } catch (error) {
            console.error('Error fetching credentials status:', error);
            return { isConfigured: false, jiraBaseUrl: '', jiraEmail: '' };
        }
    },
    
    async updateJiraCredentials(credentials) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/jira/credentials`, {
                method: 'PUT',
                body: JSON.stringify(credentials)
            });
            if (!response.ok) throw new Error('Failed to update credentials');
            return response.json();
        } catch (error) {
            console.error('Error updating credentials:', error);
            throw error;
        }
    },
    
    async testJiraConnection() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/jira/test-connection`);
            if (!response.ok) throw new Error('Connection test failed');
            return response.json();
        } catch (error) {
            console.error('Error testing connection:', error);
            throw error;
        }
    },
    
    async importTickets() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/jira/import-tickets`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Import failed');
            return response.json();
        } catch (error) {
            console.error('Error importing tickets:', error);
            throw error;
        }
    },
    
    async exportData() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/data/export`);
            if (!response.ok) throw new Error('Export failed');
            
            // Get the filename from Content-Disposition header
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'tiergarten-export.json';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) filename = filenameMatch[1];
            }
            
            // Download the file
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            
            return { success: true, filename };
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }
};

// Main App Component - Now just renders V2
export default function App() {
    return <AppV2 api={api} />;
}