import React, { useState } from 'react';

const TimeRuleEditModalV2 = ({ rule, onSave, onCancel }) => {
    const [formState, setFormState] = useState(rule || {
        condition: {},
        thresholds: { warning: 7, critical: 14, overdue: 30 },
        indicators: { warning: '⚠️', critical: '🔥', overdue: '💀' }
    });

    const updateCondition = (field, value) => {
        setFormState(prev => ({
            ...prev,
            condition: {
                ...prev.condition,
                [field]: value || undefined
            }
        }));
    };

    const updateThreshold = (field, value) => {
        setFormState(prev => ({
            ...prev,
            thresholds: {
                ...prev.thresholds,
                [field]: parseInt(value) || 0
            }
        }));
    };

    const updateIndicator = (field, value) => {
        setFormState(prev => ({
            ...prev,
            indicators: {
                ...prev.indicators,
                [field]: value
            }
        }));
    };

    const handleSave = () => {
        onSave(formState);
    };

    const emojiOptions = {
        warning: ['⚠️', '⏰', '🟡', '⏳', '📍', '🔔'],
        critical: ['🔥', '🚨', '🟠', '⚡', '🔺', '❗'],
        overdue: ['💀', '🆘', '🔴', '🚫', '❌', '‼️']
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {rule?.index !== undefined ? 'Edit Time Sensitivity Rule' : 'Add Time Sensitivity Rule'}
                    </h3>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <div className="space-y-6">
                        {/* Conditions */}
                        <div>
                            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                                Rule Conditions
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Leave empty to apply to all tickets, or specify conditions to target specific tickets
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Action
                                    </label>
                                    <select
                                        value={formState.condition.action || ''}
                                        onChange={(e) => updateCondition('action', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Any Action</option>
                                        <option value="CA">CA</option>
                                        <option value="PLAN">PLAN</option>
                                        <option value="DELEGATE">DELEGATE</option>
                                        <option value="LATER">LATER</option>
                                        <option value="MONITOR">MONITOR</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Tier
                                    </label>
                                    <select
                                        value={formState.condition.tier || ''}
                                        onChange={(e) => updateCondition('tier', e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Any Tier</option>
                                        <option value="1">Tier 1</option>
                                        <option value="2">Tier 2</option>
                                        <option value="3">Tier 3</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        MGX Priority
                                    </label>
                                    <select
                                        value={formState.condition.mgxPriority || ''}
                                        onChange={(e) => updateCondition('mgxPriority', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Any MGX Priority</option>
                                        <option value="Prio 1">Prio 1</option>
                                        <option value="Prio 2">Prio 2</option>
                                        <option value="Prio 3">Prio 3</option>
                                        <option value="Prio 4">Prio 4</option>
                                        <option value="Trivial">Trivial</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Priority
                                    </label>
                                    <select
                                        value={formState.condition.priority || ''}
                                        onChange={(e) => updateCondition('priority', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Any Priority</option>
                                        <option value="Highest">Highest</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                        <option value="Lowest">Lowest</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Time Thresholds */}
                        <div>
                            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                                Time Thresholds (Days)
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Warning After
                                    </label>
                                    <input
                                        type="number"
                                        value={formState.thresholds.warning}
                                        onChange={(e) => updateThreshold('warning', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Critical After
                                    </label>
                                    <input
                                        type="number"
                                        value={formState.thresholds.critical}
                                        onChange={(e) => updateThreshold('critical', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Overdue After
                                    </label>
                                    <input
                                        type="number"
                                        value={formState.thresholds.overdue}
                                        onChange={(e) => updateThreshold('overdue', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Emoji Indicators */}
                        <div>
                            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                                Visual Indicators
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Choose emoji indicators for each threshold level
                            </p>
                            
                            <div className="space-y-4">
                                {['warning', 'critical', 'overdue'].map(level => (
                                    <div key={level}>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                                            {level} Indicator
                                        </label>
                                        <div className="flex gap-2">
                                            {emojiOptions[level].map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => updateIndicator(level, emoji)}
                                                    className={`p-3 text-2xl rounded-lg border-2 transition-all ${
                                                        formState.indicators[level] === emoji
                                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                                    }`}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                            <input
                                                type="text"
                                                value={formState.indicators[level]}
                                                onChange={(e) => updateIndicator(level, e.target.value)}
                                                placeholder="Custom"
                                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                                maxLength="2"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
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
                        {rule?.index !== undefined ? 'Save Changes' : 'Add Rule'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimeRuleEditModalV2;