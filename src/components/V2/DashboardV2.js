import React, { useState } from 'react';
import DashboardSwitcherV2 from './DashboardSwitcherV2';
import WidgetConfigV2 from './WidgetConfigV2';
import WidgetV2 from './WidgetV2';
import StatsCardV2 from './StatsCardV2';
import BacklogGroomingToolbarV2 from './BacklogGroomingToolbarV2';
import GroomingRecommendationsV2 from './GroomingRecommendationsV2';

const DashboardV2 = ({ 
    tickets, 
    dashboards, 
    currentDashboard, 
    widgets, 
    onDashboardChange,
    onTicketAction,
    onQuickAction,
    onSaveWidget,
    api,
    onWidgetsRefresh 
}) => {
    const [viewMode, setViewMode] = useState('grid'); // grid, list, kanban
    const [showWidgetConfig, setShowWidgetConfig] = useState(false);
    const [editingWidget, setEditingWidget] = useState(null);
    
    // Backlog Grooming States
    const [selectedBacklogTickets, setSelectedBacklogTickets] = useState(new Set());
    const [showGroomingRecommendations, setShowGroomingRecommendations] = useState(false);

    // Calculate dashboard stats
    const stats = {
        totalTickets: tickets.length,
        caActions: tickets.filter(t => t.assignedAction === 'CA').length,
        avgResolutionTime: '4.2h', // This would be calculated from actual data
        slaCompliance: 94,
        weeklyChange: {
            totalTickets: 12,
            caActions: 18,
            avgResolutionTime: -23,
            slaCompliance: -1
        }
    };

    const exceptions = tickets.filter(t => t.client?.isException);
    const hasExceptions = exceptions.length > 0;

    const handleAddWidget = () => {
        setEditingWidget(null);
        setShowWidgetConfig(true);
    };

    const handleEditWidget = (widget) => {
        setEditingWidget(widget);
        setShowWidgetConfig(true);
    };

    const handleDeleteWidget = async (widgetId) => {
        if (window.confirm('Are you sure you want to delete this widget?')) {
            await api.deleteWidget(widgetId);
            // Refresh widgets without reloading the page
            if (onWidgetsRefresh) {
                onWidgetsRefresh();
            }
        }
    };

    const handleCreateDashboard = async () => {
        const name = prompt('Enter dashboard name:');
        if (!name) return;
        
        try {
            await api.saveDashboard({ name });
            // Reload to show new dashboard
            window.location.reload();
        } catch (error) {
            alert('Failed to create dashboard');
        }
    };
    
    const handleManageDashboards = () => {
        // For now, just allow renaming current dashboard
        const newName = prompt('Rename dashboard:', currentDashboard.name);
        if (!newName || newName === currentDashboard.name) return;
        
        api.saveDashboard({ ...currentDashboard, name: newName })
            .then(() => {
                // Reload to show updated name
                window.location.reload();
            })
            .catch(() => alert('Failed to rename dashboard'));
    };


    // Backlog Grooming Handler
    const handleBacklogBulkAction = async (action, ticketIds) => {
        try {
            const selectedTickets = tickets.filter(t => ticketIds.includes(t.key));
            
            switch (action) {
                case 'escalate-to-plan':
                    for (const ticket of selectedTickets) {
                        await onTicketAction(ticket.key, 'PLAN');
                    }
                    break;
                case 'escalate-to-ca':
                    for (const ticket of selectedTickets) {
                        await onTicketAction(ticket.key, 'CA');
                    }
                    break;
                case 'move-to-delegate':
                    for (const ticket of selectedTickets) {
                        await onTicketAction(ticket.key, 'DELEGATE');
                    }
                    break;
                case 'move-to-later':
                    for (const ticket of selectedTickets) {
                        await onTicketAction(ticket.key, 'LATER');
                    }
                    break;
                case 'move-to-monitor':
                    for (const ticket of selectedTickets) {
                        await onTicketAction(ticket.key, 'MONITOR');
                    }
                    break;
                case 'archive':
                    // For now, we'll just alert - could be extended to actual archiving
                    alert(`Would archive ${selectedTickets.length} tickets`);
                    break;
                default:
                    console.warn('Unknown bulk action:', action);
            }
            
            // Clear selection and close recommendations
            setSelectedBacklogTickets(new Set());
            setShowGroomingRecommendations(false);
            
            // Refresh the page to update ticket list
            window.location.reload();
            
        } catch (error) {
            console.error('Error performing bulk action:', error);
            alert('Failed to perform bulk action');
        }
    };

    return (
        <div className="p-6">
            {/* Page Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {currentDashboard?.name || 'Dashboard'}
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Real-time ticket management and prioritization
                            </p>
                        </div>
                        <DashboardSwitcherV2
                            dashboards={dashboards}
                            currentDashboard={currentDashboard}
                            onSwitch={onDashboardChange}
                            onCreateNew={handleCreateDashboard}
                            onManage={handleManageDashboards}
                        />
                    </div>
                    
                    {/* View Controls */}
                    <div className="flex items-center space-x-4">
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    viewMode === 'grid' 
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                Grid View
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    viewMode === 'list' 
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                List View
                            </button>
                            <button 
                                onClick={() => setViewMode('kanban')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    viewMode === 'kanban' 
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                Kanban
                            </button>
                        </div>

                        <button 
                            onClick={handleAddWidget}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                            title="Add Widget"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>

                        <button 
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                            title="Refresh"
                            onClick={() => window.location.reload()}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Backlog Grooming Toolbar */}
            {currentDashboard?.name === 'Backlog Grooming' && (
                <BacklogGroomingToolbarV2
                    selectedTickets={selectedBacklogTickets}
                    onBulkAction={handleBacklogBulkAction}
                    tickets={tickets}
                    onShowRecommendations={() => setShowGroomingRecommendations(true)}
                />
            )}

            {/* Exception Alert */}
            {hasExceptions && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl animate-pulse-border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="ml-3 flex-1">
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                                {exceptions.length} Exception ticket{exceptions.length > 1 ? 's' : ''} require immediate attention
                            </h3>
                            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                {exceptions.slice(0, 3).map(ticket => (
                                    <div key={ticket.key} className="flex items-center gap-2">
                                        <span className="font-mono font-semibold">{ticket.key}</span>
                                        <span className="text-red-600 dark:text-red-400">•</span>
                                        <span className="truncate">{ticket.summary}</span>
                                        <span className="text-red-600 dark:text-red-400">•</span>
                                        <span className="font-medium">{ticket.client.name}</span>
                                    </div>
                                ))}
                                {exceptions.length > 3 && (
                                    <div className="text-red-600 dark:text-red-400 font-medium">
                                        ... and {exceptions.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="ml-4">
                            <button 
                                onClick={() => {
                                    // Filter to show only exceptions
                                    console.log('View exceptions');
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium animate-pulse-slow"
                            >
                                View Exceptions
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Widget Grid */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 mb-8">
                    {widgets.map((widget) => (
                        <WidgetV2
                            key={widget.id}
                            widget={widget}
                            tickets={tickets}
                            onEdit={() => handleEditWidget(widget)}
                            onDelete={() => handleDeleteWidget(widget.id)}
                            onTicketAction={onTicketAction}
                            onQuickAction={onQuickAction}
                            // Pass selection handlers for backlog grooming
                            selectedTickets={currentDashboard?.name === 'Backlog Grooming' ? selectedBacklogTickets : null}
                            onToggleTicketSelection={currentDashboard?.name === 'Backlog Grooming' ? (ticketId) => {
                                setSelectedBacklogTickets(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(ticketId)) {
                                        newSet.delete(ticketId);
                                    } else {
                                        newSet.add(ticketId);
                                    }
                                    return newSet;
                                });
                            } : null}
                        />
                    ))}
                    
                    {/* Add Widget Card */}
                    <div 
                        onClick={handleAddWidget}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer group"
                    >
                        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400 group-hover:text-blue-500 transition-colors">
                            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-sm font-medium">Add New Widget</span>
                        </div>
                    </div>
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                        List view coming soon...
                    </p>
                </div>
            )}

            {/* Kanban View */}
            {viewMode === 'kanban' && (
                <div className="flex gap-6 overflow-x-auto pb-4">
                    {['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR'].map(action => {
                        const actionTickets = tickets.filter(t => t.assignedAction === action);
                        return (
                            <div key={action} className="flex-shrink-0 w-80">
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{action}</h3>
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                                                {actionTickets.length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                                        {actionTickets.length === 0 ? (
                                            <p className="text-gray-400 dark:text-gray-500 text-center py-8 text-sm">
                                                No tickets
                                            </p>
                                        ) : (
                                            actionTickets.map(ticket => (
                                                <div key={ticket.key} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                                                            {ticket.key}
                                                        </span>
                                                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                                            ticket.priority === 'Highest' ? 'bg-red-100 text-red-700' :
                                                            ticket.priority === 'High' ? 'bg-amber-100 text-amber-700' :
                                                            ticket.priority === 'Medium' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {ticket.priority}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                                                        {ticket.summary}
                                                    </p>
                                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                        {ticket.client.name} • Tier {ticket.client.tier}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCardV2
                    title="Total Tickets"
                    value={stats.totalTickets}
                    change={stats.weeklyChange.totalTickets}
                    icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    color="blue"
                />
                <StatsCardV2
                    title="CA Actions"
                    value={stats.caActions}
                    change={stats.weeklyChange.caActions}
                    subtitle={`${Math.round(stats.caActions / stats.totalTickets * 100)}% of total`}
                    icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    color="purple"
                />
                <StatsCardV2
                    title="Avg Resolution"
                    value={stats.avgResolutionTime}
                    change={stats.weeklyChange.avgResolutionTime}
                    icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    color="green"
                    improvement
                />
                <StatsCardV2
                    title="SLA Compliance"
                    value={`${stats.slaCompliance}%`}
                    change={stats.weeklyChange.slaCompliance}
                    subtitle="Target: 95%"
                    icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    color="amber"
                    warning={stats.slaCompliance < 95}
                />
            </div>

            {/* Widget Config Modal */}
            {showWidgetConfig && (
                <WidgetConfigV2
                    onCancel={() => setShowWidgetConfig(false)}
                    onSave={onSaveWidget}
                    widget={editingWidget}
                />
            )}
            
            {/* Grooming Recommendations Modal */}
            {showGroomingRecommendations && (
                <GroomingRecommendationsV2
                    tickets={tickets}
                    onAction={handleBacklogBulkAction}
                    onClose={() => setShowGroomingRecommendations(false)}
                />
            )}
        </div>
    );
};

export default DashboardV2;