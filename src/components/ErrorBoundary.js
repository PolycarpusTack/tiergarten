import React, { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorCount: 0
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log error details for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        
        // Update state with error details
        this.setState(prevState => ({
            error,
            errorInfo,
            errorCount: prevState.errorCount + 1
        }));

        // You can also log to an error reporting service here
        // Example: logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Customize this error UI based on your design system
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        
                        <h2 className="mt-4 text-xl font-semibold text-center text-gray-900 dark:text-white">
                            Oops! Something went wrong
                        </h2>
                        
                        <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                            We encountered an unexpected error. The error has been logged and we'll look into it.
                        </p>

                        {/* Show error details in development */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-4">
                                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                                    Error Details (Development Only)
                                </summary>
                                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono overflow-auto">
                                    <div className="text-red-600 dark:text-red-400">
                                        {this.state.error.toString()}
                                    </div>
                                    {this.state.errorInfo && (
                                        <div className="mt-2 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                            {this.state.errorInfo.componentStack}
                                        </div>
                                    )}
                                </div>
                            </details>
                        )}

                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                            >
                                Reload Page
                            </button>
                        </div>

                        {this.state.errorCount > 2 && (
                            <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
                                If this error persists, please contact support.
                            </p>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Create a hook for functional components to use error boundary
export const useErrorHandler = () => {
    return (error) => {
        throw error;
    };
};

export default ErrorBoundary;