import React, { useState, useEffect } from 'react';
import JiraConfig2FilterTab from './JiraConfig2FilterTab';
import JiraConfig2FieldMapping from './JiraConfig2FieldMapping';
import JiraConfig2ImportWizard from './JiraConfig2ImportWizard';

const JiraConfig2Modal = ({ isOpen, onClose, api }) => {
    const [activeTab, setActiveTab] = useState('configurations');
    const [showImportWizard, setShowImportWizard] = useState(false);
    const [configurations, setConfigurations] = useState([]);
    const [selectedConfig, setSelectedConfig] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Configuration form state
    const [configForm, setConfigForm] = useState({
        name: '',
        description: '',
        connectionSettings: {
            baseUrl: '',
            email: '',
            apiToken: ''
        }
    });

    // Filter settings state
    const [filterSettings, setFilterSettings] = useState({
        dateRange: { type: 'days', value: 30 },
        ticketTypes: [],
        ticketStatuses: [],
        priorities: [],
        additionalFilters: {
            onlyUnassigned: false,
            hasAttachments: false,
            hasComments: false,
            recentlyUpdated: false
        },
        customJQL: ''
    });

    // Field mappings state
    const [fieldMappings, setFieldMappings] = useState([]);
    const [availableFields, setAvailableFields] = useState({
        standard: [],
        custom: [],
        system: []
    });

    // Load configurations on mount
    useEffect(() => {
        if (isOpen) {
            loadConfigurations();
        }
    }, [isOpen]);

    const loadConfigurations = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/jira/config2');
            if (response.ok) {
                const configs = await response.json();
                setConfigurations(configs);
            }
        } catch (err) {
            setError('Failed to load configurations');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateConfig = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/jira/config2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...configForm,
                    filterSettings,
                    fieldMappings: {},
                    importSettings: {}
                })
            });

            if (response.ok) {
                const result = await response.json();
                await loadConfigurations();
                setIsCreating(false);
                setConfigForm({
                    name: '',
                    description: '',
                    connectionSettings: { baseUrl: '', email: '', apiToken: '' }
                });
            } else {
                throw new Error('Failed to create configuration');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTestConnection = async () => {
        try {
            setLoading(true);
            const { baseUrl, email, apiToken } = configForm.connectionSettings;
            
            const response = await fetch('/api/jira/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseUrl, email, apiToken })
            });

            if (response.ok) {
                setError(null);
                alert('Connection successful!');
            } else {
                throw new Error('Connection failed');
            }
        } catch (err) {
            setError('Failed to connect to JIRA');
        } finally {
            setLoading(false);
        }
    };

    const handleDiscoverFields = async (configId) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/jira/config2/${configId}/discover-fields`);
            if (response.ok) {
                const fields = await response.json();
                setAvailableFields(fields);
                setActiveTab('mapping');
            }
        } catch (err) {
            setError('Failed to discover fields');
        } finally {
            setLoading(false);
        }
    };

    const renderConfigurationsList = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Configurations
                </h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Create New
                </button>
            </div>

            {loading ? (
                <div className="text-center py-8">Loading...</div>
            ) : configurations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    No configurations yet. Create your first configuration.
                </div>
            ) : (
                <div className="space-y-2">
                    {configurations.map(config => (
                        <div
                            key={config.id}
                            className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                            onClick={() => setSelectedConfig(config)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white">
                                        {config.name}
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {config.description}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {config.is_active && (
                                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                            Active
                                        </span>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDiscoverFields(config.id);
                                        }}
                                        className="text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        Configure
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedConfig(config);
                                            setShowImportWizard(true);
                                        }}
                                        className="text-sm text-green-600 hover:text-green-700"
                                    >
                                        Import
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderCreateForm = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Create Configuration
                </h3>
                <button
                    onClick={() => setIsCreating(false)}
                    className="text-gray-400 hover:text-gray-500"
                >
                    Cancel
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Configuration Name
                    </label>
                    <input
                        type="text"
                        value={configForm.name}
                        onChange={(e) => setConfigForm({...configForm, name: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Production Import"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Description
                    </label>
                    <textarea
                        value={configForm.description}
                        onChange={(e) => setConfigForm({...configForm, description: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        rows={2}
                        placeholder="Configuration for importing production JIRA tickets"
                    />
                </div>

                <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                        Connection Settings
                    </h4>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                JIRA Base URL
                            </label>
                            <input
                                type="url"
                                value={configForm.connectionSettings.baseUrl}
                                onChange={(e) => setConfigForm({
                                    ...configForm,
                                    connectionSettings: {
                                        ...configForm.connectionSettings,
                                        baseUrl: e.target.value
                                    }
                                })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                placeholder="https://company.atlassian.net"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email
                            </label>
                            <input
                                type="email"
                                value={configForm.connectionSettings.email}
                                onChange={(e) => setConfigForm({
                                    ...configForm,
                                    connectionSettings: {
                                        ...configForm.connectionSettings,
                                        email: e.target.value
                                    }
                                })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                placeholder="user@company.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                API Token
                            </label>
                            <input
                                type="password"
                                value={configForm.connectionSettings.apiToken}
                                onChange={(e) => setConfigForm({
                                    ...configForm,
                                    connectionSettings: {
                                        ...configForm.connectionSettings,
                                        apiToken: e.target.value
                                    }
                                })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                placeholder="Your JIRA API token"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex space-x-3">
                        <button
                            onClick={handleTestConnection}
                            disabled={loading}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Test Connection
                        </button>
                        <button
                            onClick={handleCreateConfig}
                            disabled={loading || !configForm.name || !configForm.connectionSettings.baseUrl}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            Create Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const handleSaveFilterSettings = async () => {
        if (!selectedConfig) return;
        
        try {
            const response = await fetch(`/api/jira/config2/${selectedConfig.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filterSettings })
            });
            
            if (response.ok) {
                alert('Filter settings saved!');
            }
        } catch (error) {
            console.error('Error saving filter settings:', error);
        }
    };

    const renderFiltersTab = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Filters
            </h3>

            {/* Date Range */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date Range
                </label>
                <div className="space-y-2">
                    <label className="flex items-center">
                        <input
                            type="radio"
                            checked={filterSettings.dateRange.type === 'days'}
                            onChange={() => setFilterSettings({
                                ...filterSettings,
                                dateRange: { type: 'days', value: 30 }
                            })}
                            className="mr-2"
                        />
                        Last {filterSettings.dateRange.type === 'days' && (
                            <input
                                type="number"
                                value={filterSettings.dateRange.value}
                                onChange={(e) => setFilterSettings({
                                    ...filterSettings,
                                    dateRange: { type: 'days', value: parseInt(e.target.value) }
                                })}
                                className="mx-2 w-16 rounded border-gray-300"
                            />
                        )} days
                    </label>
                    <label className="flex items-center">
                        <input
                            type="radio"
                            checked={filterSettings.dateRange.type === 'all'}
                            onChange={() => setFilterSettings({
                                ...filterSettings,
                                dateRange: { type: 'all' }
                            })}
                            className="mr-2"
                        />
                        All tickets
                    </label>
                </div>
            </div>

            {/* Ticket Types */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ticket Types
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {['Bug', 'Task', 'Story', 'Epic', 'Sub-task', 'Improvement'].map(type => (
                        <label key={type} className="flex items-center">
                            <input
                                type="checkbox"
                                checked={filterSettings.ticketTypes.includes(type)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setFilterSettings({
                                            ...filterSettings,
                                            ticketTypes: [...filterSettings.ticketTypes, type]
                                        });
                                    } else {
                                        setFilterSettings({
                                            ...filterSettings,
                                            ticketTypes: filterSettings.ticketTypes.filter(t => t !== type)
                                        });
                                    }
                                }}
                                className="mr-2"
                            />
                            {type}
                        </label>
                    ))}
                </div>
            </div>

            {/* Additional Filters */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Additional Filters
                </label>
                <div className="space-y-2">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={filterSettings.additionalFilters.onlyUnassigned}
                            onChange={(e) => setFilterSettings({
                                ...filterSettings,
                                additionalFilters: {
                                    ...filterSettings.additionalFilters,
                                    onlyUnassigned: e.target.checked
                                }
                            })}
                            className="mr-2"
                        />
                        Only unassigned tickets
                    </label>
                </div>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        JIRA Configuration 2.0
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {!isCreating && !selectedConfig && (
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button
                            className={`px-6 py-3 font-medium ${
                                activeTab === 'configurations'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            onClick={() => setActiveTab('configurations')}
                        >
                            Configurations
                        </button>
                        <button
                            className={`px-6 py-3 font-medium ${
                                activeTab === 'filters'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            onClick={() => setActiveTab('filters')}
                        >
                            Filters
                        </button>
                        <button
                            className={`px-6 py-3 font-medium ${
                                activeTab === 'mapping'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            onClick={() => setActiveTab('mapping')}
                        >
                            Field Mapping
                        </button>
                    </div>
                )}

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {isCreating ? renderCreateForm() : (
                        <>
                            {activeTab === 'configurations' && renderConfigurationsList()}
                            {activeTab === 'filters' && selectedConfig && (
                                <JiraConfig2FilterTab
                                    configId={selectedConfig.id}
                                    filterSettings={filterSettings}
                                    setFilterSettings={setFilterSettings}
                                    onSave={handleSaveFilterSettings}
                                />
                            )}
                            {activeTab === 'mapping' && selectedConfig && (
                                <JiraConfig2FieldMapping
                                    configId={selectedConfig.id}
                                    onSave={() => alert('Mappings saved!')}
                                />
                            )}
                            {!selectedConfig && activeTab !== 'configurations' && (
                                <div className="text-center py-8 text-gray-500">
                                    Please select a configuration first
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            
            {/* Import Wizard */}
            {showImportWizard && selectedConfig && (
                <JiraConfig2ImportWizard
                    configId={selectedConfig.id}
                    onClose={() => setShowImportWizard(false)}
                    onImportComplete={() => {
                        setShowImportWizard(false);
                        alert('Import completed successfully!');
                    }}
                />
            )}
        </div>
    );
};

export default JiraConfig2Modal;