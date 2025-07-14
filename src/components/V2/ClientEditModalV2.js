import React, { useState } from 'react';

const ClientEditModalV2 = ({ client, onSave, onCancel, api }) => {
    const [formData, setFormData] = useState({
        name: client?.name || '',
        jiraProjectKey: client?.jiraProjectKey || '',
        tier: client?.tier || 3,
        isCA: client?.isCA || false,
        isException: client?.isException || false,
        isGlobal: client?.isGlobal || false
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const clientData = client ? { ...formData, id: client.id } : formData;
            await api.saveClient(clientData);
            onSave();
        } catch (error) {
            alert('Failed to save client: ' + error.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {client ? 'Edit Client' : 'Add New Client'}
                    </h3>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Client Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Client Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* JIRA Project Key */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            JIRA Project Key
                        </label>
                        <input
                            type="text"
                            name="jiraProjectKey"
                            value={formData.jiraProjectKey}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
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
                            <option value={1}>Tier 1 - Critical</option>
                            <option value={2}>Tier 2 - Important</option>
                            <option value={3}>Tier 3 - Standard</option>
                        </select>
                    </div>

                    {/* Client Properties */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Client Properties
                        </label>
                        
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isCA"
                                name="isCA"
                                checked={formData.isCA}
                                onChange={handleChange}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor="isCA" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                Client Alliance (CA)
                            </label>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isException"
                                name="isException"
                                checked={formData.isException}
                                onChange={handleChange}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor="isException" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                Exception Client (Always Tier 1 treatment)
                            </label>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isGlobal"
                                name="isGlobal"
                                checked={formData.isGlobal}
                                onChange={handleChange}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor="isGlobal" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                Global Client
                            </label>
                        </div>
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
                            {client ? 'Save Changes' : 'Create Client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClientEditModalV2;