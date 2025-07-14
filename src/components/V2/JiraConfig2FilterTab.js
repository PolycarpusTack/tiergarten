import React, { useState, useEffect } from 'react';

const JiraConfig2FilterTab = ({ configId, filterSettings, setFilterSettings, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [availableValues, setAvailableValues] = useState({
        ticketTypes: [],
        statuses: [],
        priorities: []
    });
    const [showJQLPreview, setShowJQLPreview] = useState(false);

    // Load available values when config changes
    useEffect(() => {
        if (configId) {
            loadAvailableValues();
        }
    }, [configId]);

    const loadAvailableValues = async () => {
        try {
            setLoading(true);
            
            // Load ticket types
            const typesResponse = await fetch(`/api/jira/config2/${configId}/field-values/issuetype`);
            const typesData = await typesResponse.json();
            
            // Load statuses
            const statusResponse = await fetch(`/api/jira/config2/${configId}/field-values/status`);
            const statusData = await statusResponse.json();
            
            // Load priorities
            const priorityResponse = await fetch(`/api/jira/config2/${configId}/field-values/priority`);
            const priorityData = await priorityResponse.json();
            
            setAvailableValues({
                ticketTypes: typesData.values || [],
                statuses: statusData.values || [],
                priorities: priorityData.values || []
            });
        } catch (error) {
            console.error('Error loading field values:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateRangeChange = (type, value) => {
        setFilterSettings({
            ...filterSettings,
            dateRange: { ...filterSettings.dateRange, type, value }
        });
    };

    const handleMultiSelectChange = (field, value, checked) => {
        const currentValues = filterSettings[field] || [];
        if (checked) {
            setFilterSettings({
                ...filterSettings,
                [field]: [...currentValues, value]
            });
        } else {
            setFilterSettings({
                ...filterSettings,
                [field]: currentValues.filter(v => v !== value)
            });
        }
    };

    const handleSelectAll = (field, values) => {
        setFilterSettings({
            ...filterSettings,
            [field]: values.map(v => v.id || v.name)
        });
    };

    const handleClearAll = (field) => {
        setFilterSettings({
            ...filterSettings,
            [field]: []
        });
    };

    const generateJQLPreview = () => {
        const parts = [];
        
        // Date range
        if (filterSettings.dateRange) {
            const { type, value, customStart, customEnd } = filterSettings.dateRange;
            switch (type) {
                case 'days':
                    parts.push(`created >= -${value}d`);
                    break;
                case 'months':
                    parts.push(`created >= -${value * 30}d`);
                    break;
                case 'custom':
                    if (customStart) parts.push(`created >= "${customStart}"`);
                    if (customEnd) parts.push(`created <= "${customEnd}"`);
                    break;
            }
        }

        // Ticket types
        if (filterSettings.ticketTypes?.length > 0) {
            const types = filterSettings.ticketTypes.map(t => `"${t}"`).join(', ');
            parts.push(`issuetype in (${types})`);
        }

        // Statuses
        if (filterSettings.ticketStatuses?.length > 0) {
            const statuses = filterSettings.ticketStatuses.map(s => `"${s}"`).join(', ');
            parts.push(`status in (${statuses})`);
        }

        // Priorities
        if (filterSettings.priorities?.length > 0) {
            const priorities = filterSettings.priorities.map(p => `"${p}"`).join(', ');
            parts.push(`priority in (${priorities})`);
        }

        // Additional filters
        if (filterSettings.additionalFilters?.onlyUnassigned) {
            parts.push('assignee is EMPTY');
        }
        if (filterSettings.additionalFilters?.hasAttachments) {
            parts.push('attachments is not EMPTY');
        }
        if (filterSettings.additionalFilters?.hasComments) {
            parts.push('comment ~ "*"');
        }
        if (filterSettings.additionalFilters?.recentlyUpdated) {
            parts.push('updated >= -7d');
        }

        return parts.join(' AND ');
    };

    if (loading) {
        return <div className="text-center py-8">Loading filter options...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Date Range Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Date Range
                </h4>
                <div className="space-y-3">
                    <label className="flex items-center">
                        <input
                            type="radio"
                            checked={filterSettings.dateRange?.type === 'days'}
                            onChange={() => handleDateRangeChange('days', filterSettings.dateRange?.value || 30)}
                            className="mr-3"
                        />
                        <span className="flex items-center">
                            Last
                            <input
                                type="number"
                                value={filterSettings.dateRange?.type === 'days' ? filterSettings.dateRange.value : 30}
                                onChange={(e) => handleDateRangeChange('days', parseInt(e.target.value))}
                                className="mx-2 w-16 rounded border-gray-300 dark:border-gray-600"
                                min="1"
                                max="365"
                            />
                            days
                        </span>
                    </label>
                    
                    <label className="flex items-center">
                        <input
                            type="radio"
                            checked={filterSettings.dateRange?.type === 'months'}
                            onChange={() => handleDateRangeChange('months', filterSettings.dateRange?.value || 3)}
                            className="mr-3"
                        />
                        <span className="flex items-center">
                            Last
                            <input
                                type="number"
                                value={filterSettings.dateRange?.type === 'months' ? filterSettings.dateRange.value : 3}
                                onChange={(e) => handleDateRangeChange('months', parseInt(e.target.value))}
                                className="mx-2 w-16 rounded border-gray-300 dark:border-gray-600"
                                min="1"
                                max="12"
                            />
                            months
                        </span>
                    </label>
                    
                    <label className="flex items-center">
                        <input
                            type="radio"
                            checked={filterSettings.dateRange?.type === 'custom'}
                            onChange={() => handleDateRangeChange('custom', null)}
                            className="mr-3"
                        />
                        <span>Custom date range</span>
                    </label>
                    
                    {filterSettings.dateRange?.type === 'custom' && (
                        <div className="ml-6 flex items-center space-x-3">
                            <input
                                type="date"
                                value={filterSettings.dateRange.customStart || ''}
                                onChange={(e) => setFilterSettings({
                                    ...filterSettings,
                                    dateRange: {
                                        ...filterSettings.dateRange,
                                        customStart: e.target.value
                                    }
                                })}
                                className="rounded border-gray-300 dark:border-gray-600"
                            />
                            <span>to</span>
                            <input
                                type="date"
                                value={filterSettings.dateRange.customEnd || ''}
                                onChange={(e) => setFilterSettings({
                                    ...filterSettings,
                                    dateRange: {
                                        ...filterSettings.dateRange,
                                        customEnd: e.target.value
                                    }
                                })}
                                className="rounded border-gray-300 dark:border-gray-600"
                            />
                        </div>
                    )}
                    
                    <label className="flex items-center">
                        <input
                            type="radio"
                            checked={filterSettings.dateRange?.type === 'all'}
                            onChange={() => handleDateRangeChange('all', null)}
                            className="mr-3"
                        />
                        <span>All tickets</span>
                    </label>
                </div>
            </div>

            {/* Ticket Types Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Ticket Types
                    </h4>
                    <div className="space-x-2">
                        <button
                            onClick={() => handleSelectAll('ticketTypes', availableValues.ticketTypes)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            Select All
                        </button>
                        <button
                            onClick={() => handleClearAll('ticketTypes')}
                            className="text-sm text-gray-600 hover:text-gray-700"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableValues.ticketTypes.map(type => (
                        <label key={type.id} className="flex items-center">
                            <input
                                type="checkbox"
                                checked={filterSettings.ticketTypes?.includes(type.name) || false}
                                onChange={(e) => handleMultiSelectChange('ticketTypes', type.name, e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm">{type.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Status Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Ticket Status
                    </h4>
                    <div className="space-x-2">
                        <button
                            onClick={() => handleSelectAll('ticketStatuses', availableValues.statuses)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            Select All
                        </button>
                        <button
                            onClick={() => handleClearAll('ticketStatuses')}
                            className="text-sm text-gray-600 hover:text-gray-700"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableValues.statuses.map(status => (
                        <label key={status.id} className="flex items-center">
                            <input
                                type="checkbox"
                                checked={filterSettings.ticketStatuses?.includes(status.name) || false}
                                onChange={(e) => handleMultiSelectChange('ticketStatuses', status.name, e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm">{status.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Priority Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Priority Levels
                    </h4>
                    <div className="space-x-2">
                        <button
                            onClick={() => handleSelectAll('priorities', availableValues.priorities)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            Select All
                        </button>
                        <button
                            onClick={() => handleClearAll('priorities')}
                            className="text-sm text-gray-600 hover:text-gray-700"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableValues.priorities.map(priority => (
                        <label key={priority.id} className="flex items-center">
                            <input
                                type="checkbox"
                                checked={filterSettings.priorities?.includes(priority.name) || false}
                                onChange={(e) => handleMultiSelectChange('priorities', priority.name, e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm">{priority.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Additional Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Additional Filters
                </h4>
                <div className="space-y-3">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={filterSettings.additionalFilters?.onlyUnassigned || false}
                            onChange={(e) => setFilterSettings({
                                ...filterSettings,
                                additionalFilters: {
                                    ...filterSettings.additionalFilters,
                                    onlyUnassigned: e.target.checked
                                }
                            })}
                            className="mr-3"
                        />
                        <span>Only unassigned tickets</span>
                    </label>
                    
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={filterSettings.additionalFilters?.hasAttachments || false}
                            onChange={(e) => setFilterSettings({
                                ...filterSettings,
                                additionalFilters: {
                                    ...filterSettings.additionalFilters,
                                    hasAttachments: e.target.checked
                                }
                            })}
                            className="mr-3"
                        />
                        <span>Has attachments</span>
                    </label>
                    
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={filterSettings.additionalFilters?.hasComments || false}
                            onChange={(e) => setFilterSettings({
                                ...filterSettings,
                                additionalFilters: {
                                    ...filterSettings.additionalFilters,
                                    hasComments: e.target.checked
                                }
                            })}
                            className="mr-3"
                        />
                        <span>Has comments</span>
                    </label>
                    
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={filterSettings.additionalFilters?.recentlyUpdated || false}
                            onChange={(e) => setFilterSettings({
                                ...filterSettings,
                                additionalFilters: {
                                    ...filterSettings.additionalFilters,
                                    recentlyUpdated: e.target.checked
                                }
                            })}
                            className="mr-3"
                        />
                        <span>Updated in last 7 days</span>
                    </label>
                </div>
            </div>

            {/* JQL Query Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Advanced JQL Query
                    </h4>
                    <button
                        onClick={() => setShowJQLPreview(!showJQLPreview)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                    >
                        {showJQLPreview ? 'Hide' : 'Show'} Preview
                    </button>
                </div>
                
                {showJQLPreview && (
                    <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm">
                        {generateJQLPreview() || 'No filters applied'}
                    </div>
                )}
                
                <textarea
                    value={filterSettings.customJQL || ''}
                    onChange={(e) => setFilterSettings({
                        ...filterSettings,
                        customJQL: e.target.value
                    })}
                    placeholder="Enter custom JQL query (optional)"
                    className="w-full h-24 rounded border-gray-300 dark:border-gray-600 font-mono text-sm"
                />
                <p className="mt-2 text-sm text-gray-500">
                    Custom JQL will be combined with filters above using AND operator
                </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={onSave}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Save Filter Configuration
                </button>
            </div>
        </div>
    );
};

export default JiraConfig2FilterTab;