import React, { useState, useEffect, useRef } from 'react';

const TicketCardV2 = ({ ticket, onActionChange, onQuickAction, cardConfig, isSelected, onToggleSelection }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const dropdownRef = useRef(null);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowActionMenu(false);
            }
        };

        if (showActionMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showActionMenu]);

    const priorityStyles = {
        Highest: 'border-red-500 bg-red-50 dark:bg-red-950/20',
        High: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
        Medium: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
        Low: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
        Lowest: 'border-gray-500 bg-gray-50 dark:bg-gray-950/20',
    };

    const actionStyles = {
        CA: 'bg-purple-600 text-white',
        PLAN: 'bg-blue-600 text-white',
        DELEGATE: 'bg-cyan-600 text-white',
        LATER: 'bg-slate-500 text-white',
        MONITOR: 'bg-orange-600 text-white',
    };

    // Calculate ticket age
    const getTicketAge = () => {
        if (!ticket.created) return null;
        const created = new Date(ticket.created);
        const now = new Date();
        const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Get age-based styling
    const getAgeColor = () => {
        const age = ticket.age || getTicketAge();
        if (!age) return '';
        
        if (age > 30) return 'text-red-600 dark:text-red-400';
        if (age > 14) return 'text-amber-600 dark:text-amber-400';
        if (age > 7) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-gray-600 dark:text-gray-400';
    };

    // Parse card config safely
    let config = {};
    try {
        config = typeof cardConfig === 'string' ? JSON.parse(cardConfig || '{}') : (cardConfig || {});
    } catch (error) {
        console.error('Failed to parse card config:', error);
        config = {};
    }
    const displayFields = config.displayFields || ['key', 'summary', 'client', 'priority', 'status'];
    const timeSensitivity = config.timeSensitivity;

    // Get time sensitivity indicator
    const getTimeSensitivityIndicator = () => {
        if (!timeSensitivity?.enabled || !ticket.age) return null;
        
        const rules = timeSensitivity.rules || [];
        const applicableRule = rules.find(rule => {
            if (!rule.condition) return true;
            if (rule.condition.tier && ticket.client?.tier !== rule.condition.tier) return false;
            if (rule.condition.action && ticket.assignedAction !== rule.condition.action) return false;
            if (rule.condition.priority && ticket.priority !== rule.condition.priority) return false;
            if (rule.condition.mgxPriority && ticket.mgxPriority !== rule.condition.mgxPriority) return false;
            return true;
        });

        if (!applicableRule) return null;

        const age = ticket.age;
        const { warning, critical, overdue } = applicableRule.thresholds;
        const { indicators } = applicableRule;
        
        if (age >= overdue) return { emoji: indicators?.overdue || '💀', type: 'overdue' };
        if (age >= critical) return { emoji: indicators?.critical || '🔥', type: 'critical' };
        if (age >= warning) return { emoji: indicators?.warning || '⚠️', type: 'warning' };
        return null;
    };

    const timeSensitivityIndicator = getTimeSensitivityIndicator();

    return (
        <div
            className={`
                relative rounded-lg border-2 transition-all duration-300
                ${priorityStyles[ticket.priority] || 'border-gray-300 bg-gray-50'}
                ${isHovered ? 'shadow-lg scale-[1.02]' : 'shadow'}
                ${ticket.client?.isException ? 'ring-2 ring-red-500 ring-offset-2' : ''}
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                ${showActionMenu ? 'z-50' : 'z-0'}
            `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Exception Badge */}
            {ticket.client?.isException && (
                <div className="absolute top-0 right-0 bg-red-600 text-white px-3 py-1 rounded-bl-lg text-xs font-bold animate-pulse">
                    EXCEPTION
                </div>
            )}

            {/* Time Sensitivity Indicator */}
            {timeSensitivityIndicator && (
                <div className={`absolute top-0 left-0 px-3 py-1 rounded-br-lg text-lg font-bold ${
                    timeSensitivityIndicator.type === 'overdue' ? 'bg-red-100 dark:bg-red-900/30' :
                    timeSensitivityIndicator.type === 'critical' ? 'bg-orange-100 dark:bg-orange-900/30' :
                    'bg-yellow-100 dark:bg-yellow-900/30'
                }`}>
                    {timeSensitivityIndicator.emoji}
                </div>
            )}

            {/* Main Content */}
            <div className="p-4 overflow-visible">
                {/* Header */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            {/* Selection Checkbox */}
                            {onToggleSelection && (
                                <input
                                    type="checkbox"
                                    checked={isSelected || false}
                                    onChange={onToggleSelection}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                            {displayFields.includes('key') && (
                                <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                                    {ticket.key}
                                </span>
                            )}
                            {displayFields.includes('client') && ticket.client?.isCA && (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                                    CA
                                </span>
                            )}
                            {displayFields.includes('tier') && (
                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                                    Tier {ticket.client?.tier}
                                </span>
                            )}
                            {displayFields.includes('mgxPriority') && ticket.mgxPriority && (
                                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded-full">
                                    {ticket.mgxPriority}
                                </span>
                            )}
                        </div>
                        {displayFields.includes('summary') && (
                            <h3 className="text-gray-900 dark:text-gray-100 font-medium line-clamp-2">
                                {ticket.summary}
                            </h3>
                        )}
                    </div>

                    {/* Priority Indicator */}
                    {displayFields.includes('priority') && (
                        <div className={`
                            ml-2 px-3 py-1 rounded-full text-xs font-bold flex-shrink-0
                            ${ticket.priority === 'Highest' ? 'bg-red-500 text-white' : ''}
                            ${ticket.priority === 'High' ? 'bg-amber-500 text-white' : ''}
                            ${ticket.priority === 'Medium' ? 'bg-blue-500 text-white' : ''}
                            ${ticket.priority === 'Low' ? 'bg-emerald-500 text-white' : ''}
                            ${ticket.priority === 'Lowest' ? 'bg-gray-500 text-white' : ''}
                        `}>
                            {ticket.priority}
                        </div>
                    )}
                </div>

                {/* Client & Status Info */}
                <div className="flex items-center justify-between mb-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        {displayFields.includes('client') && (
                            <>
                                <span>{ticket.client?.name}</span>
                                {displayFields.includes('status') && <span>•</span>}
                            </>
                        )}
                        {displayFields.includes('status') && (
                            <span>{ticket.status}</span>
                        )}
                        {displayFields.includes('age') && ticket.age && (
                            <>
                                <span>•</span>
                                <span className={getAgeColor()}>{ticket.age}d old</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Action Assignment */}
                <div className="flex items-center justify-between overflow-visible">
                    <div className="relative overflow-visible" ref={dropdownRef}>
                        {ticket.assignedAction ? (
                            <button
                                onClick={() => setShowActionMenu(!showActionMenu)}
                                className={`
                                    px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1
                                    ${actionStyles[ticket.assignedAction]}
                                    hover:opacity-90 transition-opacity
                                `}
                            >
                                {ticket.assignedAction}
                                {ticket.isManualOverride && (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
                                    </svg>
                                )}
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        ) : (
                            <span className="text-sm text-gray-500 italic">No action assigned</span>
                        )}

                        {/* Action Dropdown Menu */}
                        {showActionMenu && (
                            <>
                                {/* Invisible backdrop to ensure dropdown is clickable */}
                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowActionMenu(false)} />
                                <div className="absolute left-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] opacity-100">
                                    {['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR'].map(action => (
                                        <button
                                            key={action}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onActionChange(action);
                                                setShowActionMenu(false);
                                            }}
                                            className={`
                                                w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg relative z-[9999]
                                                ${ticket.assignedAction === action 
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }
                                            `}
                                        >
                                            {action}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Quick Actions (visible on hover) */}
                    <div className={`
                        flex gap-2 transition-opacity duration-200
                        ${isHovered ? 'opacity-100' : 'opacity-0'}
                    `}>
                        <button
                            onClick={() => {
                                if (ticket.jiraUrl) {
                                    window.open(ticket.jiraUrl, '_blank');
                                } else {
                                    onQuickAction('view', ticket);
                                }
                            }}
                            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title={ticket.jiraUrl ? "View in JIRA" : "View Details"}
                        >
                            {ticket.jiraUrl ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            )}
                        </button>
                        {ticket.priority === 'Highest' || ticket.priority === 'High' ? (
                            <button
                                onClick={() => onQuickAction('escalate', ticket)}
                                className="p-1.5 rounded-lg bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                                title="Escalate"
                            >
                                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* Additional Info (if configured) */}
                {displayFields.includes('assignee') && ticket.assignee && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Assigned to: {ticket.assignee}
                    </div>
                )}

                {/* Expandable Details */}
                {(displayFields.includes('created') || displayFields.includes('updated') || displayFields.includes('duedate')) && (
                    <>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="mt-3 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
                        >
                            {isExpanded ? 'Show less' : 'Show more'}
                            <svg className={`w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1 text-xs">
                                {displayFields.includes('created') && ticket.created && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Created:</span>
                                        <span className="text-gray-700 dark:text-gray-300">
                                            {new Date(ticket.created).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                                {displayFields.includes('updated') && ticket.updated && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Updated:</span>
                                        <span className="text-gray-700 dark:text-gray-300">
                                            {new Date(ticket.updated).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                                {displayFields.includes('duedate') && ticket.duedate && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Due:</span>
                                        <span className={`font-medium ${
                                            new Date(ticket.duedate) < new Date() ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                                        }`}>
                                            {new Date(ticket.duedate).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Hover Effect Gradient */}
            {isHovered && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none animate-shimmer" />
            )}
        </div>
    );
};

export default TicketCardV2;