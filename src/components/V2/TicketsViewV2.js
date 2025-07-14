import React, { useState } from 'react';
import TicketCardV2 from './TicketCardV2';

const TicketsViewV2 = ({ tickets, onTicketAction, onQuickAction }) => {
    const [filter, setFilter] = useState('all');
    const [sortBy, setSortBy] = useState('priority');

    const getFilteredTickets = () => {
        let filtered = [...tickets];

        // Apply filter
        switch (filter) {
            case 'exceptions':
                filtered = filtered.filter(t => t.client?.isException);
                break;
            case 'high-priority':
                filtered = filtered.filter(t => t.priority === 'Highest' || t.priority === 'High');
                break;
            case 'unassigned':
                filtered = filtered.filter(t => !t.assignedAction);
                break;
            case 'ca':
                filtered = filtered.filter(t => t.assignedAction === 'CA');
                break;
            default:
                // 'all' - no filter
                break;
        }

        // Apply sort
        switch (sortBy) {
            case 'priority':
                const priorityOrder = { 'Highest': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'Lowest': 4 };
                filtered.sort((a, b) => (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5));
                break;
            case 'age':
                filtered.sort((a, b) => (b.age || 0) - (a.age || 0));
                break;
            case 'client':
                filtered.sort((a, b) => (a.client?.name || '').localeCompare(b.client?.name || ''));
                break;
            case 'status':
                filtered.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
                break;
            default:
                break;
        }

        return filtered;
    };

    const filteredTickets = getFilteredTickets();

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Tickets</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Browse and manage all tickets in the system
                </p>
            </div>

            {/* Filters and Sort */}
            <div className="mb-6 flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Filter:</label>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    >
                        <option value="all">All Tickets</option>
                        <option value="exceptions">Exceptions Only</option>
                        <option value="high-priority">High Priority</option>
                        <option value="unassigned">Unassigned</option>
                        <option value="ca">CA Actions</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    >
                        <option value="priority">Priority</option>
                        <option value="age">Age</option>
                        <option value="client">Client</option>
                        <option value="status">Status</option>
                    </select>
                </div>

                <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
                    Showing {filteredTickets.length} of {tickets.length} tickets
                </div>
            </div>

            {/* Tickets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredTickets.map(ticket => (
                    <TicketCardV2
                        key={ticket.key}
                        ticket={ticket}
                        onActionChange={(newAction) => onTicketAction(ticket.key, newAction)}
                        onQuickAction={onQuickAction}
                        cardConfig={{
                            displayFields: ['key', 'summary', 'client', 'tier', 'priority', 'status', 'age', 'assignee']
                        }}
                    />
                ))}
            </div>

            {filteredTickets.length === 0 && (
                <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">No tickets match your filter criteria</p>
                </div>
            )}
        </div>
    );
};

export default TicketsViewV2;