import React, { useMemo, useState } from 'react';

const GroomingRecommendationsV2 = ({ tickets, onAction, onClose }) => {
    const [selectedRecommendations, setSelectedRecommendations] = useState(new Set());

    // Generate recommendations based on ticket analysis
    const recommendations = useMemo(() => {
        const recs = [];

        // Find stale tickets (no update in 7+ days)
        const staleTickets = tickets.filter(t => {
            const lastUpdated = new Date(t.lastUpdated);
            const daysSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24);
            return daysSinceUpdate > 7 && t.assignedAction === 'MONITOR';
        });

        if (staleTickets.length > 0) {
            recs.push({
                id: 'stale-tickets',
                type: 'warning',
                title: 'Stale Tickets Detected',
                description: `${staleTickets.length} tickets haven't been updated in over 7 days`,
                tickets: staleTickets.map(t => t.key),
                suggestedAction: 'move-to-later',
                actionLabel: 'Move to LATER'
            });
        }

        // Find high priority tickets in low action categories
        const highPriorityLowAction = tickets.filter(t => 
            (t.priority === 'Highest' || t.priority === 'High') && 
            (t.assignedAction === 'LATER' || t.assignedAction === 'MONITOR')
        );

        if (highPriorityLowAction.length > 0) {
            recs.push({
                id: 'high-priority-escalation',
                type: 'urgent',
                title: 'High Priority Tickets Need Escalation',
                description: `${highPriorityLowAction.length} high priority tickets are in low action categories`,
                tickets: highPriorityLowAction.map(t => t.key),
                suggestedAction: 'escalate-to-plan',
                actionLabel: 'Escalate to PLAN'
            });
        }

        // Find exception client tickets not in CA
        const exceptionNotCA = tickets.filter(t => 
            t.client?.isException && t.assignedAction !== 'CA'
        );

        if (exceptionNotCA.length > 0) {
            recs.push({
                id: 'exception-escalation',
                type: 'critical',
                title: 'Exception Client Tickets',
                description: `${exceptionNotCA.length} exception client tickets should be in CA action`,
                tickets: exceptionNotCA.map(t => t.key),
                suggestedAction: 'escalate-to-ca',
                actionLabel: 'Escalate to CA'
            });
        }

        // Find tier 1 tickets in low priority actions
        const tier1LowAction = tickets.filter(t => 
            t.client?.tier === 1 && 
            !t.client?.isException &&
            (t.assignedAction === 'LATER' || t.assignedAction === 'MONITOR')
        );

        if (tier1LowAction.length > 0) {
            recs.push({
                id: 'tier1-escalation',
                type: 'info',
                title: 'Tier 1 Client Tickets',
                description: `${tier1LowAction.length} tier 1 client tickets could be escalated`,
                tickets: tier1LowAction.map(t => t.key),
                suggestedAction: 'escalate-to-plan',
                actionLabel: 'Escalate to PLAN'
            });
        }

        // Find tickets that could be delegated
        const delegateCandidates = tickets.filter(t => 
            t.client?.tier >= 2 && 
            t.priority !== 'Highest' &&
            t.priority !== 'High' &&
            (t.assignedAction === 'PLAN' || t.assignedAction === 'CA')
        );

        if (delegateCandidates.length > 0) {
            recs.push({
                id: 'delegate-candidates',
                type: 'suggestion',
                title: 'Delegation Candidates',
                description: `${delegateCandidates.length} lower priority tickets could be delegated`,
                tickets: delegateCandidates.map(t => t.key),
                suggestedAction: 'move-to-delegate',
                actionLabel: 'Move to DELEGATE'
            });
        }

        return recs;
    }, [tickets]);

    const handleApplyRecommendation = (recommendation) => {
        onAction(recommendation.suggestedAction, recommendation.tickets);
    };

    const handleApplySelected = () => {
        selectedRecommendations.forEach(recId => {
            const rec = recommendations.find(r => r.id === recId);
            if (rec) {
                onAction(rec.suggestedAction, rec.tickets);
            }
        });
        onClose();
    };

    const toggleRecommendation = (recId) => {
        setSelectedRecommendations(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recId)) {
                newSet.delete(recId);
            } else {
                newSet.add(recId);
            }
            return newSet;
        });
    };

    const getTypeStyles = (type) => {
        switch (type) {
            case 'critical':
                return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            case 'urgent':
                return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
            case 'warning':
                return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
            case 'info':
                return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
            case 'suggestion':
                return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
            default:
                return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'critical':
            case 'urgent':
                return (
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
            case 'info':
                return (
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
            case 'suggestion':
                return (
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                AI Grooming Recommendations
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Intelligent suggestions to optimize your backlog
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
                    {recommendations.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                Your backlog is well organized!
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">
                                No immediate recommendations at this time.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recommendations.map(rec => (
                                <div
                                    key={rec.id}
                                    className={`border rounded-lg p-4 transition-all ${getTypeStyles(rec.type)} ${
                                        selectedRecommendations.has(rec.id) ? 'ring-2 ring-blue-500' : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedRecommendations.has(rec.id)}
                                            onChange={() => toggleRecommendation(rec.id)}
                                            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        
                                        <div className="flex-shrink-0">
                                            {getTypeIcon(rec.type)}
                                        </div>
                                        
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                                {rec.title}
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                {rec.description}
                                            </p>
                                            
                                            <div className="mt-3 flex items-center gap-4">
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    Affected tickets: {rec.tickets.slice(0, 5).join(', ')}
                                                    {rec.tickets.length > 5 && ` and ${rec.tickets.length - 5} more`}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <button
                                            onClick={() => handleApplyRecommendation(rec)}
                                            className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                        >
                                            {rec.actionLabel}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {recommendations.length > 0 && (
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {selectedRecommendations.size} recommendation{selectedRecommendations.size !== 1 ? 's' : ''} selected
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApplySelected}
                                    disabled={selectedRecommendations.size === 0}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Apply Selected ({selectedRecommendations.size})
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroomingRecommendationsV2;