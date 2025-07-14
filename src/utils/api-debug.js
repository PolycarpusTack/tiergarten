// Enhanced API utility with better error handling for debugging JSON parse issues
import { API_BASE } from './api-config';

// Helper to check if response is JSON
const isJsonResponse = (response) => {
    const contentType = response.headers.get('content-type');
    return contentType && contentType.includes('application/json');
};

// Enhanced fetch with better error handling
const fetchWithDebug = async (url, options = {}) => {
    console.log(`[API] Fetching: ${url}`, options);
    
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            body: options.body,
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'omit',
            headers: options.headers || {}
        });
        
        console.log(`[API] Response from ${url}:`, {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            ok: response.ok
        });
        
        // Clone response to read it twice if needed
        const responseClone = response.clone();
        
        // Check if response is JSON
        if (!isJsonResponse(response)) {
            const text = await responseClone.text();
            console.error(`[API] Non-JSON response from ${url}:`, text.substring(0, 500));
            throw new Error(`Expected JSON response but got ${response.headers.get('content-type')}`);
        }
        
        // Try to parse JSON
        try {
            const data = await response.json();
            return { ok: response.ok, status: response.status, data };
        } catch (jsonError) {
            const text = await responseClone.text();
            console.error(`[API] JSON parse error for ${url}:`, jsonError);
            console.error(`[API] Response body:`, text.substring(0, 500));
            throw new Error(`Invalid JSON response: ${jsonError.message}`);
        }
    } catch (error) {
        console.error(`[API] Network/fetch error for ${url}:`, error);
        throw error;
    }
};

// Export the debug function for use in App.js
export { fetchWithDebug, API_BASE };

// API methods with enhanced error handling
export const debugApi = {
    async getTickets() {
        try {
            const result = await fetchWithDebug(`${API_BASE}/tickets`);
            if (!result.ok) throw new Error(`Failed to fetch tickets: ${result.status}`);
            return result.data;
        } catch (error) {
            console.error('[API] Error fetching tickets:', error);
            throw error;
        }
    },
    
    async getDashboards() {
        try {
            const result = await fetchWithDebug(`${API_BASE}/dashboards`);
            if (!result.ok) throw new Error(`Failed to fetch dashboards: ${result.status}`);
            return result.data;
        } catch (error) {
            console.error('[API] Error fetching dashboards:', error);
            throw error;
        }
    },
    
    async getClients() {
        try {
            const result = await fetchWithDebug(`${API_BASE}/clients`);
            if (!result.ok) throw new Error(`Failed to fetch clients: ${result.status}`);
            return result.data;
        } catch (error) {
            console.error('[API] Error fetching clients:', error);
            throw error;
        }
    },
    
    async getGlobalRules() {
        try {
            const result = await fetchWithDebug(`${API_BASE}/global-rules`);
            if (!result.ok) throw new Error(`Failed to fetch global rules: ${result.status}`);
            return result.data;
        } catch (error) {
            console.error('[API] Error fetching global rules:', error);
            throw error;
        }
    }
};