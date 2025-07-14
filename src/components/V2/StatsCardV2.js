import React from 'react';

const StatsCardV2 = ({ title, value, change, subtitle, icon, color, improvement = false, warning = false }) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
        green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
        amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        red: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    };

    const getChangeColor = () => {
        if (improvement) {
            return change < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        }
        return change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    };

    const getChangeIcon = () => {
        if (change > 0) {
            return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
        } else {
            return 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
                    <p className={`text-2xl font-bold mt-1 ${warning ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
                    )}
                </div>
                <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                    </svg>
                </div>
            </div>
            {change !== undefined && change !== 0 && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${getChangeColor()}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getChangeIcon()} />
                    </svg>
                    <span className="font-medium">{Math.abs(change)}%</span>
                    <span className="text-gray-500 dark:text-gray-400">from last week</span>
                </div>
            )}
        </div>
    );
};

export default StatsCardV2;