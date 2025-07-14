import React, { useState, useEffect } from 'react';

const JiraConfig2ImportWizard = ({ configId, onClose, onImportComplete }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]);
    const [importOptions, setImportOptions] = useState({
        updateExisting: true,
        createMissingClients: true,
        skipErrors: true
    });
    
    // Import progress state
    const [importId, setImportId] = useState(null);
    const [importStatus, setImportStatus] = useState(null);
    const [progressEventSource, setProgressEventSource] = useState(null);

    useEffect(() => {
        loadProjects();
        return () => {
            if (progressEventSource) {
                progressEventSource.close();
            }
        };
    }, []);

    // Clean up SSE connection when it changes
    useEffect(() => {
        return () => {
            if (progressEventSource) {
                progressEventSource.close();
            }
        };
    }, [progressEventSource]);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/jira/projects');
            if (response.ok) {
                const data = await response.json();
                setProjects(data.map(p => ({
                    key: p.key,
                    name: p.name,
                    selected: false
                })));
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProjectToggle = (projectKey) => {
        setProjects(projects.map(p => 
            p.key === projectKey ? { ...p, selected: !p.selected } : p
        ));
    };

    const handleSelectAll = () => {
        setProjects(projects.map(p => ({ ...p, selected: true })));
    };

    const handleDeselectAll = () => {
        setProjects(projects.map(p => ({ ...p, selected: false })));
    };

    const startImport = async () => {
        try {
            setLoading(true);
            
            const selectedProjectsData = projects
                .filter(p => p.selected)
                .map(p => ({ key: p.key, name: p.name }));
            
            const response = await fetch(`/api/jira/config2/${configId}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projects: selectedProjectsData,
                    options: importOptions
                })
            });

            if (response.ok) {
                const result = await response.json();
                setImportId(result.importId);
                setStep(3);
                startProgressMonitoring(result.importId);
            } else {
                throw new Error('Failed to start import');
            }
        } catch (error) {
            console.error('Error starting import:', error);
            alert('Failed to start import: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const startProgressMonitoring = (importId) => {
        // Use Server-Sent Events for real-time progress
        const eventSource = new EventSource(`/api/jira/import/${importId}/progress`);
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setImportStatus(data);
            
            // Check if import is complete
            if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
                eventSource.close();
                setProgressEventSource(null);
                
                if (data.status === 'completed') {
                    setTimeout(() => {
                        if (onImportComplete) onImportComplete();
                    }, 2000);
                }
            }
        };
        
        eventSource.onerror = (err) => {
            console.error('SSE Error:', err);
            eventSource.close();
            setProgressEventSource(null);
            // Fallback to polling
            pollImportStatus(importId);
        };
        
        setProgressEventSource(eventSource);
    };

    const pollImportStatus = async (importId) => {
        try {
            const response = await fetch(`/api/jira/import/${importId}`);
            if (response.ok) {
                const status = await response.json();
                setImportStatus(status);
                
                if (status.status === 'running') {
                    setTimeout(() => pollImportStatus(importId), 2000);
                } else if (status.status === 'completed') {
                    setTimeout(() => {
                        if (onImportComplete) onImportComplete();
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Error polling import status:', error);
        }
    };

    const cancelImport = async () => {
        if (!importId) return;
        
        try {
            // Close SSE connection first
            if (progressEventSource) {
                progressEventSource.close();
                setProgressEventSource(null);
            }
            
            const response = await fetch(`/api/jira/import/${importId}/cancel`, {
                method: 'POST'
            });
            
            if (response.ok) {
                setImportStatus(prev => ({ ...prev, status: 'cancelled' }));
            }
        } catch (err) {
            console.error('Error cancelling import:', err);
        }
    };

    const renderStep1 = () => (
        <div>
            <h3 className="text-lg font-semibold mb-4">Select Projects to Import</h3>
            
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">
                    {projects.filter(p => p.selected).length} of {projects.length} projects selected
                </p>
                <div className="space-x-2">
                    <button
                        onClick={handleSelectAll}
                        className="text-sm text-blue-600 hover:text-blue-700"
                    >
                        Select All
                    </button>
                    <button
                        onClick={handleDeselectAll}
                        className="text-sm text-gray-600 hover:text-gray-700"
                    >
                        Deselect All
                    </button>
                </div>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
                {loading ? (
                    <div className="p-8 text-center">Loading projects...</div>
                ) : projects.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No projects available
                    </div>
                ) : (
                    <div className="divide-y">
                        {projects.map(project => (
                            <label
                                key={project.key}
                                className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={project.selected}
                                    onChange={() => handleProjectToggle(project.key)}
                                    className="mr-3"
                                />
                                <div>
                                    <div className="font-medium">{project.name}</div>
                                    <div className="text-sm text-gray-500">{project.key}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div>
            <h3 className="text-lg font-semibold mb-4">Import Options</h3>
            
            <div className="space-y-4">
                <div>
                    <h4 className="font-medium mb-2">Selected Projects</h4>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded p-3">
                        {projects.filter(p => p.selected).map(p => (
                            <div key={p.key} className="text-sm">
                                {p.name} ({p.key})
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={importOptions.updateExisting}
                            onChange={(e) => setImportOptions({
                                ...importOptions,
                                updateExisting: e.target.checked
                            })}
                            className="mr-3"
                        />
                        <div>
                            <div className="font-medium">Update existing tickets</div>
                            <div className="text-sm text-gray-500">
                                Update tickets that already exist in the system
                            </div>
                        </div>
                    </label>

                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={importOptions.createMissingClients}
                            onChange={(e) => setImportOptions({
                                ...importOptions,
                                createMissingClients: e.target.checked
                            })}
                            className="mr-3"
                        />
                        <div>
                            <div className="font-medium">Create missing clients</div>
                            <div className="text-sm text-gray-500">
                                Automatically create clients for projects that don't exist
                            </div>
                        </div>
                    </label>

                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={importOptions.skipErrors}
                            onChange={(e) => setImportOptions({
                                ...importOptions,
                                skipErrors: e.target.checked
                            })}
                            className="mr-3"
                        />
                        <div>
                            <div className="font-medium">Skip errors</div>
                            <div className="text-sm text-gray-500">
                                Continue importing even if some tickets fail
                            </div>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => {
        const progress = importStatus?.progress || {};
        const progressPercent = progress.totalTickets > 0 
            ? Math.round((progress.processedTickets / progress.totalTickets) * 100)
            : 0;

        return (
            <div>
                <h3 className="text-lg font-semibold mb-4">Import Progress</h3>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                            Status: <span className="font-medium">{importStatus?.status}</span>
                        </span>
                        {importStatus?.status === 'running' && (
                            <button
                                onClick={cancelImport}
                                className="text-sm text-red-600 hover:text-red-700"
                            >
                                Cancel Import
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-gray-500">Projects</div>
                            <div className="font-medium">
                                {progress.processedProjects || 0} / {progress.totalProjects || 0}
                            </div>
                        </div>
                        <div>
                            <div className="text-gray-500">Tickets</div>
                            <div className="font-medium">
                                {progress.processedTickets || 0} / {progress.totalTickets || 0}
                            </div>
                        </div>
                        <div>
                            <div className="text-gray-500">Created Clients</div>
                            <div className="font-medium">{progress.createdClients || 0}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">Updated Clients</div>
                            <div className="font-medium">{progress.updatedClients || 0}</div>
                        </div>
                    </div>

                    {progress.currentProject && (
                        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded">
                            <div className="text-sm">
                                <span className="text-gray-500">Current Project:</span>
                                <span className="ml-2 font-medium">{progress.currentProject}</span>
                            </div>
                        </div>
                    )}

                    {progress.errors && progress.errors.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-medium text-red-600 mb-2">Errors</h4>
                            <div className="max-h-32 overflow-y-auto">
                                {progress.errors.map((error, index) => (
                                    <div key={index} className="text-sm text-red-600 mb-1">
                                        {error.project}: {error.message}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {importStatus?.status === 'completed' && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="flex items-center text-green-700 dark:text-green-300">
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Import completed successfully!
                            </div>
                        </div>
                    )}

                    {importStatus?.status === 'failed' && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div className="text-red-700 dark:text-red-300">
                                Import failed: {importStatus.errorMessage}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        JIRA Import - Configuration 2.0
                    </h2>
                    <button
                        onClick={() => {
                            if (progressEventSource) {
                                progressEventSource.close();
                                setProgressEventSource(null);
                            }
                            onClose();
                        }}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    {step > 1 && step < 3 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="px-4 py-2 text-gray-700 hover:text-gray-900"
                        >
                            Back
                        </button>
                    )}
                    {step === 1 && (
                        <div className="ml-auto">
                            <button
                                onClick={() => setStep(2)}
                                disabled={projects.filter(p => p.selected).length === 0}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="ml-auto">
                            <button
                                onClick={startImport}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? 'Starting...' : 'Start Import'}
                            </button>
                        </div>
                    )}
                    {step === 3 && importStatus?.status !== 'running' && (
                        <div className="ml-auto">
                            <button
                                onClick={() => {
                                    if (progressEventSource) {
                                        progressEventSource.close();
                                        setProgressEventSource(null);
                                    }
                                    onClose();
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JiraConfig2ImportWizard;