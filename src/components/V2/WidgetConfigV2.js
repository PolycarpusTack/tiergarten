import React, { useState } from 'react';
import { FILTER_FIELDS, getOperatorsForFieldType } from '../../utils/filterUtils';

const WidgetConfigV2 = ({ widget, onSave, onCancel }) => {
    const initialConfig = {
        title: '',
        type: 'Action View',
        filters: [],
        size: 'large',
        ...(widget || {})
    };
    
    // Ensure filters is always an array
    if (!Array.isArray(initialConfig.filters)) {
        initialConfig.filters = [];
    }
    
    const [config, setConfig] = useState(initialConfig);
    const [activeTab, setActiveTab] = useState('basic');

    const handleSave = () => {
        if (!config.title) {
            alert('Widget title is required.');
            return;
        }
        onSave(config);
    };

    const addFilter = () => {
        setConfig(prev => ({
            ...prev,
            filters: [...(prev.filters || []), { field: 'priority', operator: 'is', value: '' }]
        }));
    };

    const addFilterGroup = () => {
        setConfig(prev => ({
            ...prev,
            filters: [...(prev.filters || []), { 
                group: [{ field: 'priority', operator: 'is', value: '' }],
                logic: 'AND'
            }]
        }));
    };

    const updateFilter = (index, newFilter) => {
        const newFilters = [...(config.filters || [])];
        newFilters[index] = newFilter;
        setConfig(prev => ({ ...prev, filters: newFilters }));
    };

    const updateGroupFilter = (groupIndex, filterIndex, newFilter) => {
        const newFilters = [...(config.filters || [])];
        newFilters[groupIndex].group[filterIndex] = newFilter;
        setConfig(prev => ({ ...prev, filters: newFilters }));
    };

    const removeFilter = (index) => {
        setConfig(prev => ({
            ...prev,
            filters: (prev.filters || []).filter((_, i) => i !== index)
        }));
    };

    const removeGroupFilter = (groupIndex, filterIndex) => {
        const newFilters = [...(config.filters || [])];
        newFilters[groupIndex].group = newFilters[groupIndex].group.filter((_, i) => i !== filterIndex);
        
        // Remove the group if it's empty
        if (newFilters[groupIndex].group.length === 0) {
            newFilters.splice(groupIndex, 1);
        }
        
        setConfig(prev => ({ ...prev, filters: newFilters }));
    };

    const addToGroup = (groupIndex) => {
        const newFilters = [...(config.filters || [])];
        newFilters[groupIndex].group.push({ field: 'priority', operator: 'is', value: '' });
        setConfig(prev => ({ ...prev, filters: newFilters }));
    };

    const renderFilterRow = (filter, index, isInGroup = false, groupIndex = null) => {
        const field = FILTER_FIELDS.find(f => f.value === filter.field);
        const fieldType = field?.type || 'text';
        const operators = getOperatorsForFieldType(fieldType);

        return (
            <div key={index} className="grid grid-cols-12 gap-2 items-center">
                {/* Field selector */}
                <select 
                    value={filter.field} 
                    onChange={e => {
                        const newFilter = { ...filter, field: e.target.value, operator: 'is', value: '' };
                        if (isInGroup) {
                            updateGroupFilter(groupIndex, index, newFilter);
                        } else {
                            updateFilter(index, newFilter);
                        }
                    }}
                    className="col-span-4 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {FILTER_FIELDS.map(field => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                    ))}
                </select>

                {/* Operator selector */}
                <select 
                    value={filter.operator} 
                    onChange={e => {
                        const newFilter = { ...filter, operator: e.target.value };
                        if (isInGroup) {
                            updateGroupFilter(groupIndex, index, newFilter);
                        } else {
                            updateFilter(index, newFilter);
                        }
                    }}
                    className="col-span-3 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {operators.map(op => {
                        // getOperatorsForFieldType returns strings, not objects
                        const operatorLabel = op.replace(/_/g, ' ');
                        return <option key={op} value={op}>{operatorLabel}</option>;
                    })}
                </select>

                {/* Value input */}
                {filter.operator !== 'is empty' && filter.operator !== 'is not empty' && (
                    <input 
                        type={fieldType === 'number' ? 'number' : 'text'}
                        value={filter.value} 
                        onChange={e => {
                            const newFilter = { ...filter, value: e.target.value };
                            if (isInGroup) {
                                updateGroupFilter(groupIndex, index, newFilter);
                            } else {
                                updateFilter(index, newFilter);
                            }
                        }}
                        placeholder={fieldType === 'select' ? 'Select value...' : 'Enter value...'}
                        className="col-span-4 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                )}

                {/* Remove button */}
                <button 
                    onClick={() => {
                        if (isInGroup) {
                            removeGroupFilter(groupIndex, index);
                        } else {
                            removeFilter(index);
                        }
                    }}
                    className="col-span-1 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {widget ? 'Edit Widget' : 'Create New Widget'}
                    </h3>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab('basic')}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'basic'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Basic Settings
                        </button>
                        <button
                            onClick={() => setActiveTab('filters')}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'filters'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Filters
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {activeTab === 'basic' && (
                        <div className="space-y-6">
                            {/* Widget Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Widget Title
                                </label>
                                <input
                                    type="text"
                                    value={config.title}
                                    onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Enter widget title..."
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Widget Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Widget Type
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setConfig(prev => ({ ...prev, type: 'Action View' }))}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            config.type === 'Action View'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <svg className="w-8 h-8 mx-auto mb-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Action View</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Group tickets by action</p>
                                    </button>
                                    <button
                                        onClick={() => setConfig(prev => ({ ...prev, type: 'Tier View' }))}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            config.type === 'Tier View'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <svg className="w-8 h-8 mx-auto mb-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Tier View</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Group tickets by tier</p>
                                    </button>
                                </div>
                            </div>

                            {/* Widget Size */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Widget Size
                                </label>
                                <div className="grid grid-cols-3 gap-4">
                                    {['small', 'medium', 'large'].map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setConfig(prev => ({ ...prev, size }))}
                                            className={`px-4 py-2 rounded-lg border transition-all capitalize ${
                                                config.size === size
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    Small: 1 column • Medium: 2 columns • Large: 3 columns
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'filters' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    Add filters to show only specific tickets in this widget. Leave empty to show all tickets.
                                </p>
                            </div>

                            {/* Filter List */}
                            <div className="space-y-4">
                                {(config.filters || []).map((filter, index) => (
                                    <div key={index}>
                                        {filter.group ? (
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Filter Group ({filter.logic})
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={filter.logic}
                                                            onChange={e => {
                                                                const newFilters = [...config.filters];
                                                                newFilters[index].logic = e.target.value;
                                                                setConfig(prev => ({ ...prev, filters: newFilters }));
                                                            }}
                                                            className="px-3 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm"
                                                        >
                                                            <option value="AND">AND</option>
                                                            <option value="OR">OR</option>
                                                        </select>
                                                        <button
                                                            onClick={() => addToGroup(index)}
                                                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    {filter.group.map((groupFilter, groupFilterIndex) => (
                                                        renderFilterRow(groupFilter, groupFilterIndex, true, index)
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            renderFilterRow(filter, index)
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Add Filter Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={addFilter}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Filter
                                </button>
                                <button
                                    onClick={addFilterGroup}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    Add Filter Group
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {widget ? 'Save Changes' : 'Create Widget'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WidgetConfigV2;