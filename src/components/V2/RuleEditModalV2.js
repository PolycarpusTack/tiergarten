import React, { useState } from 'react';

const ACTIONS = ['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR'];
// const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const CUSTOMER_PRIORITIES = ['Prio 1', 'Prio 2', 'Prio 3', 'Prio 4', 'Trivial'];

const RuleEditModalV2 = ({ rule, onSave, onCancel, api }) => {
    const [formData, setFormData] = useState({
        isCA: rule?.isCA ?? false,
        tier: rule?.tier || '',
        mgxPriority: rule?.mgxPriority || '',
        customerPriority: rule?.customerPriority || '',
        action: rule?.action || 'PLAN'
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Prepare rule data
        const ruleData = {
            isCA: formData.isCA,
            tier: formData.tier ? parseInt(formData.tier) : null,
            mgxPriority: formData.isCA && formData.mgxPriority ? formData.mgxPriority : null,
            customerPriority: !formData.isCA && formData.customerPriority ? formData.customerPriority : null,
            action: formData.action
        };

        // Add ID if editing existing rule
        if (rule?.id) {
            ruleData.id = rule.id;
        }

        try {
            await api.saveGlobalRule(ruleData);
            onSave();
        } catch (error) {
            alert('Failed to save rule: ' + error.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {rule ? 'Edit Rule' : 'Add New Rule'}
                    </h3>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Client Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Client Type
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="isCA"
                                    checked={formData.isCA === true}
                                    onChange={() => setFormData(prev => ({ ...prev, isCA: true }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">CA Client</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="isCA"
                                    checked={formData.isCA === false}
                                    onChange={() => setFormData(prev => ({ ...prev, isCA: false }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Non-CA Client</span>
                            </label>
                        </div>
                    </div>

                    {/* Client Tier */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Client Tier
                        </label>
                        <select
                            name="tier"
                            value={formData.tier}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Any Tier</option>
                            <option value="1">Tier 1</option>
                            <option value="2">Tier 2</option>
                            <option value="3">Tier 3</option>
                        </select>
                    </div>

                    {/* Priority (CA clients use MGX Priority, Non-CA use Customer Priority) */}
                    {formData.isCA ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                MGX Priority
                            </label>
                            <select
                                name="mgxPriority"
                                value={formData.mgxPriority}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Any Priority</option>
                                {CUSTOMER_PRIORITIES.map(priority => (
                                    <option key={priority} value={priority}>{priority}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Customer Priority
                            </label>
                            <select
                                name="customerPriority"
                                value={formData.customerPriority}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Any Priority</option>
                                {CUSTOMER_PRIORITIES.map(priority => (
                                    <option key={priority} value={priority}>{priority}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Assigned Action */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Assigned Action
                        </label>
                        <select
                            name="action"
                            value={formData.action}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        >
                            {ACTIONS.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>

                    {/* Rule Preview */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rule Preview:</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formData.isCA ? 'CA' : 'Non-CA'} clients
                            {formData.tier && ` in Tier ${formData.tier}`}
                            {formData.mgxPriority && ` with MGX Priority ${formData.mgxPriority}`}
                            {formData.customerPriority && ` with Customer Priority ${formData.customerPriority}`}
                            {' → '}
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{formData.action}</span>
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {rule ? 'Save Changes' : 'Create Rule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RuleEditModalV2;