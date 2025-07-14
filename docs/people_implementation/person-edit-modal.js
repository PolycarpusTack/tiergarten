import React, { useState, useEffect } from 'react';

const PersonEditModalV2 = ({ person, api, customFields, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        weeklyCapacity: 40,
        is_active: 1,
        specializations: [],
        customFieldValues: {}
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const availableActions = ['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR'];

    useEffect(() => {
        if (person) {
            setFormData({
                ...person,
                specializations: person.specializations || [],
                customFieldValues: person.customFieldValues || {}
            });
        }
    }, [person]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
        }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSpecializationToggle = (action) => {
        setFormData(prev => ({
            ...prev,
            specializations: prev.specializations.includes(action)
                ? prev.specializations.filter(a => a !== action)
                : [...prev.specializations, action]
        }));
    };

    const handleCustomFieldChange = (fieldId, value) => {
        setFormData(prev => ({
            ...prev,
            customFieldValues: {
                ...prev.customFieldValues,
                [fieldId]: value
            }
        }));
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.first_name.trim()) {
            newErrors.first_name = 'First name is required';
        }
        
        if (!formData.last_name.trim()) {
            newErrors.last_name = 'Last name is required';
        }
        
        if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            newErrors.email = 'Invalid email format';
        }
        
        if (formData.weeklyCapacity < 0 || formData.weeklyCapacity > 168) {
            newErrors.weeklyCapacity = 'Weekly capacity must be between 0 and 168 hours';
        }

        // Validate required custom fields
        customFields?.forEach(field => {
            if (field.is_required && !formData.customFieldValues[field.id]) {
                newErrors[`custom_${field.id}`] = `${field.field_name} is required`;
            }
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setSaving(true);
        
        try {
            const dataToSave = {
                ...formData,
                id: person?.id,
                weeklyCapacity: parseFloat(formData.weeklyCapacity)
            };
            
            await api.savePerson(dataToSave);
            onSave();
        } catch (error) {
            console.error('Error saving person:', error);
            setErrors({ general: 'Failed to save person. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const renderCustomField = (field) => {
        const value = formData.customFieldValues[field.id] || '';
        const error = errors[`custom_${field.id}`];

        switch (field.field_type) {
            case 'string':
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                  ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                        placeholder={`Enter ${field.field_name.toLowerCase()}`}
                    />
                );
            
            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                  ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                        placeholder="0"
                    />
                );
            
            case 'date':
                return (
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                  ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                    />
                );
            
            case 'formula':
                // Formula fields are calculated, not editable
                return (
                    <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300">
                        {value || 'Calculated automatically'}
                    </div>
                );
            
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div 
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    onClick={onClose}
                />

                {/* Modal panel */}
                <div className="inline-block align-bottom bg-white dark:bg-dark-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <form onSubmit={handleSubmit}>
                        <div className="bg-white dark:bg-dark-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                                {person ? 'Edit Person' : 'Add New Person'}
                            </h3>
                            
                            {errors.general && (
                                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
                                    {errors.general}
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                {/* Name Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            First Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                                      ${errors.first_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                                                      bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                            placeholder="John"
                                        />
                                        {errors.first_name && (
                                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.first_name}</p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Last Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                                      ${errors.last_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                                                      bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                            placeholder="Doe"
                                        />
                                        {errors.last_name && (
                                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.last_name}</p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                                  ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                                                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                        placeholder="john.doe@example.com"
                                    />
                                    {errors.email && (
                                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                                    )}
                                </div>
                                
                                {/* Weekly Capacity */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Weekly Capacity (hours)
                                    </label>
                                    <input
                                        type="number"
                                        name="weeklyCapacity"
                                        value={formData.weeklyCapacity}
                                        onChange={handleChange}
                                        min="0"
                                        max="168"
                                        step="0.5"
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                                  ${errors.weeklyCapacity ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                                                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                    />
                                    {errors.weeklyCapacity && (
                                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.weeklyCapacity}</p>
                                    )}
                                </div>
                                
                                {/* Specializations */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Specializations
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {availableActions.map(action => (
                                            <button
                                                key={action}
                                                type="button"
                                                onClick={() => handleSpecializationToggle(action)}
                                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                                    formData.specializations.includes(action)
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                {action}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Fields */}
                                {customFields && customFields.length > 0 && (
                                    <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Additional Information
                                        </h4>
                                        {customFields.map(field => (
                                            <div key={field.id}>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {field.field_name} {field.is_required && '*'}
                                                </label>
                                                {renderCustomField(field)}
                                                {errors[`custom_${field.id}`] && (
                                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                                        {errors[`custom_${field.id}`]}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Active Status */}
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="is_active"
                                        id="is_active"
                                        checked={formData.is_active === 1}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900 dark:text-white">
                                        Active
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 
                                         bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 
                                         focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 
                                         disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 
                                         shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 
                                         dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 
                                         focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm 
                                         disabled:opacity-50 disabled:cursor-not-allowed"
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

export default PersonEditModalV2;