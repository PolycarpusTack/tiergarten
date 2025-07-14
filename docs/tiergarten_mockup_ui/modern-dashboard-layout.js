import React, { useState } from 'react';

const ModernDashboard = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-dark-bg' : 'bg-gray-50'}`}>
      {/* Top Navigation Bar */}
      <nav className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border sticky top-0 z-50 backdrop-blur-lg bg-opacity-90 dark:bg-opacity-90">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side */}
            <div className="flex items-center">
              {/* Logo/Brand */}
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Tiergarten
                </h1>
              </div>

              {/* Global Search */}
              <div className="ml-8 flex items-center">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tickets, clients, or actions..."
                    className="w-96 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <kbd className="absolute right-3 top-2.5 px-2 py-0.5 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded">
                      ESC
                    </kbd>
                  )}
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Quick Stats */}
              <div className="hidden lg:flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">3</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Exceptions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">12</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">High Priority</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">45</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Active</p>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />

              {/* Action Buttons */}
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Widget
              </button>

              {/* Notifications */}
              <button className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                {darkMode ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* User Menu */}
              <div className="relative">
                <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                    JD
                  </div>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className={`
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          bg-white dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border transition-all duration-300 flex flex-col
        `}>
          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Navigation Items */}
          <nav className="flex-1 px-2 pb-4 space-y-1">
            {[
              { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Dashboard', active: true },
              { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', label: 'Tickets' },
              { icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', label: 'Clients' },
              { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Rules' },
              { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Analytics' },
            ].map((item, index) => (
              <button
                key={index}
                className={`
                  w-full flex items-center px-3 py-2 rounded-lg transition-colors
                  ${item.active 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {!sidebarCollapsed && (
                  <span className="ml-3 font-medium">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className={`${sidebarCollapsed ? 'hidden' : 'block'}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Actions</p>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                  Import from JIRA
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                  Export Report
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-dark-bg p-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Overview Dashboard</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time ticket management and prioritization</p>
              </div>
              
              {/* View Controls */}
              <div className="flex items-center space-x-4">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button className="px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm font-medium shadow-sm">
                    Grid View
                  </button>
                  <button className="px-3 py-1.5 text-gray-600 dark:text-gray-400 rounded-md text-sm font-medium hover:text-gray-900 dark:hover:text-gray-100">
                    List View
                  </button>
                  <button className="px-3 py-1.5 text-gray-600 dark:text-gray-400 rounded-md text-sm font-medium hover:text-gray-900 dark:hover:text-gray-100">
                    Kanban
                  </button>
                </div>

                <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Exception Alert */}
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  3 Exception tickets require immediate attention
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Critical issues from A+E Networks need to be addressed urgently.
                </p>
              </div>
              <div className="ml-auto">
                <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                  View Exceptions
                </button>
              </div>
            </div>
          </div>

          {/* Widget Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Placeholder for widgets */}
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Active CA Tickets</h3>
              <div className="space-y-3">
                {/* Ticket cards would go here */}
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Widget content
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Planning Queue</h3>
              <div className="space-y-3">
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Widget content
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Delegation Pending</h3>
              <div className="space-y-3">
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Widget content
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ModernDashboard;