// Add these API methods to your existing api object in App.js

const peopleApi = {
    // People CRUD operations
    async getPeople(filters = {}) {
        try {
            const params = new URLSearchParams();
            if (filters.active !== undefined) params.append('active', filters.active);
            if (filters.specialization) params.append('specialization', filters.specialization);
            if (filters.search) params.append('search', filters.search);
            
            const url = `${API_BASE}/people${params.toString() ? '?' + params.toString() : ''}`;
            const response = await fetchWithOptions(url);
            if (!response.ok) throw new Error('Failed to fetch people');
            return response.json();
        } catch (error) {
            console.error('Error fetching people:', error);
            return [];
        }
    },

    async getPerson(id) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/${id}`);
            if (!response.ok) throw new Error('Failed to fetch person');
            return response.json();
        } catch (error) {
            console.error('Error fetching person:', error);
            throw error;
        }
    },

    async savePerson(personData) {
        try {
            const url = personData.id 
                ? `${API_BASE}/people/${personData.id}` 
                : `${API_BASE}/people`;
            const method = personData.id ? 'PUT' : 'POST';
            
            const response = await fetchWithOptions(url, {
                method,
                body: JSON.stringify(personData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response:', response.status, errorText);
                throw new Error(`Failed to save person: ${response.status} ${errorText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error saving person:', error);
            throw error;
        }
    },

    async deletePerson(personId) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/${personId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete person: ${errorText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error deleting person:', error);
            throw error;
        }
    },

    async getPersonLoad(personId) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/${personId}/load`);
            if (!response.ok) throw new Error('Failed to fetch person load');
            return response.json();
        } catch (error) {
            console.error('Error fetching person load:', error);
            throw error;
        }
    },

    // Custom fields configuration
    async getPeopleFields() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/fields`);
            if (!response.ok) throw new Error('Failed to fetch custom fields');
            return response.json();
        } catch (error) {
            console.error('Error fetching custom fields:', error);
            return [];
        }
    },

    async createPeopleField(fieldData) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/fields`, {
                method: 'POST',
                body: JSON.stringify(fieldData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create field: ${errorText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error creating field:', error);
            throw error;
        }
    },

    async updatePeopleField(fieldId, fieldData) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/fields/${fieldId}`, {
                method: 'PUT',
                body: JSON.stringify(fieldData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update field: ${errorText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error updating field:', error);
            throw error;
        }
    },

    async deletePeopleField(fieldId) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/fields/${fieldId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete field: ${errorText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error deleting field:', error);
            throw error;
        }
    },

    // People configuration
    async getPeopleConfig() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/config`);
            if (!response.ok) throw new Error('Failed to fetch people config');
            const config = await response.json();
            return {
                expertiseConfig: config.expertise_config ? JSON.parse(config.expertise_config) : {
                    calculationPeriod: 'months',
                    periodValue: 6,
                    thresholds: {
                        expert: 100,
                        intermediate: 40,
                        novice: 0
                    }
                },
                capacityConfig: config.capacity_config ? JSON.parse(config.capacity_config) : {}
            };
        } catch (error) {
            console.error('Error fetching people config:', error);
            return {
                expertiseConfig: {
                    calculationPeriod: 'months',
                    periodValue: 6,
                    thresholds: {
                        expert: 100,
                        intermediate: 40,
                        novice: 0
                    }
                },
                capacityConfig: {}
            };
        }
    },

    async updatePeopleConfig(config) {
        try {
            const response = await fetchWithOptions(`${API_BASE}/people/config`, {
                method: 'PUT',
                body: JSON.stringify({
                    expertise_config: JSON.stringify(config.expertiseConfig),
                    capacity_config: JSON.stringify(config.capacityConfig || {})
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update config: ${errorText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Error updating people config:', error);
            throw error;
        }
    },

    // Capacity pools and utilization
    async getCapacityPools() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/capacity/pools`);
            if (!response.ok) throw new Error('Failed to fetch capacity pools');
            return response.json();
        } catch (error) {
            console.error('Error fetching capacity pools:', error);
            return [];
        }
    },

    async getCapacityUtilization() {
        try {
            const response = await fetchWithOptions(`${API_BASE}/capacity/utilization`);
            if (!response.ok) throw new Error('Failed to fetch capacity utilization');
            return response.json();
        } catch (error) {
            console.error('Error fetching capacity utilization:', error);
            return null;
        }
    },

    async getCapacityRecommendations(action) {
        try {
            const params = action ? `?action=${action}` : '';
            const response = await fetchWithOptions(`${API_BASE}/capacity/recommendations${params}`);
            if (!response.ok) throw new Error('Failed to fetch capacity recommendations');
            return response.json();
        } catch (error) {
            console.error('Error fetching capacity recommendations:', error);
            return [];
        }
    }
};

// Merge with existing api object
const api = {
    // ... existing api methods ...
    
    // Add all people API methods
    ...peopleApi
};