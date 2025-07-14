import React from 'react';

const JiraErrorAlertV2 = ({ error, onRetry, onOpenSettings }) => {
    if (!error || !error.error) return null;

    // Map error types to icons and styles
    const errorConfig = {
        NETWORK_ERROR: {
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
            ),
            bgColor: 'bg-amber-50 dark:bg-amber-950/20',
            borderColor: 'border-amber-200 dark:border-amber-800',
            iconColor: 'text-amber-600 dark:text-amber-400',
            textColor: 'text-amber-800 dark:text-amber-200',
            title: 'Connection Problem'
        },
        AUTHENTICATION_ERROR: {
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
            bgColor: 'bg-red-50 dark:bg-red-950/20',
            borderColor: 'border-red-200 dark:border-red-800',
            iconColor: 'text-red-600 dark:text-red-400',
            textColor: 'text-red-800 dark:text-red-200',
            title: 'Authentication Failed'
        },
        RATE_LIMIT_ERROR: {
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
            bgColor: 'bg-orange-50 dark:bg-orange-950/20',
            borderColor: 'border-orange-200 dark:border-orange-800',
            iconColor: 'text-orange-600 dark:text-orange-400',
            textColor: 'text-orange-800 dark:text-orange-200',
            title: 'Rate Limit Exceeded'
        },
        PERMISSION_ERROR: {
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
            bgColor: 'bg-red-50 dark:bg-red-950/20',
            borderColor: 'border-red-200 dark:border-red-800',
            iconColor: 'text-red-600 dark:text-red-400',
            textColor: 'text-red-800 dark:text-red-200',
            title: 'Permission Denied'
        },
        TIMEOUT_ERROR: {
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
            ),
            bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
            borderColor: 'border-yellow-200 dark:border-yellow-800',
            iconColor: 'text-yellow-600 dark:text-yellow-400',
            textColor: 'text-yellow-800 dark:text-yellow-200',
            title: 'Request Timeout'
        },
        default: {
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
            bgColor: 'bg-red-50 dark:bg-red-950/20',
            borderColor: 'border-red-200 dark:border-red-800',
            iconColor: 'text-red-600 dark:text-red-400',
            textColor: 'text-red-800 dark:text-red-200',
            title: 'Error'
        }
    };

    const config = errorConfig[error.type] || errorConfig.default;

    // Get action buttons based on error type
    const getActionButtons = () => {
        const buttons = [];

        // Retry button for most errors
        if (['NETWORK_ERROR', 'TIMEOUT_ERROR', 'RATE_LIMIT_ERROR'].includes(error.type)) {
            buttons.push(
                <button
                    key="retry"
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                </button>
            );
        }

        // Settings button for auth/permission errors
        if (['AUTHENTICATION_ERROR', 'PERMISSION_ERROR'].includes(error.type)) {
            buttons.push(
                <button
                    key="settings"
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Configure JIRA
                </button>
            );
        }

        return buttons;
    };

    // Get helpful message based on error type
    const getHelpMessage = () => {
        switch (error.type) {
            case 'NETWORK_ERROR':
                return 'Check your internet connection and try again.';
            case 'AUTHENTICATION_ERROR':
                return 'Your JIRA credentials may be incorrect or expired. Please update them in settings.';
            case 'RATE_LIMIT_ERROR':
                return `You've made too many requests. Please wait ${error.retryAfter || 'a moment'} before trying again.`;
            case 'PERMISSION_ERROR':
                return 'You don\'t have permission to access this JIRA instance. Contact your administrator.';
            case 'TIMEOUT_ERROR':
                return 'The request took too long. JIRA may be slow or unavailable.';
            default:
                return 'An unexpected error occurred while connecting to JIRA.';
        }
    };

    return (
        <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-6`}>
            <div className="flex gap-4">
                <div className={`flex-shrink-0 ${config.iconColor}`}>
                    {config.icon}
                </div>
                <div className="flex-grow">
                    <h3 className={`text-sm font-semibold ${config.textColor} mb-1`}>
                        {config.title}
                    </h3>
                    <div className={`text-sm ${config.textColor} opacity-90 space-y-1`}>
                        <p>{error.error}</p>
                        <p className="text-xs opacity-75">{getHelpMessage()}</p>
                    </div>
                    {error.details && (
                        <details className="mt-2">
                            <summary className={`text-xs ${config.textColor} opacity-75 cursor-pointer hover:opacity-100`}>
                                Technical details
                            </summary>
                            <pre className="mt-1 text-xs opacity-75 overflow-x-auto">
                                {JSON.stringify(error.details, null, 2)}
                            </pre>
                        </details>
                    )}
                    <div className="mt-3 flex gap-2">
                        {getActionButtons()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JiraErrorAlertV2;