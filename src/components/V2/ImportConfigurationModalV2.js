import React, { useState, useEffect, useCallback } from 'react';

const ImportConfigurationModalV2 = ({ api, onClose, onImport, existingClients }) => {
    const [activeTab, setActiveTab] = useState('connection');
    const [loading, setLoading] = useState(false);
    const [jiraProjects, setJiraProjects] = useState([]);
    const [projectSettings, setProjectSettings] = useState({});
    const [projectSearchQuery, setProjectSearchQuery] = useState('');
    
    // JIRA Connection State
    const [jiraConfig, setJiraConfig] = useState({
        baseUrl: '',
        email: '',
        apiToken: '',
        isConfigured: false
    });
    
    // Import Filters State
    const [importFilters, setImportFilters] = useState({
        dateOffsetDays: 30,
        dateOffsetMonths: 0,
        dateOffsetYears: 0,
        ticketTypes: [],
        selectedTicketTypes: [],
        ticketStatuses: [],
        selectedTicketStatuses: []
    });
    
    // Connection test result state
    const [connectionTestResult, setConnectionTestResult] = useState(null);
    
    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedConfig, setEditedConfig] = useState({
        baseUrl: '',
        email: '',
        apiToken: ''
    });

    const loadJiraProjects = useCallback(async () => {
        try {
            const projects = await api.getJiraProjects();
            setJiraProjects(projects);
            
            // Initialize project settings
            const settings = {};
            projects.forEach(project => {
                // Check if client already exists
                const existingClient = existingClients.find(
                    c => c.jiraProjectKey === project.key
                );
                
                settings[project.key] = {
                    importAsClient: !existingClient, // Don't import if already exists
                    importTickets: true,
                    tier: 3,
                    existsAsClient: !!existingClient,
                    clientId: existingClient?.id
                };
            });
            setProjectSettings(settings);
        } catch (error) {
            console.error('Error loading JIRA projects:', error);
        }
    }, [api, existingClients]);

    const loadConfiguration = useCallback(async () => {
        setLoading(true);
        try {
            // Load JIRA credentials status
            const credStatus = await api.getJiraCredentialsStatus();
            setJiraConfig({
                baseUrl: credStatus.jiraBaseUrl || '',
                email: credStatus.jiraEmail || '',
                apiToken: credStatus.isConfigured ? '********' : '',
                isConfigured: credStatus.isConfigured
            });

            // Load import configuration
            const importConfig = await api.getImportConfig();
            
            // Parse the date offset into D/M/Y
            const totalDays = importConfig.date_offset_days || 30;
            const years = Math.floor(totalDays / 365);
            const months = Math.floor((totalDays % 365) / 30);
            const days = totalDays % 30;

            // Load JIRA metadata
            const metadata = await api.getJiraMetadata();
            
            setImportFilters({
                dateOffsetDays: days,
                dateOffsetMonths: months,
                dateOffsetYears: years,
                ticketTypes: metadata.ticketTypes || ['Bug', 'Task', 'Story', 'Epic', 'Sub-task'],
                selectedTicketTypes: JSON.parse(importConfig.selected_ticket_types || '[]'),
                ticketStatuses: metadata.ticketStatuses || ['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened'],
                selectedTicketStatuses: JSON.parse(importConfig.selected_ticket_statuses || '[]')
            });

            // If configured, load projects
            if (credStatus.isConfigured) {
                await loadJiraProjects();
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
        setLoading(false);
    }, [api, loadJiraProjects]);

    // Load initial configuration
    useEffect(() => {
        loadConfiguration();
    }, [loadConfiguration]);


    const handleProjectToggle = (projectKey, field) => {
        setProjectSettings(prev => ({
            ...prev,
            [projectKey]: {
                ...prev[projectKey],
                [field]: !prev[projectKey][field]
            }
        }));
    };

    const handleTierChange = (projectKey, tier) => {
        setProjectSettings(prev => ({
            ...prev,
            [projectKey]: {
                ...prev[projectKey],
                tier: parseInt(tier)
            }
        }));
    };

    const handleSelectAll = () => {
        const newSettings = {};
        jiraProjects.forEach(project => {
            newSettings[project.key] = {
                ...projectSettings[project.key],
                importAsClient: !projectSettings[project.key].existsAsClient,
                importTickets: true
            };
        });
        setProjectSettings(newSettings);
    };

    const handleSelectNone = () => {
        const newSettings = {};
        jiraProjects.forEach(project => {
            newSettings[project.key] = {
                ...projectSettings[project.key],
                importAsClient: false,
                importTickets: false
            };
        });
        setProjectSettings(newSettings);
    };

    const handleSaveImportConfig = async () => {
        setLoading(true);
        try {
            // Calculate total days from D/M/Y
            const totalDays = importFilters.dateOffsetDays + 
                            (importFilters.dateOffsetMonths * 30) + 
                            (importFilters.dateOffsetYears * 365);
            
            await api.updateImportConfig({
                date_offset_days: totalDays,
                selected_ticket_types: JSON.stringify(importFilters.selectedTicketTypes),
                selected_ticket_statuses: JSON.stringify(importFilters.selectedTicketStatuses)
            });
            
            alert('Import configuration saved successfully!');
        } catch (error) {
            console.error('Failed to save import configuration:', error);
            alert('Failed to save import configuration. Please try again.');
        }
        setLoading(false);
    };

    const handleEditMode = () => {
        setIsEditMode(true);
        setEditedConfig({
            baseUrl: jiraConfig.baseUrl || '',
            email: jiraConfig.email || '',
            apiToken: ''
        });
        setConnectionTestResult(null);
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setEditedConfig({
            baseUrl: '',
            email: '',
            apiToken: ''
        });
    };

    const handleSaveCredentials = async () => {
        setLoading(true);
        try {
            await api.updateJiraCredentials({
                jiraBaseUrl: editedConfig.baseUrl,
                jiraEmail: editedConfig.email,
                jiraApiToken: editedConfig.apiToken
            });
            
            // Reload configuration after saving
            await loadConfiguration();
            setIsEditMode(false);
            setEditedConfig({
                baseUrl: '',
                email: '',
                apiToken: ''
            });
            
            alert('JIRA credentials saved successfully! The server will reload to apply changes.');
        } catch (error) {
            console.error('Failed to save credentials:', error);
            alert('Failed to save credentials. Please try again.');
        }
        setLoading(false);
    };

    const handleTestConnection = async () => {
        setLoading(true);
        setConnectionTestResult(null);
        try {
            const result = await api.testJiraConnection();
            setConnectionTestResult(result);
            if (result.success) {
                // Refresh credentials status after successful test
                const credStatus = await api.getJiraCredentialsStatus();
                setJiraConfig(prev => ({
                    ...prev,
                    isConfigured: credStatus.isConfigured
                }));
            }
        } catch (error) {
            console.error('Test connection error:', error);
            setConnectionTestResult({
                success: false,
                error: error.message || 'Connection failed'
            });
        }
        setLoading(false);
    };

    const handleImport = async () => {
        setLoading(true);
        
        try {
            // Calculate total days for date offset
            const totalDays = importFilters.dateOffsetDays + 
                            (importFilters.dateOffsetMonths * 30) + 
                            (importFilters.dateOffsetYears * 365);
            
            // First, update import configuration
            await api.updateImportConfig({
                date_offset_days: totalDays,
                excluded_projects: JSON.stringify(
                    jiraProjects
                        .filter(p => !projectSettings[p.key]?.importTickets)
                        .map(p => p.key)
                ),
                selected_ticket_types: JSON.stringify(importFilters.selectedTicketTypes),
                selected_ticket_statuses: JSON.stringify(importFilters.selectedTicketStatuses)
            });

            // Import clients
            const clientsToImport = jiraProjects.filter(
                p => projectSettings[p.key]?.importAsClient && !projectSettings[p.key]?.existsAsClient
            );

            for (const project of clientsToImport) {
                await api.saveClient({
                    name: project.name,
                    jiraProjectKey: project.key,
                    tier: projectSettings[project.key].tier,
                    isCA: false,
                    isException: false,
                    isGlobal: false
                });
            }

            // Update existing clients if tier changed
            const clientsToUpdate = jiraProjects.filter(
                p => projectSettings[p.key]?.existsAsClient && projectSettings[p.key]?.importAsClient
            );

            for (const project of clientsToUpdate) {
                const existingClient = existingClients.find(c => c.jiraProjectKey === project.key);
                if (existingClient && existingClient.tier !== projectSettings[project.key].tier) {
                    await api.saveClient({
                        ...existingClient,
                        tier: projectSettings[project.key].tier
                    });
                }
            }

            // Trigger ticket import - the backend will handle the actual import based on the configuration
            await api.importTickets();

            // Success notification
            alert('Import started successfully! Tickets will be imported based on your configuration.');

            onImport();
            onClose();
        } catch (error) {
            alert('Import failed: ' + error.message);
        }
        
        setLoading(false);
    };

    const renderConnectionTab = () => (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    JIRA Base URL
                </label>
                <input
                    type="text"
                    value={isEditMode ? editedConfig.baseUrl : jiraConfig.baseUrl}
                    onChange={isEditMode ? (e) => setEditedConfig({...editedConfig, baseUrl: e.target.value}) : undefined}
                    readOnly={!isEditMode}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${
                        isEditMode ? 'bg-white dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                    placeholder="https://your-domain.atlassian.net"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                </label>
                <input
                    type="email"
                    value={isEditMode ? editedConfig.email : jiraConfig.email}
                    onChange={isEditMode ? (e) => setEditedConfig({...editedConfig, email: e.target.value}) : undefined}
                    readOnly={!isEditMode}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${
                        isEditMode ? 'bg-white dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                    placeholder="your-email@example.com"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Token
                </label>
                <input
                    type="password"
                    value={isEditMode ? editedConfig.apiToken : jiraConfig.apiToken}
                    onChange={isEditMode ? (e) => setEditedConfig({...editedConfig, apiToken: e.target.value}) : undefined}
                    readOnly={!isEditMode}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${
                        isEditMode ? 'bg-white dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                    placeholder={isEditMode ? "Enter your API token" : "••••••••"}
                />
            </div>
            
            <div className="pt-4 space-y-2">
                {isEditMode ? (
                    <>
                        <button
                            onClick={handleSaveCredentials}
                            disabled={loading || !editedConfig.baseUrl || !editedConfig.email || !editedConfig.apiToken}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Save Credentials
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleCancelEdit}
                            disabled={loading}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={handleTestConnection}
                            disabled={loading || !jiraConfig.baseUrl || !jiraConfig.email}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Testing Connection...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Test Connection
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleEditMode}
                            disabled={loading}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit Credentials
                        </button>
                    </>
                )}
            </div>
            
            {/* Connection Test Result */}
            {connectionTestResult && (
                <div className={`p-4 rounded-lg ${
                    connectionTestResult.success 
                        ? 'bg-green-50 dark:bg-green-900/20' 
                        : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                    {connectionTestResult.success ? (
                        <div>
                            <p className="text-green-700 dark:text-green-300 flex items-center font-medium">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Connection Successful!
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400 mt-1 ml-7">
                                Connected as: {connectionTestResult.user} ({connectionTestResult.email})
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-red-700 dark:text-red-300 flex items-center font-medium">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Connection Failed
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1 ml-7">
                                {connectionTestResult.error}
                            </p>
                            {connectionTestResult.details && (
                                <p className="text-xs text-red-500 dark:text-red-500 mt-1 ml-7">
                                    {connectionTestResult.details}
                                </p>
                            )}
                            {connectionTestResult.suggestion && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-7 italic">
                                    💡 {connectionTestResult.suggestion}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* Configuration Status */}
            {!connectionTestResult && (
                jiraConfig.isConfigured ? (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-green-700 dark:text-green-300 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            JIRA connection is configured
                        </p>
                    </div>
                ) : (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                            JIRA credentials are not configured
                        </p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                            Click "Edit Credentials" above to add your JIRA connection details
                        </p>
                    </div>
                )
            )}
        </div>
    );

    const renderProjectsTab = () => {
        // Filter projects based on search query
        const filteredProjects = jiraProjects.filter(project => {
            const searchLower = projectSearchQuery.toLowerCase();
            return project.name.toLowerCase().includes(searchLower) || 
                   project.key.toLowerCase().includes(searchLower);
        });

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <div className="flex gap-2 ml-4">
                        <button
                            onClick={handleSelectAll}
                            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            Select All
                        </button>
                        <button
                            onClick={handleSelectNone}
                            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            Select None
                        </button>
                    </div>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredProjects.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            {projectSearchQuery ? 'No projects match your search' : 'No projects available'}
                        </div>
                    ) : (
                        filteredProjects.map(project => {
                    const settings = projectSettings[project.key] || {};
                    return (
                        <div
                            key={project.key}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                            <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                {project.name} ({project.key})
                            </div>
                            
                            <div className="space-y-2">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.importAsClient || false}
                                        onChange={() => handleProjectToggle(project.key, 'importAsClient')}
                                        disabled={settings.existsAsClient}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                        Import as Client
                                        {settings.existsAsClient && (
                                            <span className="ml-2 text-green-600 dark:text-green-400">
                                                (Already exists)
                                            </span>
                                        )}
                                    </span>
                                    {(settings.importAsClient || settings.existsAsClient) && (
                                        <select
                                            value={settings.tier || 3}
                                            onChange={(e) => handleTierChange(project.key, e.target.value)}
                                            className="ml-4 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                                        >
                                            <option value="1">Tier 1</option>
                                            <option value="2">Tier 2</option>
                                            <option value="3">Tier 3</option>
                                        </select>
                                    )}
                                </label>
                                
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.importTickets || false}
                                        onChange={() => handleProjectToggle(project.key, 'importTickets')}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                        Import Tickets from this Project
                                    </span>
                                </label>
                            </div>
                        </div>
                    );
                        })
                    )}
                </div>
            </div>
        );
    };

    const renderFiltersTab = () => (
        <div className="space-y-6">
            {/* Date Range Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Import tickets created in the last
                </label>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Days</label>
                        <input
                            type="number"
                            value={importFilters.dateOffsetDays}
                            onChange={(e) => setImportFilters({...importFilters, dateOffsetDays: parseInt(e.target.value) || 0})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            min="0"
                            max="365"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Months</label>
                        <input
                            type="number"
                            value={importFilters.dateOffsetMonths}
                            onChange={(e) => setImportFilters({...importFilters, dateOffsetMonths: parseInt(e.target.value) || 0})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            min="0"
                            max="12"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Years</label>
                        <input
                            type="number"
                            value={importFilters.dateOffsetYears}
                            onChange={(e) => setImportFilters({...importFilters, dateOffsetYears: parseInt(e.target.value) || 0})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            min="0"
                            max="10"
                        />
                    </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Total: {importFilters.dateOffsetYears} year(s), {importFilters.dateOffsetMonths} month(s), and {importFilters.dateOffsetDays} day(s)
                </p>
            </div>
            
            {/* Ticket Types Section */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ticket Types to Import
                </label>
                {importFilters.ticketTypes.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="mb-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={importFilters.selectedTicketTypes.length === 0}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setImportFilters({...importFilters, selectedTicketTypes: []});
                                        } else {
                                            setImportFilters({...importFilters, selectedTicketTypes: [...importFilters.ticketTypes]});
                                        }
                                    }}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                />
                                All Types (Import all ticket types)
                            </label>
                        </div>
                        <div className="ml-6 space-y-2">
                            {importFilters.ticketTypes.map(type => (
                                <label key={type} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={importFilters.selectedTicketTypes.length === 0 || importFilters.selectedTicketTypes.includes(type)}
                                        disabled={importFilters.selectedTicketTypes.length === 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setImportFilters({
                                                    ...importFilters, 
                                                    selectedTicketTypes: [...importFilters.selectedTicketTypes, type]
                                                });
                                            } else {
                                                const newSelected = importFilters.selectedTicketTypes.filter(t => t !== type);
                                                // If unchecking would leave no types selected, select all
                                                setImportFilters({
                                                    ...importFilters, 
                                                    selectedTicketTypes: newSelected.length === 0 ? [] : newSelected
                                                });
                                            }
                                        }}
                                        className={`h-4 w-4 text-blue-600 rounded border-gray-300 ${importFilters.selectedTicketTypes.length === 0 ? 'opacity-50' : ''}`}
                                    />
                                    <span className={`text-gray-700 dark:text-gray-300 ${importFilters.selectedTicketTypes.length === 0 ? 'opacity-50' : ''}`}>{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                        Loading ticket types...
                    </div>
                )}
            </div>
            
            {/* Ticket Statuses Section */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ticket Statuses to Import
                </label>
                {importFilters.ticketStatuses.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="mb-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={importFilters.selectedTicketStatuses.length === 0}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setImportFilters({...importFilters, selectedTicketStatuses: []});
                                        } else {
                                            setImportFilters({...importFilters, selectedTicketStatuses: [...importFilters.ticketStatuses]});
                                        }
                                    }}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                />
                                All Statuses (Import all ticket statuses)
                            </label>
                        </div>
                        <div className="ml-6 space-y-2">
                            {importFilters.ticketStatuses.map(status => (
                                <label key={status} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={importFilters.selectedTicketStatuses.length === 0 || importFilters.selectedTicketStatuses.includes(status)}
                                        disabled={importFilters.selectedTicketStatuses.length === 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setImportFilters({
                                                    ...importFilters, 
                                                    selectedTicketStatuses: [...importFilters.selectedTicketStatuses, status]
                                                });
                                            } else {
                                                const newSelected = importFilters.selectedTicketStatuses.filter(s => s !== status);
                                                // If unchecking would leave no statuses selected, select all
                                                setImportFilters({
                                                    ...importFilters, 
                                                    selectedTicketStatuses: newSelected.length === 0 ? [] : newSelected
                                                });
                                            }
                                        }}
                                        className={`h-4 w-4 text-blue-600 rounded border-gray-300 ${importFilters.selectedTicketStatuses.length === 0 ? 'opacity-50' : ''}`}
                                    />
                                    <span className={`text-gray-700 dark:text-gray-300 ${importFilters.selectedTicketStatuses.length === 0 ? 'opacity-50' : ''}`}>{status}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                        Loading ticket statuses...
                    </div>
                )}
            </div>
            
            <div className="pt-4">
                <button
                    onClick={handleSaveImportConfig}
                    disabled={loading || !jiraConfig.isConfigured}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? 'Saving...' : 'Save Import Configuration'}
                </button>
            </div>
        </div>
    );

    const tabs = [
        { id: 'connection', label: 'JIRA Connection', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' },
        { id: 'projects', label: 'Project Management', icon: 'M3 3h18v18H3V3zm16 16V5H5v14h14zM11 7h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z' },
        { id: 'filters', label: 'Import Filters', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Import Configuration
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Configure JIRA connection and manage project imports
                    </p>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                
                {/* Tab Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'connection' && renderConnectionTab()}
                            {activeTab === 'projects' && renderProjectsTab()}
                            {activeTab === 'filters' && renderFiltersTab()}
                        </>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <div className="flex gap-2">
                        {activeTab === 'projects' && jiraConfig.isConfigured && (
                            <button
                                onClick={handleImport}
                                disabled={loading || !jiraProjects.some(p => projectSettings[p.key]?.importTickets)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                        </svg>
                                        Import Selected Projects
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportConfigurationModalV2;