import React from 'react';
import TicketCardV2 from './TicketCardV2';
import { applyFilters } from '../../utils/filterUtils';

const WidgetV2 = ({ widget, tickets, onEdit, onDelete, onTicketAction, onQuickAction, selectedTickets, onToggleTicketSelection }) => {
    // Parse filters
    const filters = typeof widget.filters === 'string' 
        ? JSON.parse(widget.filters) 
        : widget.filters || [];

    // Apply filters to tickets
    const filteredTickets = applyFilters(tickets, filters);

    // Group tickets based on widget type
    const groupTickets = () => {
        if (widget.type === 'Action View') {
            const groups = {};
            const actions = ['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR'];
            
            actions.forEach(action => {
                groups[action] = filteredTickets.filter(t => t.assignedAction === action);
            });
            
            return groups;
        } else if (widget.type === 'Tier View') {
            const groups = {};
            [1, 2, 3].forEach(tier => {
                groups[`Tier ${tier}`] = filteredTickets.filter(t => t.client?.tier === tier);
            });
            return groups;
        }
        return { 'All': filteredTickets };
    };

    const ticketGroups = groupTickets();
    const totalTickets = filteredTickets.length;

    // Determine widget size classes
    const getSizeClasses = () => {
        switch (widget.size) {
            case 'small':
                return 'col-span-1';
            case 'medium':
                return 'col-span-1 lg:col-span-2';
            case 'large':
            default:
                return 'col-span-1 lg:col-span-2 xl:col-span-3';
        }
    };

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden ${getSizeClasses()}`}>
            {/* Widget Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {widget.title}
                        </h3>
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                            {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title="Edit widget"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete widget"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Widget Content */}
            <div className="p-4 max-h-[600px] overflow-y-auto">
                {totalTickets === 0 ? (
                    <div className="text-center py-12">
                        <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No tickets match the current filters</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(ticketGroups).map(([groupName, groupTickets]) => {
                            if (groupTickets.length === 0 && Object.keys(ticketGroups).length > 1) {
                                return null; // Skip empty groups when there are multiple groups
                            }

                            return (
                                <div key={groupName}>
                                    {Object.keys(ticketGroups).length > 1 && (
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {groupName}
                                            </h4>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {groupTickets.length} ticket{groupTickets.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    <div className="space-y-3">
                                        {groupTickets.length === 0 ? (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                                                No tickets
                                            </p>
                                        ) : (
                                            groupTickets.map(ticket => (
                                                <TicketCardV2
                                                    key={ticket.key}
                                                    ticket={ticket}
                                                    onActionChange={(newAction) => onTicketAction(ticket.key, newAction)}
                                                    onQuickAction={onQuickAction}
                                                    cardConfig={widget.cardConfig}
                                                    isSelected={selectedTickets && selectedTickets.has(ticket.key)}
                                                    onToggleSelection={onToggleTicketSelection ? () => onToggleTicketSelection(ticket.key) : null}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WidgetV2;