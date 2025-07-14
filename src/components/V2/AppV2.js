import React, { useState, useEffect, useCallback, useRef } from 'react';
import TopNavigationV2 from './TopNavigationV2';
import SidebarV2 from './SidebarV2';
import DashboardV2 from './DashboardV2';
import ClientsViewV2 from './ClientsViewV2';
import RulesViewV2 from './RulesViewV2';
import AnalyticsViewV2 from './AnalyticsViewV2';
import TicketsViewV2 from './TicketsViewV2';
import ImportConfigurationModalV2 from './ImportConfigurationModalV2';
import JiraErrorAlertV2 from './JiraErrorAlertV2';
import JiraConfigurationSimple from './JiraConfigurationSimple';
import JiraImportWizard from './JiraImportWizard';
import JiraConfig2Modal from './JiraConfig2Modal';

const AppV2 = ({ api }) => {
    const [darkMode, setDarkMode] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [notifications, setNotifications] = useState([]);
    const notificationsRef = useRef([]);
    
    // Data state
    const [tickets, setTickets] = useState([]);
    const [clients, setClients] = useState([]);
    const [globalRules, setGlobalRules] = useState([]);
    const [dashboards, setDashboards] = useState([]);
    const [currentDashboard, setCurrentDashboard] = useState(null);
    const [widgets, setWidgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [jiraError, setJiraError] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [showImportConfig, setShowImportConfig] = useState(false);
    const [showImportWizard, setShowImportWizard] = useState(false);
    const [showJiraConfig2, setShowJiraConfig2] = useState(false);

    // Keep notificationsRef in sync
    useEffect(() => {
        notificationsRef.current = notifications;
    }, [notifications]);

    const loadWidgets = useCallback(async (dashboardId) => {
        try {
            const widgetsData = await api.getWidgets(dashboardId);
            setWidgets(widgetsData);
        } catch (err) {
            console.error('Error loading widgets:', err);
        }
    }, [api]);

    const loadData = useCallback(async () => {
        try {
            setJiraError(null); // Clear any previous JIRA errors
            
            const [ticketsData, clientsData, rulesData, dashboardsData] = await Promise.all([
                api.getTickets(),
                api.getClients(),
                api.getGlobalRules(),
                api.getDashboards()
            ]);

            setTickets([...ticketsData.exceptions, ...ticketsData.regularTickets]);
            setClients(clientsData);
            setGlobalRules(rulesData);
            setDashboards(dashboardsData);

            // Set default dashboard
            const defaultDash = dashboardsData.find(d => d.is_default) || dashboardsData[0];
            if (defaultDash && !currentDashboard) {
                setCurrentDashboard(defaultDash);
                loadWidgets(defaultDash.id);
            } else if (!currentDashboard && dashboardsData.length > 0) {
                // If no current dashboard and no default, select the first one
                setCurrentDashboard(dashboardsData[0]);
                loadWidgets(dashboardsData[0].id);
            }

            // Check for new exceptions using ref to avoid circular dependency
            const newExceptions = ticketsData.exceptions.filter(ticket => 
                !notificationsRef.current.find(n => n.id === `exception-${ticket.key}`)
            );
            
            if (newExceptions.length > 0) {
                const newNotifications = newExceptions.map(ticket => ({
                    id: `exception-${ticket.key}`,
                    type: 'exception',
                    title: 'New Exception Ticket',
                    message: `${ticket.key}: ${ticket.summary}`,
                    timestamp: new Date(),
                    ticket
                }));
                setNotifications(prev => [...newNotifications, ...prev]);
            }

            setLoading(false);
        } catch (err) {
            // Check if it's a JIRA-specific error
            if (err.error && err.type) {
                setJiraError(err);
                // Still try to load other data even if tickets fail
                try {
                    const [clientsData, rulesData, dashboardsData] = await Promise.all([
                        api.getClients(),
                        api.getGlobalRules(),
                        api.getDashboards()
                    ]);
                    setClients(clientsData);
                    setGlobalRules(rulesData);
                    setDashboards(dashboardsData);
                } catch (fallbackErr) {
                    console.error('Failed to load fallback data:', fallbackErr);
                }
            } else {
                setError(err.message);
            }
            setLoading(false);
        }
    }, [api, currentDashboard, loadWidgets]);

    // Load initial data
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [loadData]);

    // Apply dark mode to document
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    const handleDashboardChange = async (dashboard) => {
        setCurrentDashboard(dashboard);
        await loadWidgets(dashboard.id);
    };

    // Quick Action Handlers for Sidebar
    const handleImportClick = async () => {
        // Check if JIRA is configured first
        try {
            const response = await fetch('/api/jira/config');
            const config = await response.json();
            
            if (config.configured) {
                // Show the import wizard
                setShowImportWizard(true);
            } else {
                // Show configuration screen first
                setCurrentView('jira-config');
            }
        } catch (error) {
            console.error('Error checking JIRA config:', error);
            setCurrentView('jira-config');
        }
    };

    const handleExportClick = () => {
        // Generate a simple CSV export of all tickets
        const csv = [
            ['Key', 'Summary', 'Client', 'Priority', 'Status', 'Action', 'Created', 'Updated'],
            ...tickets.map(t => [
                t.key,
                `"${t.summary.replace(/"/g, '""')}"`,
                t.client?.name || '',
                t.priority || '',
                t.status || '',
                t.assignedAction || '',
                t.created || '',
                t.updated || ''
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tiergarten-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleBackupClick = async () => {
        try {
            // Export all data as JSON
            const backupData = {
                timestamp: new Date().toISOString(),
                version: '2.0',
                tickets,
                clients,
                globalRules,
                dashboards,
                widgets
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tiergarten-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert('Failed to create backup: ' + error.message);
        }
    };

    const handleJiraConfig2Click = () => {
        setShowJiraConfig2(true);
    };

    const handleTicketAction = async (ticketKey, newAction) => {
        try {
            await api.updateTicketAction(ticketKey, newAction);
            await loadData();
        } catch (error) {
            console.error('Failed to update ticket action:', error);
            alert(`Failed to update ticket action: ${error.message}`);
        }
    };

    const handleQuickAction = (action, ticket) => {
        switch (action) {
            case 'view':
                // Open ticket detail modal
                console.log('View ticket:', ticket);
                break;
            case 'edit':
                // Open edit modal
                console.log('Edit ticket:', ticket);
                break;
            case 'escalate':
                handleTicketAction(ticket.key, 'CA');
                break;
            default:
                break;
        }
    };

    const handleSaveWidget = async (config) => {
        try {
            if (!currentDashboard) {
                console.error('No dashboard selected');
                alert('Please select a dashboard first');
                return;
            }
            
            const widgetData = { ...config, dashboard_id: currentDashboard.id };
            const savedWidget = await api.saveWidget(widgetData);
            
            // Update widgets state
            const updatedWidgets = config.id 
                ? widgets.map(w => w.id === config.id ? { ...config, id: savedWidget.id || config.id } : w)
                : [...widgets, { ...config, id: savedWidget.id }];
            
            setWidgets(updatedWidgets);
            return savedWidget;
        } catch (error) {
            console.error('Failed to save widget:', error);
            throw error;
        }
    };

    const getQuickStats = () => {
        const exceptions = tickets.filter(t => t.client?.isException);
        const highPriority = tickets.filter(t => 
            t.priority === 'Highest' || t.priority === 'High'
        );
        const activeTickets = tickets.filter(t => 
            t.status !== 'Closed' && t.status !== 'Resolved'
        );

        return {
            exceptions: exceptions.length,
            highPriority: highPriority.length,
            totalActive: activeTickets.length
        };
    };

    const getFilteredTickets = () => {
        if (!searchQuery) return tickets;
        
        const query = searchQuery.toLowerCase();
        return tickets.filter(ticket => 
            ticket.key.toLowerCase().includes(query) ||
            ticket.summary.toLowerCase().includes(query) ||
            ticket.client?.name?.toLowerCase().includes(query) ||
            ticket.assignedAction?.toLowerCase().includes(query)
        );
    };

    const renderCurrentView = () => {
        const filteredTickets = getFilteredTickets();
        
        switch (currentView) {
            case 'dashboard':
                return (
                    <DashboardV2
                        tickets={filteredTickets}
                        dashboards={dashboards}
                        currentDashboard={currentDashboard}
                        widgets={widgets}
                        onDashboardChange={handleDashboardChange}
                        onTicketAction={handleTicketAction}
                        onQuickAction={handleQuickAction}
                        onSaveWidget={handleSaveWidget}
                        api={api}
                        onWidgetsRefresh={() => loadWidgets(currentDashboard.id)}
                    />
                );
            case 'tickets':
                return (
                    <TicketsViewV2
                        tickets={filteredTickets}
                        onTicketAction={handleTicketAction}
                        onQuickAction={handleQuickAction}
                    />
                );
            case 'clients':
                return (
                    <ClientsViewV2
                        clients={clients}
                        api={api}
                        onRefresh={loadData}
                        showImportModal={isImportModalOpen}
                        setShowImportModal={setIsImportModalOpen}
                    />
                );
            case 'rules':
                return (
                    <RulesViewV2
                        rules={globalRules}
                        api={api}
                        onRefresh={loadData}
                    />
                );
            case 'analytics':
                return (
                    <AnalyticsViewV2
                        tickets={tickets}
                        clients={clients}
                    />
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading Tiergarten...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <p className="text-red-600 dark:text-red-400">Error: {error}</p>
                    <button 
                        onClick={loadData}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
            <TopNavigationV2
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                quickStats={getQuickStats()}
                notifications={notifications}
                setNotifications={setNotifications}
                api={api}
                onSync={loadData}
            />
            
            <div className="flex h-[calc(100vh-4rem)]">
                <SidebarV2
                    collapsed={sidebarCollapsed}
                    setCollapsed={setSidebarCollapsed}
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    api={api}
                    onImportClick={handleImportClick}
                    onExportClick={handleExportClick}
                    onBackupClick={handleBackupClick}
                    onJiraConfig2Click={handleJiraConfig2Click}
                />
                
                <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
                    <div className="p-6">
                        {/* JIRA Error Alert */}
                        {jiraError && (
                            <JiraErrorAlertV2
                                error={jiraError}
                                onRetry={loadData}
                                onOpenSettings={() => setShowImportConfig(true)}
                            />
                        )}
                        
                        {/* JIRA Configuration - Show when not configured */}
                        {currentView === 'jira-config' && (
                            <JiraConfigurationSimple 
                                api={api} 
                                onConfigured={() => {
                                    setCurrentView('dashboard');
                                    loadData();
                                }}
                            />
                        )}
                        
                        {/* Main Content */}
                        {currentView !== 'jira-config' && renderCurrentView()}
                    </div>
                </main>
            </div>

            {/* Import Configuration Modal */}
            {showImportConfig && (
                <ImportConfigurationModalV2
                    api={api}
                    existingClients={clients}
                    onClose={() => setShowImportConfig(false)}
                    onImport={() => {
                        loadData();
                        setShowImportConfig(false);
                    }}
                />
            )}
            
            {/* JIRA Import Wizard */}
            {showImportWizard && (
                <JiraImportWizard
                    api={api}
                    onClose={() => setShowImportWizard(false)}
                    onImportComplete={() => {
                        setShowImportWizard(false);
                        loadData();
                    }}
                />
            )}
            
            {/* JIRA Config 2.0 Modal */}
            {showJiraConfig2 && (
                <JiraConfig2Modal
                    isOpen={showJiraConfig2}
                    onClose={() => setShowJiraConfig2(false)}
                    api={api}
                />
            )}
        </div>
    );
};

export default AppV2;