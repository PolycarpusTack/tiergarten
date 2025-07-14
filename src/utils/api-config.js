// API configuration that handles both development and Electron production environments

// Detect if we're running in Electron
const isElectron = window && window.process && window.process.type;

// Determine the API base URL
const getApiBase = () => {
    // If REACT_APP_API_URL is set, use it
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }
    
    // If running in Electron, always use localhost:3600
    if (isElectron) {
        return 'http://localhost:3600/api';
    }
    
    // In development, always use the proxy to avoid CORS issues
    if (process.env.NODE_ENV === 'development') {
        // Always use relative path to leverage setupProxy.js
        console.log('[API Config] Development mode - using proxy');
        return '/api';
    }
    
    // In production web build, use the same origin
    return `${window.location.origin}/api`;
};

export const API_BASE = getApiBase();

console.log('[API Config] Environment:', {
    isElectron,
    nodeEnv: process.env.NODE_ENV,
    apiBase: API_BASE,
    origin: window.location.origin,
    protocol: window.location.protocol
});