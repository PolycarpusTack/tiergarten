import React, { useState, useEffect } from 'react';

const PeopleConfigurationV2 = ({ api, onClose }) => {
    const [activeTab, setActiveTab] = useState('fields');
    const [customFields, setCustomFields] = useState([]);
    const [showFieldModal, setShowFieldModal] = useState(false);
    const [editingField, setEditingField] = useState(null);
    const [expertiseConfig, setExpertiseConfig] = useState({
        calculationPeriod: 'months',
        periodValue: 6,
        thresholds: {
            expert: 100,
            intermediate: 40,
            novice: 0
        }
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfiguration();
    }, []);

    const loadConfiguration = async () => {
        try {
            // Load custom fields
            const fields = await api.getPeopleFields();
            setCustomFields(fields);
            
            // Load expertise configuration
            const config = await api.getPeopleConfig();
            if (config.expertiseConfig) {
                setExpertiseConfig(config.expertiseConfig);
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
    };

    const handleAddField = () => {
        setEditingField(null);
        setShowFieldModal(true);
    };

    const handleEditField = (field) => {
        setEditingField(field);
        setShowFieldModal(true);
    };

    const handleDeleteField = async (fieldId) => {
        if (window.confirm('Are you sure you want to delete this field? All associated data will be lost.')) {
            try {
                await api.deletePeopleField(fieldId);
                await loadConfiguration();
            } catch (error) {
                console.error('Error deleting field:', error);
                alert('Failed to delete field. Please try again.');
            }
        }
    };

    const handleMoveField = async (fieldId, direction) => {
        const fieldIndex = customFields.findIndex(f => f.id === fieldId);
        if (
            (direction === 'up' && fieldIndex === 0) ||
            (direction === 'down' && fieldIndex === customFields.length - 1)
        ) {
            return;
        }

        const newFields = [...customFields];
        const swapIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
        
        // Swap display orders
        const tempOrder = newFields[fieldIndex].display_order;
        newFields[fieldIndex].display_order = newFields[swapIndex].display_order;
        newFields[swapIndex].display_order = tempOrder;

        // Swap positions in array
        [newFields[fieldIndex], newFields[swapIndex]] = [newFields[swapIndex], newFields[fieldIndex]];

        setCustomFields(newFields);

        // Update in database
        try {
            await Promise.all([
                api.updatePeopleField(newFields[fieldIndex].id, { display_order: newFields[fieldIndex].display_order }),
                api.updatePeopleField(newFields[swapIndex].id, { display_order: newFields[swapIndex].display_order })
            ]);
        } catch (error) {
            console.error('Error reordering fields:', error);
            await loadConfiguration(); // Reload on error
        }
    };

    const handleSaveExpertiseConfig = async () => {
        setSaving(true);
        try {
            await api.updatePeopleConfig({ expertiseConfig });
            alert('Expertise configuration saved successfully!');
        } catch (error) {
            console.error('Error saving expertise config:', error);
            alert('Failed to save configuration. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const FieldEditModal = ({ field, onClose, onSave }) => {
        const [formData, setFormData] = useState({
            field_name: field?.field_name || '',
            field_type: field?.field_type || 'string',
            is_required: field?.is_required || 0,
            field_config: field?.field_config ? JSON.parse(field.field_config) : {}
        });
        const [errors, setErrors] = useState({});

        const handleSubmit = async (e) => {
            e.preventDefault();
            
            // Validate
            const newErrors = {};
            if (!formData.field_name.trim()) {
                newErrors.field_name = 'Field name is required';
            }
            
            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }

            try {
                const dataToSave = {
                    ...formData,
                    field_config: JSON.stringify(formData.field_config)
                };

                if (field) {
                    await api.updatePeopleField(field.id, dataToSave);
                } else {
                    await api.createPeopleField(dataToSave);
                }
                
                onSave();
            } catch (error) {
                console.error('Error saving field:', error);
                setErrors({ general: 'Failed to save field. Please try again.' });
            }
        };

        return (
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

                    <div className="inline-block align-bottom bg-white dark:bg-dark-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                        <form onSubmit={handleSubmit}>
                            <div className="bg-white dark:bg-dark-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                                    {field ? 'Edit Field' : 'Add Custom Field'}
                                </h3>

                                {errors.general && (
                                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
                                        {errors.general}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Field Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.field_name}
                                            onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                                      ${errors.field_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                                                      bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                            placeholder="e.g., Department, Skills, Location"
                                        />
                                        {errors.field_name && (
                                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.field_name}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Field Type
                                        </label>
                                        <select
                                            value={formData.field_type}
                                            onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                        >
                                            <option value="string">Text</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="formula">Formula (Calculated)</option>
                                        </select>
                                    </div>

                                    {formData.field_type === 'formula' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Formula Expression
                                            </label>
                                            <textarea
                                                value={formData.field_config.formula || ''}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    field_config: { ...formData.field_config, formula: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                rows="3"
                                                placeholder="e.g., hoursWorked / weeksSinceStart"
                                            />
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                Available variables: hoursWorked, weeksSinceStart, currentLoad, weeklyCapacity
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="is_required"
                                            checked={formData.is_required === 1}
                                            onChange={(e) => setFormData({ ...formData, is_required: e.target.checked ? 1 : 0 })}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="is_required" className="ml-2 block text-sm text-gray-900 dark:text-white">
                                            Required field
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="submit"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 
                                             bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 
                                             focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 
                                             shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 
                                             dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 
                                             focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-40 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
                
                <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
                    <div className="w-screen max-w-2xl">
                        <div className="h-full flex flex-col py-6 bg-white dark:bg-dark-surface shadow-xl">
                            {/* Header */}
                            <div className="px-4 sm:px-6">
                                <div className="flex items-start justify-between">
                                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                                        People Configuration
                                    </h2>
                                    <button
                                        onClick={onClose}
                                        className="ml-3 h-7 flex items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-white"
                                    >
                                        <span className="sr-only">Close panel</span>
                                        <svg className="h-6 w-6 text-gray-400 hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                
                                {/* Tabs */}
                                <div className="mt-6">
                                    <div className="border-b border-gray-200 dark:border-gray-700">
                                        <nav className="-mb-px flex space-x-8">
                                            <button
                                                onClick={() => setActiveTab('fields')}
                                                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                                    activeTab === 'fields'
                                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                                }`}
                                            >
                                                Custom Fields
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('expertise')}
                                                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                                    activeTab === 'expertise'
                                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                                }`}
                                            >
                                                Expertise Settings
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('capacity')}
                                                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                                    activeTab === 'capacity'
                                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                                }`}
                                            >
                                                Capacity Settings
                                            </button>
                                        </nav>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="mt-6 relative flex-1 px-4 sm:px-6 overflow-y-auto">
                                {activeTab === 'fields' && (
                                    <div>
                                        <div className="mb-4">
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                                Define custom fields to capture additional information about team members.
                                            </p>
                                            <button
                                                onClick={handleAddField}
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                            >
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                                Add Field
                                            </button>
                                        </div>

                                        {customFields.length === 0 ? (
                                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No custom fields</h3>
                                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                    Get started by adding your first custom field.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {customFields.map((field, index) => (
                                                    <div key={field.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {field.field_name}
                                                                    {field.is_required === 1 && (
                                                                        <span className="ml-2 text-red-500">*</span>
                                                                    )}
                                                                </h4>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Type: {field.field_type}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <button
                                                                    onClick={() => handleMoveField(field.id, 'up')}
                                                                    disabled={index === 0}
                                                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    title="Move up"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMoveField(field.id, 'down')}
                                                                    disabled={index === customFields.length - 1}
                                                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    title="Move down"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleEditField(field)}
                                                                    className="p-1 text-gray-400 hover:text-gray-600"
                                                                    title="Edit"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteField(field.id)}
                                                                    className="p-1 text-gray-400 hover:text-red-600"
                                                                    title="Delete"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'expertise' && (
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                            Configure how client expertise is calculated based on time worked with each client.
                                        </p>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Calculation Period
                                                </label>
                                                <div className="flex items-center space-x-4">
                                                    <select
                                                        value={expertiseConfig.calculationPeriod}
                                                        onChange={(e) => setExpertiseConfig({
                                                            ...expertiseConfig,
                                                            calculationPeriod: e.target.value
                                                        })}
                                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                    >
                                                        <option value="days">Days</option>
                                                        <option value="months">Months</option>
                                                        <option value="years">Years</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        value={expertiseConfig.periodValue}
                                                        onChange={(e) => setExpertiseConfig({
                                                            ...expertiseConfig,
                                                            periodValue: parseInt(e.target.value)
                                                        })}
                                                        min="1"
                                                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                    />
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        Look back period
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                    Expertise Level Thresholds (hours)
                                                </h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-sm text-gray-600 dark:text-gray-400">
                                                            Expert (minimum hours)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={expertiseConfig.thresholds.expert}
                                                            onChange={(e) => setExpertiseConfig({
                                                                ...expertiseConfig,
                                                                thresholds: {
                                                                    ...expertiseConfig.thresholds,
                                                                    expert: parseInt(e.target.value)
                                                                }
                                                            })}
                                                            min="1"
                                                            className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                                                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-sm text-gray-600 dark:text-gray-400">
                                                            Intermediate (minimum hours)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={expertiseConfig.thresholds.intermediate}
                                                            onChange={(e) => setExpertiseConfig({
                                                                ...expertiseConfig,
                                                                thresholds: {
                                                                    ...expertiseConfig.thresholds,
                                                                    intermediate: parseInt(e.target.value)
                                                                }
                                                            })}
                                                            min="1"
                                                            className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                                                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-sm text-gray-600 dark:text-gray-400">
                                                            Novice (below intermediate)
                                                        </label>
                                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                                            Automatic
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleSaveExpertiseConfig}
                                                disabled={saving}
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium 
                                                         rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none 
                                                         focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                            >
                                                {saving ? 'Saving...' : 'Save Expertise Settings'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'capacity' && (
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                            Configure default capacity settings and workload calculations.
                                        </p>

                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                            <div className="flex">
                                                <div className="flex-shrink-0">
                                                    <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                </div>
                                                <div className="ml-3">
                                                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                                        Coming Soon
                                                    </h3>
                                                    <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                                                        Advanced capacity configuration options will be available in a future update.
                                                        Currently, weekly capacity is set per person when adding or editing team members.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showFieldModal && (
                <FieldEditModal
                    field={editingField}
                    onClose={() => {
                        setShowFieldModal(false);
                        setEditingField(null);
                    }}
                    onSave={() => {
                        setShowFieldModal(false);
                        setEditingField(null);
                        loadConfiguration();
                    }}
                />
            )}
        </div>
    );
};

export default PeopleConfigurationV2;