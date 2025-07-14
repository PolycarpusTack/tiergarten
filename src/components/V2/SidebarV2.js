import React from 'react';

const SidebarV2 = ({ collapsed, setCollapsed, currentView, setCurrentView, api, onImportClick, onExportClick, onBackupClick, onJiraConfig2Click }) => {
    const navigationItems = [
        { 
            id: 'dashboard', 
            label: 'Dashboard', 
            icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' 
        },
        { 
            id: 'tickets', 
            label: 'Tickets', 
            icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' 
        },
        { 
            id: 'clients', 
            label: 'Clients', 
            icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' 
        },
        { 
            id: 'rules', 
            label: 'Rules', 
            icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' 
        },
        { 
            id: 'analytics', 
            label: 'Analytics', 
            icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' 
        },
        { 
            id: 'jira-config', 
            label: 'JIRA Config', 
            icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' 
        },
    ];

    const quickActions = [
        { label: 'Import Configuration', action: 'import' },
        { label: 'JIRA Config 2.0', action: 'jira-config2' },
        { label: 'Export Report', action: 'export' },
        { label: 'Backup Data', action: 'backup' },
    ];

    const handleQuickAction = (action) => {
        switch (action) {
            case 'import':
                if (onImportClick) {
                    onImportClick();
                } else {
                    console.log('Import from JIRA - handler not provided');
                }
                break;
            case 'jira-config2':
                if (onJiraConfig2Click) {
                    onJiraConfig2Click();
                } else {
                    console.log('JIRA Config 2.0 - handler not provided');
                }
                break;
            case 'export':
                if (onExportClick) {
                    onExportClick();
                } else {
                    console.log('Export report - functionality not implemented yet');
                    alert('Export functionality coming soon!');
                }
                break;
            case 'backup':
                if (onBackupClick) {
                    onBackupClick();
                } else {
                    console.log('Backup data - functionality not implemented yet');
                    alert('Backup functionality coming soon!');
                }
                break;
            default:
                break;
        }
    };

    return (
        <aside className={`
            ${collapsed ? 'w-16' : 'w-64'}
            bg-white dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border 
            transition-all duration-300 flex flex-col
        `}>
            {/* Sidebar Toggle */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center justify-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {collapsed ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {navigationItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={`
                            w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200
                            ${currentView === item.id
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }
                        `}
                        title={collapsed ? item.label : ''}
                    >
                        <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                        {!collapsed && (
                            <span className="ml-3 font-medium">{item.label}</span>
                        )}
                        {!collapsed && currentView === item.id && (
                            <div className="ml-auto w-1 h-6 bg-blue-600 rounded-full"></div>
                        )}
                    </button>
                ))}
            </nav>

            {/* Quick Actions (only visible when expanded) */}
            {!collapsed && (
                <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        Quick Actions
                    </p>
                    <div className="space-y-2">
                        {quickActions.map((action) => (
                            <button
                                key={action.action}
                                onClick={() => handleQuickAction(action.action)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center"
                            >
                                <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Sidebar Footer - System Status */}
            <div className={`px-3 py-4 border-t border-gray-200 dark:border-gray-700 ${collapsed ? 'text-center' : ''}`}>
                <div className="flex items-center justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    {!collapsed && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">System Online</span>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default SidebarV2;