import React from 'react';

const PersonCardV2 = ({ person, isSelected, onToggleSelect, onEdit, onDelete, customFields }) => {
    const utilization = person.weeklyCapacity > 0 
        ? Math.round((person.currentLoad / person.weeklyCapacity) * 100) 
        : 0;

    const getUtilizationColor = (util) => {
        if (util > 100) return 'bg-red-500';
        if (util > 80) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getUtilizationTextColor = (util) => {
        if (util > 100) return 'text-red-600 dark:text-red-400';
        if (util > 80) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-green-600 dark:text-green-400';
    };

    const getActionColor = (action) => {
        const colors = {
            'CA': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            'PLAN': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            'DELEGATE': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            'LATER': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
            'MONITOR': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
        };
        return colors[action] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className={`
            bg-white dark:bg-dark-surface rounded-lg shadow-sm border 
            ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 dark:border-gray-700'}
            hover:shadow-md transition-all duration-200 overflow-hidden
        `}>
            {/* Card Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onToggleSelect}
                            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                {person.first_name} {person.last_name}
                            </h3>
                            {person.email && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {person.email}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={onEdit}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Edit person"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete person"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-4">
                {/* Capacity & Utilization */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Capacity Utilization
                        </span>
                        <span className={`text-sm font-bold ${getUtilizationTextColor(utilization)}`}>
                            {utilization}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                            className={`${getUtilizationColor(utilization)} h-2 rounded-full transition-all duration-300`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {person.currentLoad}h / {person.weeklyCapacity}h
                        </span>
                        {utilization > 100 && (
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                Overloaded by {person.currentLoad - person.weeklyCapacity}h
                            </span>
                        )}
                    </div>
                </div>

                {/* Specializations */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Specializations
                    </h4>
                    <div className="flex flex-wrap gap-1">
                        {person.specializations && person.specializations.length > 0 ? (
                            person.specializations.map(spec => (
                                <span
                                    key={spec}
                                    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getActionColor(spec)}`}
                                >
                                    {spec}
                                </span>
                            ))
                        ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                                No specializations
                            </span>
                        )}
                    </div>
                </div>

                {/* Client Expertise */}
                {person.clientExpertise && person.clientExpertise.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Client Expertise
                        </h4>
                        <div className="space-y-1">
                            {person.clientExpertise.slice(0, 3).map(expertise => (
                                <div key={expertise.clientId} className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
                                        {expertise.clientName}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        expertise.level === 'Expert' 
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            : expertise.level === 'Intermediate'
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                    }`}>
                                        {expertise.level}
                                    </span>
                                </div>
                            ))}
                            {person.clientExpertise.length > 3 && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    +{person.clientExpertise.length - 3} more
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Custom Fields */}
                {customFields && customFields.length > 0 && person.customFieldValues && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="space-y-1">
                            {customFields.slice(0, 2).map(field => {
                                const value = person.customFieldValues[field.id];
                                if (!value) return null;
                                
                                return (
                                    <div key={field.id} className="flex justify-between items-center">
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                            {field.field_name}:
                                        </span>
                                        <span className="text-xs text-gray-900 dark:text-white font-medium">
                                            {field.field_type === 'date' 
                                                ? new Date(value).toLocaleDateString()
                                                : value}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Status Badge */}
                <div className="flex justify-between items-center pt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        person.is_active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                        {person.is_active ? 'Active' : 'Inactive'}
                    </span>
                    
                    {/* Quick Actions */}
                    <div className="flex items-center space-x-2">
                        <button
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={() => console.log('View assignments for', person.id)}
                            title="View assignments"
                        >
                            View Tickets
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonCardV2;