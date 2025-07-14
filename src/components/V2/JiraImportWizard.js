import React, { useState, useEffect } from 'react';

const JiraImportWizard = ({ api, onClose, onImportComplete }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Step 1: Project Selection
    const [projects, setProjects] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Step 2: Import Options
    const [importOptions, setImportOptions] = useState({
        dateRange: 30,
        ticketTypes: [],
        ticketStatuses: [],
        updateExisting: true
    });
    
    // Step 3: Import Progress
    const [importId, setImportId] = useState(null);
    const [importStatus, setImportStatus] = useState(null);
    const [progressEventSource, setProgressEventSource] = useState(null);

    // Load projects on mount
    useEffect(() => {
        loadProjects();
    }, []);

    // Clean up SSE connection on unmount or when connection changes
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
            const data = await response.json();
            
            if (response.ok) {
                setProjects(data);
            } else {
                setError(data.error || 'Failed to load projects');
            }
        } catch (err) {
            setError('Failed to load projects: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleProjectToggle = (projectKey) => {
        setSelectedProjects(prev => 
            prev.includes(projectKey) 
                ? prev.filter(k => k !== projectKey)
                : [...prev, projectKey]
        );
    };

    const handleSelectAll = () => {
        if (selectedProjects.length === filteredProjects.length) {
            setSelectedProjects([]);
        } else {
            setSelectedProjects(filteredProjects.map(p => p.key));
        }
    };

    const startImport = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch('/api/jira/import-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectKeys: selectedProjects,
                    options: importOptions
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setImportId(data.importId);
                setStep(3);
                startProgressMonitoring(data.importId);
            } else {
                setError(data.error || 'Failed to start import');
            }
        } catch (err) {
            setError('Failed to start import: ' + err.message);
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
            pollImportStatus(importId);
        };
        
        setProgressEventSource(eventSource);
    };

    // Fallback polling method
    const pollImportStatus = async (importId) => {
        try {
            const response = await fetch(`/api/jira/import/${importId}`);
            const data = await response.json();
            
            if (response.ok) {
                setImportStatus(data);
                
                if (data.status === 'running') {
                    setTimeout(() => pollImportStatus(importId), 2000);
                } else if (data.status === 'completed' && onImportComplete) {
                    setTimeout(onImportComplete, 2000);
                }
            }
        } catch (err) {
            console.error('Error polling import status:', err);
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

    const filteredProjects = projects.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getProgressPercentage = () => {
        if (!importStatus || !importStatus.progress) return 0;
        const { totalTickets, processedTickets } = importStatus.progress;
        return totalTickets > 0 ? Math.round((processedTickets / totalTickets) * 100) : 0;
    };

    const renderStep1 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Select Projects to Import
            </h3>
            
            <div className="flex items-center gap-4">
                <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                    onClick={handleSelectAll}
                    className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                >
                    {selectedProjects.length === filteredProjects.length ? 'Deselect All' : 'Select All'}
                </button>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading projects...</p>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No projects found
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredProjects.map((project) => (
                            <label
                                key={project.key}
                                className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedProjects.includes(project.key)}
                                    onChange={() => handleProjectToggle(project.key)}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
                                />
                                <div className="ml-3 flex-1">
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {project.name}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {project.key}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''} selected
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Options
            </h3>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date Range (days)
                </label>
                <input
                    type="number"
                    value={importOptions.dateRange}
                    onChange={(e) => setImportOptions({ ...importOptions, dateRange: parseInt(e.target.value) || 30 })}
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Import tickets created or updated in the last {importOptions.dateRange} days
                </p>
            </div>

            <div>
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        checked={importOptions.updateExisting}
                        onChange={(e) => setImportOptions({ ...importOptions, updateExisting: e.target.checked })}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Update existing tickets if found
                    </span>
                </label>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Import Summary</h4>
                <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                    <li>• {selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''} selected</li>
                    <li>• Tickets from the last {importOptions.dateRange} days</li>
                    <li>• {importOptions.updateExisting ? 'Will update' : 'Will skip'} existing tickets</li>
                </ul>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Progress
            </h3>

            {importStatus && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Status: <span className="font-medium">{importStatus.status}</span>
                        </span>
                        {importStatus.status === 'running' && (
                            <button
                                onClick={cancelImport}
                                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                            >
                                Cancel Import
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Progress</span>
                            <span className="text-gray-900 dark:text-white font-medium">
                                {getProgressPercentage()}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${getProgressPercentage()}%` }}
                            />
                        </div>
                    </div>

                    {importStatus.progress && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Projects: </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {importStatus.progress.processedProjects} / {importStatus.progress.totalProjects}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Tickets: </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {importStatus.progress.processedTickets} / {importStatus.progress.totalTickets}
                                </span>
                            </div>
                        </div>
                    )}

                    {importStatus.progress?.currentProject && (
                        <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Current project: </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {importStatus.progress.currentProject}
                            </span>
                        </div>
                    )}

                    {importStatus.progress?.errors && importStatus.progress.errors.length > 0 && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                                Errors ({importStatus.progress.errors.length})
                            </h4>
                            <div className="space-y-1 text-sm text-red-700 dark:text-red-300">
                                {importStatus.progress.errors.slice(0, 3).map((error, idx) => (
                                    <div key={idx}>• {error.message}</div>
                                ))}
                                {importStatus.progress.errors.length > 3 && (
                                    <div>... and {importStatus.progress.errors.length - 3} more</div>
                                )}
                            </div>
                        </div>
                    )}

                    {importStatus.status === 'completed' && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="flex items-center text-green-800 dark:text-green-200">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Import completed successfully!
                            </div>
                        </div>
                    )}

                    {importStatus.status === 'failed' && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div className="text-red-800 dark:text-red-200">
                                <div className="flex items-center font-medium mb-1">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Import failed
                                </div>
                                {importStatus.errorMessage && (
                                    <div className="text-sm ml-7">{importStatus.errorMessage}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        JIRA Import Wizard
                    </h2>
                    <button
                        onClick={() => {
                            if (progressEventSource) {
                                progressEventSource.close();
                                setProgressEventSource(null);
                            }
                            onClose();
                        }}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </div>

                <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                    s === step ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                            />
                        ))}
                    </div>

                    <div className="flex gap-3">
                        {step > 1 && step < 3 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                disabled={loading}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Back
                            </button>
                        )}
                        
                        {step === 1 && (
                            <button
                                onClick={() => setStep(2)}
                                disabled={selectedProjects.length === 0 || loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        )}
                        
                        {step === 2 && (
                            <button
                                onClick={startImport}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Starting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Start Import
                                    </>
                                )}
                            </button>
                        )}
                        
                        {step === 3 && importStatus?.status !== 'running' && (
                            <button
                                onClick={() => {
                                    if (progressEventSource) {
                                        progressEventSource.close();
                                        setProgressEventSource(null);
                                    }
                                    onClose();
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JiraImportWizard;