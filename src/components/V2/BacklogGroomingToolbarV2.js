import React from 'react';

const BacklogGroomingToolbarV2 = ({ 
    selectedTickets, 
    onBulkAction, 
    tickets, 
    onShowRecommendations 
}) => {
    const selectedCount = selectedTickets.size;
    const hasSelection = selectedCount > 0;

    const handleBulkAction = (action) => {
        if (!hasSelection) return;
        const ticketIds = Array.from(selectedTickets);
        onBulkAction(action, ticketIds);
    };

    return (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Backlog Grooming Mode
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {hasSelection 
                                ? `${selectedCount} ticket${selectedCount > 1 ? 's' : ''} selected`
                                : 'Select tickets to perform bulk actions'
                            }
                        </p>
                    </div>

                    {hasSelection && (
                        <div className="flex items-center gap-2 ml-8">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Bulk Actions:</span>
                            
                            <button
                                onClick={() => handleBulkAction('escalate-to-ca')}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                title="Escalate selected tickets to CA action"
                            >
                                → CA
                            </button>
                            
                            <button
                                onClick={() => handleBulkAction('escalate-to-plan')}
                                className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                                title="Escalate selected tickets to PLAN action"
                            >
                                → PLAN
                            </button>
                            
                            <button
                                onClick={() => handleBulkAction('move-to-delegate')}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                title="Move selected tickets to DELEGATE action"
                            >
                                → DELEGATE
                            </button>
                            
                            <button
                                onClick={() => handleBulkAction('move-to-later')}
                                className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                                title="Move selected tickets to LATER action"
                            >
                                → LATER
                            </button>
                            
                            <button
                                onClick={() => handleBulkAction('move-to-monitor')}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                                title="Move selected tickets to MONITOR action"
                            >
                                → MONITOR
                            </button>

                            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
                            
                            <button
                                onClick={() => handleBulkAction('archive')}
                                className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                                title="Archive selected tickets"
                            >
                                Archive
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={onShowRecommendations}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700"
                >
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="font-medium">AI Recommendations</span>
                </button>
            </div>

            {/* Quick Stats */}
            {hasSelection && (
                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-gray-600 dark:text-gray-400">Highest Priority:</span>
                            <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                                {Array.from(selectedTickets).filter(id => 
                                    tickets.find(t => t.key === id)?.priority === 'Highest'
                                ).length}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600 dark:text-gray-400">High Priority:</span>
                            <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                                {Array.from(selectedTickets).filter(id => 
                                    tickets.find(t => t.key === id)?.priority === 'High'
                                ).length}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600 dark:text-gray-400">Tier 1 Clients:</span>
                            <span className="ml-2 font-semibold text-purple-600 dark:text-purple-400">
                                {Array.from(selectedTickets).filter(id => 
                                    tickets.find(t => t.key === id)?.client?.tier === 1
                                ).length}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600 dark:text-gray-400">Exception Clients:</span>
                            <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                                {Array.from(selectedTickets).filter(id => 
                                    tickets.find(t => t.key === id)?.client?.isException
                                ).length}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BacklogGroomingToolbarV2;