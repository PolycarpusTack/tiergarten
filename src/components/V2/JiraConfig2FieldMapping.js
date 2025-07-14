import React, { useState, useEffect } from 'react';

const JiraConfig2FieldMapping = ({ configId, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [fields, setFields] = useState({
        standard: [],
        custom: [],
        system: []
    });
    const [mappings, setMappings] = useState([]);
    const [selectedTab, setSelectedTab] = useState('standard');

    // Tiergarten fields that can be mapped to
    const tiergartenFields = [
        { id: 'summary', name: 'Summary', type: 'string' },
        { id: 'description', name: 'Description', type: 'text' },
        { id: 'status', name: 'Status', type: 'option' },
        { id: 'priority', name: 'Priority', type: 'option' },
        { id: 'customer_priority', name: 'Customer Priority', type: 'option' },
        { id: 'mgx_priority', name: 'MGX Priority', type: 'option' },
        { id: 'category', name: 'Category', type: 'option' },
        { id: 'mgx_service', name: 'MGX Service', type: 'array' },
        { id: 'mgx_customers', name: 'MGX Customers', type: 'array' },
        { id: 'squad', name: 'Squad', type: 'array' },
        { id: 'team', name: 'Team', type: 'array' },
        { id: 'environment', name: 'Environment', type: 'option' },
        { id: 'type_of_work', name: 'Type of Work', type: 'option' },
        { id: 'custom_field_1', name: 'Custom Field 1', type: 'string' },
        { id: 'custom_field_2', name: 'Custom Field 2', type: 'string' },
        { id: 'custom_field_3', name: 'Custom Field 3', type: 'string' }
    ];

    // Priority mapping presets
    const priorityMappingPresets = {
        standard: {
            'Highest': 'P1',
            'High': 'P2',
            'Medium': 'P3',
            'Low': 'P4',
            'Lowest': 'P4'
        },
        numeric: {
            '1': 'P1',
            '2': 'P2',
            '3': 'P3',
            '4': 'P4',
            '5': 'P4'
        }
    };

    useEffect(() => {
        if (configId) {
            loadFields();
            loadMappings();
        }
    }, [configId]);

    const loadFields = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/jira/config2/${configId}/discover-fields`);
            const data = await response.json();
            setFields(data);
        } catch (error) {
            console.error('Error loading fields:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMappings = async () => {
        try {
            const response = await fetch(`/api/jira/config2/${configId}/field-mappings`);
            const data = await response.json();
            setMappings(data);
        } catch (error) {
            console.error('Error loading mappings:', error);
        }
    };

    const handleAddMapping = (jiraField) => {
        const newMapping = {
            jiraFieldId: jiraField.id,
            jiraFieldName: jiraField.name,
            jiraFieldType: jiraField.type,
            tiergartenField: '',
            mappingType: 'direct',
            transformRules: {},
            isEnabled: true
        };
        setMappings([...mappings, newMapping]);
    };

    const handleUpdateMapping = (index, field, value) => {
        const updated = [...mappings];
        updated[index][field] = value;
        
        // Auto-set mapping type based on field selection
        if (field === 'tiergartenField') {
            const tierField = tiergartenFields.find(f => f.id === value);
            const jiraField = [...fields.standard, ...fields.custom, ...fields.system]
                .find(f => f.id === updated[index].jiraFieldId);
            
            if (tierField && jiraField) {
                // Auto-detect if transformation is needed
                if (jiraField.type === 'array' && tierField.type === 'string') {
                    updated[index].mappingType = 'custom';
                    updated[index].transformRules = { type: 'array_to_string' };
                } else if (jiraField.name.includes('Priority') && tierField.id.includes('priority')) {
                    updated[index].mappingType = 'transform';
                    updated[index].transformRules = { valueMap: priorityMappingPresets.standard };
                }
            }
        }
        
        setMappings(updated);
    };

    const handleRemoveMapping = (index) => {
        setMappings(mappings.filter((_, i) => i !== index));
    };

    const handleSaveMappings = async () => {
        try {
            setLoading(true);
            
            // Save each mapping
            for (const mapping of mappings) {
                await fetch(`/api/jira/config2/${configId}/field-mappings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mapping)
                });
            }
            
            if (onSave) onSave();
            alert('Field mappings saved successfully!');
        } catch (error) {
            console.error('Error saving mappings:', error);
            alert('Failed to save mappings');
        } finally {
            setLoading(false);
        }
    };

    const renderFieldList = (fieldList, category) => (
        <div className="space-y-2">
            {fieldList.map(field => {
                const isMapped = mappings.some(m => m.jiraFieldId === field.id);
                return (
                    <div
                        key={field.id}
                        className={`p-3 border rounded-lg ${
                            isMapped ? 'bg-green-50 dark:bg-green-900/20 border-green-300' : 'bg-white dark:bg-gray-800'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h5 className="font-medium text-gray-900 dark:text-white">
                                    {field.name}
                                </h5>
                                <p className="text-sm text-gray-500">
                                    ID: {field.id} | Type: {field.type}
                                    {field.custom && ' | Custom Field'}
                                </p>
                            </div>
                            {!isMapped && (
                                <button
                                    onClick={() => handleAddMapping(field)}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    Add Mapping
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderMappingRow = (mapping, index) => (
        <div key={index} className="p-4 border rounded-lg bg-white dark:bg-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        JIRA Field
                    </label>
                    <p className="mt-1 font-medium">{mapping.jiraFieldName}</p>
                    <p className="text-sm text-gray-500">{mapping.jiraFieldId}</p>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Maps To
                    </label>
                    <select
                        value={mapping.tiergartenField}
                        onChange={(e) => handleUpdateMapping(index, 'tiergartenField', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300"
                    >
                        <option value="">Select field...</option>
                        {tiergartenFields.map(field => (
                            <option key={field.id} value={field.id}>
                                {field.name}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Mapping Type
                    </label>
                    <select
                        value={mapping.mappingType}
                        onChange={(e) => handleUpdateMapping(index, 'mappingType', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300"
                    >
                        <option value="direct">Direct</option>
                        <option value="transform">Transform</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                
                <div className="flex items-end space-x-2">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={mapping.isEnabled}
                            onChange={(e) => handleUpdateMapping(index, 'isEnabled', e.target.checked)}
                            className="mr-2"
                        />
                        <span className="text-sm">Enabled</span>
                    </label>
                    <button
                        onClick={() => handleRemoveMapping(index)}
                        className="text-sm text-red-600 hover:text-red-700"
                    >
                        Remove
                    </button>
                </div>
            </div>
            
            {mapping.mappingType === 'transform' && (
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Value Mapping
                    </label>
                    <div className="space-y-2">
                        <button
                            onClick={() => handleUpdateMapping(index, 'transformRules', {
                                valueMap: priorityMappingPresets.standard
                            })}
                            className="text-sm text-blue-600 hover:text-blue-700 mr-4"
                        >
                            Use Standard Priority Mapping
                        </button>
                        <button
                            onClick={() => handleUpdateMapping(index, 'transformRules', {
                                valueMap: priorityMappingPresets.numeric
                            })}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            Use Numeric Priority Mapping
                        </button>
                    </div>
                    {mapping.transformRules?.valueMap && (
                        <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded">
                            <pre className="text-xs">{JSON.stringify(mapping.transformRules.valueMap, null, 2)}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    if (loading) {
        return <div className="text-center py-8">Loading field information...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Current Mappings */}
            {mappings.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Current Mappings
                    </h3>
                    <div className="space-y-4">
                        {mappings.map((mapping, index) => renderMappingRow(mapping, index))}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSaveMappings}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Save All Mappings
                        </button>
                    </div>
                </div>
            )}

            {/* Available Fields */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Available JIRA Fields
                </h3>
                
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    <button
                        className={`px-4 py-2 font-medium ${
                            selectedTab === 'standard'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setSelectedTab('standard')}
                    >
                        Standard ({fields.standard.length})
                    </button>
                    <button
                        className={`px-4 py-2 font-medium ${
                            selectedTab === 'custom'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setSelectedTab('custom')}
                    >
                        Custom ({fields.custom.length})
                    </button>
                    <button
                        className={`px-4 py-2 font-medium ${
                            selectedTab === 'system'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setSelectedTab('system')}
                    >
                        System ({fields.system.length})
                    </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {selectedTab === 'standard' && renderFieldList(fields.standard, 'standard')}
                    {selectedTab === 'custom' && renderFieldList(fields.custom, 'custom')}
                    {selectedTab === 'system' && renderFieldList(fields.system, 'system')}
                </div>
            </div>

            {/* Recommended Mappings */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                    Recommended Mappings
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                    <li>• Map "MGX Prio (customfield_10112)" → MGX Priority</li>
                    <li>• Map "Customer Prio (customfield_10142)" → Customer Priority</li>
                    <li>• Map "Category (customfield_10200)" → Category</li>
                    <li>• Map "MGX Customers (customfield_10513)" → MGX Customers</li>
                    <li>• Map "Squad (customfield_10611)" → Squad</li>
                    <li>• Map "Team (customfield_10511)" → Team</li>
                </ul>
            </div>
        </div>
    );
};

export default JiraConfig2FieldMapping;