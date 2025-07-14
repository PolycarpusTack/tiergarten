import React, { useState } from 'react';

const TopNavigationV2 = ({ 
    darkMode, 
    setDarkMode, 
    searchQuery, 
    setSearchQuery, 
    quickStats,
    notifications,
    setNotifications,
    api,
    onSync
}) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleSync = async () => {
        setSyncing(true);
        try {
            // Trigger the sync through the parent component
            if (onSync) {
                await onSync();
            }
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setSyncing(false);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    const handleNotificationClick = (notification) => {
        // Mark as read
        setNotifications(prev => 
            prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
        // Handle specific notification types
        if (notification.type === 'exception' && notification.ticket) {
            // Could open ticket detail modal here
            console.log('Open exception ticket:', notification.ticket);
        }
    };

    const clearAllNotifications = () => {
        setNotifications([]);
        setShowNotifications(false);
    };

    return (
        <>
            <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 backdrop-blur-lg bg-opacity-90 dark:bg-opacity-90">
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
                                        className="w-96 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                    <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    {searchQuery && (
                                        <button
                                            onClick={handleClearSearch}
                                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center space-x-4">
                            {/* Quick Stats */}
                            <div className="hidden lg:flex items-center space-x-6">
                                <div className="text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors">
                                    <p className="text-2xl font-bold text-red-600">{quickStats.exceptions}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Exceptions</p>
                                </div>
                                <div className="text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors">
                                    <p className="text-2xl font-bold text-amber-600">{quickStats.highPriority}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">High Priority</p>
                                </div>
                                <div className="text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors">
                                    <p className="text-2xl font-bold text-blue-600">{quickStats.totalActive}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Active</p>
                                </div>
                            </div>

                            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />

                            {/* Action Buttons */}
                            <button 
                                onClick={handleSync}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                disabled={syncing}
                            >
                                <svg className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {syncing ? 'Syncing...' : 'Sync'}
                            </button>

                            {/* Notifications */}
                            <div className="relative">
                                <button 
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    {unreadCount > 0 && (
                                        <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                                    )}
                                </button>

                                {/* Notifications Dropdown */}
                                {showNotifications && (
                                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                                            {notifications.length > 0 && (
                                                <button 
                                                    onClick={clearAllNotifications}
                                                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                                >
                                                    Clear all
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-96 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <p className="p-4 text-center text-gray-500 dark:text-gray-400">No new notifications</p>
                                            ) : (
                                                notifications.map(notification => (
                                                    <button
                                                        key={notification.id}
                                                        onClick={() => handleNotificationClick(notification)}
                                                        className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                                    >
                                                        <div className="flex items-start">
                                                            <div className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${notification.type === 'exception' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                                            <div className="ml-3">
                                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{notification.title}</p>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">{notification.message}</p>
                                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                                    {new Date(notification.timestamp).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

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
                                <button 
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                                        U
                                    </div>
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* User Menu Dropdown */}
                                {showUserMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                            Profile Settings
                                        </button>
                                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                            Preferences
                                        </button>
                                        <hr className="border-gray-200 dark:border-gray-700" />
                                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

        </>
    );
};

export default TopNavigationV2;