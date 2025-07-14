import React, { useState, useEffect } from 'react';

const JiraConfigurationSimple = ({ api, onConfigured }) => {
    const [config, setConfig] = useState({
        baseUrl: '',
        email: '',
        apiToken: ''
    });
    const [existingConfig, setExistingConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/jira/config');
            const data = await response.json();
            
            if (data.configured) {
                setExistingConfig(data);
                setConfig({
                    baseUrl: data.baseUrl || '',
                    email: data.email || '',
                    apiToken: '' // Don't show existing token
                });
            }
        } catch (err) {
            console.error('Error loading config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            // Save config first if new
            if (!existingConfig || 
                config.baseUrl !== existingConfig.baseUrl || 
                config.email !== existingConfig.email || 
                config.apiToken) {
                
                const saveResponse = await fetch('/api/jira/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });

                if (!saveResponse.ok) {
                    const error = await saveResponse.json();
                    throw new Error(error.error || 'Failed to save configuration');
                }
            }

            // Test connection
            const testResponse = await fetch('/api/jira/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await testResponse.json();
            setTestResult(result);

            if (result.success) {
                await loadConfig(); // Reload to get updated config
                if (onConfigured) onConfigured();
            }
        } catch (err) {
            setTestResult({ success: false, error: err.message });
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                JIRA Configuration
            </h3>
            
            {existingConfig && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                        ✓ JIRA is configured. Leave API token empty to keep existing token.
                    </p>
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        JIRA Base URL
                    </label>
                    <input
                        type="url"
                        value={config.baseUrl}
                        onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                        placeholder="https://your-company.atlassian.net"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        disabled={testing}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        value={config.email}
                        onChange={(e) => setConfig({ ...config, email: e.target.value })}
                        placeholder="your-email@company.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        disabled={testing}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Token
                        <a 
                            href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 dark:text-blue-400 text-xs hover:underline"
                        >
                            Get API Token
                        </a>
                    </label>
                    <input
                        type="password"
                        value={config.apiToken}
                        onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
                        placeholder={existingConfig ? "Leave empty to keep existing token" : "Enter your API token"}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        disabled={testing}
                    />
                </div>

                <button
                    onClick={handleTest}
                    disabled={testing || !config.baseUrl || !config.email || (!config.apiToken && !existingConfig)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {testing ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Testing Connection...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Test & Save Configuration
                        </>
                    )}
                </button>
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                    testResult.success 
                        ? 'bg-green-50 dark:bg-green-900/20' 
                        : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                    {testResult.success ? (
                        <div>
                            <p className="text-green-700 dark:text-green-300 font-medium flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Connection Successful!
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                Connected as: {testResult.user?.displayName} ({testResult.user?.email})
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-red-700 dark:text-red-300 font-medium flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Connection Failed
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                {testResult.error}
                            </p>
                            {testResult.details && (
                                <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                                    {testResult.details}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default JiraConfigurationSimple;