import React, { useState } from 'react';
import ClientEditModalV2 from './ClientEditModalV2';

const ClientsViewV2 = ({ clients, api, onRefresh, showImportModal, setShowImportModal }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showJiraImport, setShowJiraImport] = useState(false);
    const [selectedClients, setSelectedClients] = useState(new Set());
    const [showBulkActions, setShowBulkActions] = useState(false);

    // Handle import modal from sidebar quick action
    React.useEffect(() => {
        if (showImportModal) {
            setShowJiraImport(true);
            setShowImportModal(false);
        }
    }, [showImportModal, setShowImportModal]);

    // Show/hide bulk actions based on selection
    React.useEffect(() => {
        setShowBulkActions(selectedClients.size > 0);
    }, [selectedClients]);

    const filteredClients = clients.filter(client => 
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.jiraProjectKey.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddClient = () => {
        setEditingClient(null);
        setShowModal(true);
    };

    const handleEditClient = (client) => {
        setEditingClient(client);
        setShowModal(true);
    };

    const handleDeleteClient = async (clientId) => {
        if (window.confirm('Are you sure you want to delete this client?')) {
            await api.deleteClient(clientId);
            onRefresh();
        }
    };

    const handleSaveClient = async () => {
        setShowModal(false);
        setEditingClient(null);
        onRefresh();
    };

    const handleToggleSelect = (clientId) => {
        const newSelected = new Set(selectedClients);
        if (newSelected.has(clientId)) {
            newSelected.delete(clientId);
        } else {
            newSelected.add(clientId);
        }
        setSelectedClients(newSelected);
    };

    const handleSelectAll = () => {
        setSelectedClients(new Set(filteredClients.map(c => c.id)));
    };

    const handleClearSelection = () => {
        setSelectedClients(new Set());
    };

    const handleBulkUpdate = async (field, value) => {
        const selectedIds = Array.from(selectedClients);
        
        for (const clientId of selectedIds) {
            const client = clients.find(c => c.id === clientId);
            if (client) {
                const updatedClient = { ...client };
                
                if (field === 'tier') {
                    updatedClient.tier = parseInt(value);
                } else if (['isCA', 'isException', 'isGlobal'].includes(field)) {
                    updatedClient[field] = value;
                }
                
                await api.saveClient(updatedClient);
            }
        }
        
        onRefresh();
        handleClearSelection();
    };

    const handleBulkDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${selectedClients.size} clients?`)) {
            const selectedIds = Array.from(selectedClients);
            
            for (const clientId of selectedIds) {
                await api.deleteClient(clientId);
            }
            
            onRefresh();
            handleClearSelection();
        }
    };

    // Group clients by tier
    const clientsByTier = {
        1: filteredClients.filter(c => c.tier === 1),
        2: filteredClients.filter(c => c.tier === 2),
        3: filteredClients.filter(c => c.tier === 3),
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Client Management</h2>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Configure client tiers and special attributes
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowJiraImport(true)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Import from JIRA
                        </button>
                        <button
                            onClick={handleAddClient}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Client
                        </button>
                    </div>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {showBulkActions && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {selectedClients.size} client(s) selected
                        </span>
                        <button
                            onClick={handleSelectAll}
                            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                            Select All
                        </button>
                        <button
                            onClick={handleClearSelection}
                            className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
                        >
                            Clear Selection
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <select
                            onChange={(e) => e.target.value && handleBulkUpdate('tier', e.target.value)}
                            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                            defaultValue=""
                        >
                            <option value="">Change Tier...</option>
                            <option value="1">Set to Tier 1</option>
                            <option value="2">Set to Tier 2</option>
                            <option value="3">Set to Tier 3</option>
                        </select>
                        
                        <button
                            onClick={() => handleBulkUpdate('isCA', true)}
                            className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                            Mark as CA
                        </button>
                        
                        <button
                            onClick={() => handleBulkUpdate('isCA', false)}
                            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                            Unmark CA
                        </button>
                        
                        <button
                            onClick={handleBulkDelete}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="mb-6">
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search clients..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {/* Client Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Clients</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{clients.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-500 dark:text-gray-400">CA Clients</p>
                    <p className="text-2xl font-bold text-purple-600">{clients.filter(c => c.isCA).length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Exception Clients</p>
                    <p className="text-2xl font-bold text-red-600">{clients.filter(c => c.isException).length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Global Clients</p>
                    <p className="text-2xl font-bold text-blue-600">{clients.filter(c => c.isGlobal).length}</p>
                </div>
            </div>

            {/* Clients by Tier */}
            <div className="space-y-6">
                {[1, 2, 3].map(tier => (
                    <div key={tier} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                        <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${
                            tier === 1 ? 'bg-red-50 dark:bg-red-900/20' :
                            tier === 2 ? 'bg-blue-50 dark:bg-blue-900/20' :
                            'bg-green-50 dark:bg-green-900/20'
                        }`}>
                            <h3 className={`text-lg font-semibold ${
                                tier === 1 ? 'text-red-900 dark:text-red-100' :
                                tier === 2 ? 'text-blue-900 dark:text-blue-100' :
                                'text-green-900 dark:text-green-100'
                            }`}>
                                Tier {tier} Clients
                            </h3>
                            <p className={`text-sm mt-1 ${
                                tier === 1 ? 'text-red-700 dark:text-red-300' :
                                tier === 2 ? 'text-blue-700 dark:text-blue-300' :
                                'text-green-700 dark:text-green-300'
                            }`}>
                                {clientsByTier[tier].length} client{clientsByTier[tier].length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        
                        <div className="p-4">
                            {clientsByTier[tier].length === 0 ? (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                    No clients in this tier
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {clientsByTier[tier].map(client => (
                                        <div
                                            key={client.id}
                                            className={`border rounded-lg p-4 hover:shadow-md transition-all ${
                                                selectedClients.has(client.id)
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                    : 'border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedClients.has(client.id)}
                                                    onChange={() => handleToggleSelect(client.id)}
                                                    className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                                                {client.name}
                                                            </h4>
                                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                Project: {client.jiraProjectKey}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleEditClient(client)}
                                                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClient(client.id)}
                                                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {client.isCA && (
                                                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                                                                CA
                                                            </span>
                                                        )}
                                                        {client.isException && (
                                                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
                                                                Exception
                                                            </span>
                                                        )}
                                                        {client.isGlobal && (
                                                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                                                                Global
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Client Modal */}
            {showModal && (
                <ClientEditModalV2
                    client={editingClient}
                    onSave={handleSaveClient}
                    onCancel={() => {
                        setShowModal(false);
                        setEditingClient(null);
                    }}
                    api={api}
                />
            )}

            {/* JIRA Import Modal */}
            {showJiraImport && (
                <JiraImportModalV2
                    api={api}
                    onImport={async (projectKeys) => {
                        try {
                            const projects = await api.getJiraProjects();
                            for (const key of projectKeys) {
                                const project = projects.find(p => p.key === key);
                                if (project) {
                                    await api.saveClient({
                                        name: project.name,
                                        jiraProjectKey: project.key,
                                        tier: 3,
                                        isCA: false,
                                        isException: false,
                                        isGlobal: false,
                                    });
                                }
                            }
                            onRefresh();
                            setShowJiraImport(false);
                        } catch (error) {
                            alert('Failed to import clients: ' + error.message);
                        }
                    }}
                    onCancel={() => setShowJiraImport(false)}
                />
            )}
        </div>
    );
};

// Simple JIRA Import Modal for V2
const JiraImportModalV2 = ({ api, onImport, onCancel }) => {
    const [projects, setProjects] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState({});
    const [loading, setLoading] = useState(true);

    const loadProjects = React.useCallback(async () => {
        try {
            const data = await api.getJiraProjects();
            setProjects(data);
        } catch (error) {
            console.error('Error loading JIRA projects:', error);
            setProjects([]);
        }
        setLoading(false);
    }, [api]);

    React.useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const handleToggle = (key) => {
        setSelectedProjects(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const selectedCount = Object.values(selectedProjects).filter(Boolean).length;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Import Clients from JIRA</h3>
                </div>
                
                <div className="p-6 max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading JIRA projects...</p>
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-600 dark:text-gray-400">No JIRA projects available.</p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Check your JIRA configuration.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {projects.map(project => (
                                <label key={project.key} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!selectedProjects[project.key]}
                                        onChange={() => handleToggle(project.key)}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-3 flex-1">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-2">({project.key})</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{selectedCount} project(s) selected</span>
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onImport(Object.keys(selectedProjects).filter(k => selectedProjects[k]))}
                            disabled={selectedCount === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            Import Selected
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientsViewV2;