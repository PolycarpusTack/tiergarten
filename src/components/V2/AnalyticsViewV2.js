import React, { useState, useMemo } from 'react';

// Available fields for analysis
const AVAILABLE_FIELDS = {
    dimensions: [
        { id: 'client', label: 'Client', icon: '🏢', getValue: (ticket) => ticket.client?.name || 'Unknown' },
        { id: 'tier', label: 'Tier', icon: '🎯', getValue: (ticket) => `Tier ${ticket.client?.tier || 'Unknown'}` },
        { id: 'action', label: 'Action', icon: '⚡', getValue: (ticket) => ticket.assignedAction || 'None' },
        { id: 'priority', label: 'JIRA Priority', icon: '🔴', getValue: (ticket) => ticket.priority || 'None' },
        { id: 'mgxPriority', label: 'MGX Priority', icon: '💠', getValue: (ticket) => ticket.mgxPriority || 'None' },
        { id: 'customerPriority', label: 'Customer Priority', icon: '👤', getValue: (ticket) => ticket.customerPriority || 'None' },
        { id: 'status', label: 'Status', icon: '📊', getValue: (ticket) => ticket.status },
        { id: 'isCA', label: 'CA Status', icon: '🤝', getValue: (ticket) => ticket.client?.isCA ? 'CA Client' : 'Non-CA' },
        { id: 'isException', label: 'Exception Status', icon: '⚠️', getValue: (ticket) => ticket.client?.isException ? 'Exception' : 'Regular' },
        { id: 'isGlobal', label: 'Global Status', icon: '🌍', getValue: (ticket) => ticket.client?.isGlobal ? 'Global' : 'Non-Global' },
        { id: 'project', label: 'Project Key', icon: '📁', getValue: (ticket) => ticket.key.split('-')[0] },
        { id: 'assignee', label: 'Assignee', icon: '👨‍💼', getValue: (ticket) => ticket.assignee || 'Unassigned' },
        { id: 'reporter', label: 'Reporter', icon: '📝', getValue: (ticket) => ticket.reporter || 'Unknown' },
        { id: 'labels', label: 'Has Labels', icon: '🏷️', getValue: (ticket) => ticket.labels?.length > 0 ? 'Has Labels' : 'No Labels' },
        { id: 'components', label: 'Has Components', icon: '🧩', getValue: (ticket) => ticket.components?.length > 0 ? 'Has Components' : 'No Components' },
        { id: 'month', label: 'Month Created', icon: '📅', getValue: (ticket) => {
            const date = new Date(ticket.created);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }},
        { id: 'week', label: 'Week Created', icon: '📆', getValue: (ticket) => {
            const date = new Date(ticket.created);
            const week = Math.ceil(date.getDate() / 7);
            return `${date.getFullYear()}-W${week}`;
        }},
        { id: 'ageGroup', label: 'Age Group', icon: '⏰', getValue: (ticket) => {
            const created = new Date(ticket.created);
            const now = new Date();
            const age = Math.floor((now - created) / (1000 * 60 * 60 * 24));
            if (age <= 7) return '0-7 days';
            if (age <= 14) return '8-14 days';
            if (age <= 30) return '15-30 days';
            if (age <= 60) return '31-60 days';
            return '60+ days';
        }}
    ],
    measures: [
        { id: 'count', label: 'Count', icon: '🔢', aggregate: (tickets) => tickets.length },
        { id: 'uniqueClients', label: 'Unique Clients', icon: '🏢', aggregate: (tickets) => new Set(tickets.map(t => t.client?.id)).size },
        { id: 'avgAge', label: 'Avg Age (days)', icon: '📊', aggregate: (tickets) => {
            if (tickets.length === 0) return 0;
            const now = Date.now();
            let validCount = 0;
            const totalAge = tickets.reduce((sum, ticket) => {
                const created = new Date(ticket.created).getTime();
                if (!isNaN(created)) {
                    validCount++;
                    return sum + Math.floor((now - created) / (1000 * 60 * 60 * 24));
                }
                return sum;
            }, 0);
            return validCount > 0 ? Math.round(totalAge / validCount) : 0;
        }},
        { id: 'maxAge', label: 'Max Age (days)', icon: '⏳', aggregate: (tickets) => {
            if (tickets.length === 0) return 0;
            const now = Date.now();
            const ages = tickets.map(ticket => {
                const created = new Date(ticket.created).getTime();
                return isNaN(created) ? 0 : Math.floor((now - created) / (1000 * 60 * 60 * 24));
            }).filter(age => age > 0);
            return ages.length > 0 ? Math.max(...ages) : 0;
        }},
        { id: 'openCount', label: 'Open Tickets', icon: '🟢', aggregate: (tickets) => tickets.filter(t => ['Open', 'New', 'In Progress'].includes(t.status)).length },
        { id: 'closedCount', label: 'Closed Tickets', icon: '✅', aggregate: (tickets) => tickets.filter(t => ['Closed', 'Resolved'].includes(t.status)).length },
        { id: 'highPriorityCount', label: 'High Priority (JIRA)', icon: '🔴', aggregate: (tickets) => tickets.filter(t => ['Highest', 'High'].includes(t.priority)).length },
        { id: 'mgxPrio1Count', label: 'MGX Prio 1 Count', icon: '💠', aggregate: (tickets) => tickets.filter(t => t.mgxPriority === 'Prio 1').length },
        { id: 'caActionCount', label: 'CA Action Count', icon: '⚡', aggregate: (tickets) => tickets.filter(t => t.assignedAction === 'CA').length },
        { id: 'exceptionCount', label: 'Exception Count', icon: '⚠️', aggregate: (tickets) => tickets.filter(t => t.client?.isException).length },
        { id: 'globalClientCount', label: 'Global Client Count', icon: '🌍', aggregate: (tickets) => tickets.filter(t => t.client?.isGlobal).length }
    ]
};

// Analysis presets
const ANALYSIS_PRESETS = [
    {
        id: 'action-tier',
        name: 'Action by Tier',
        icon: '🎯',
        description: 'View ticket distribution by action and tier',
        config: { rowDimension: 'action', columnDimension: 'tier', measure: 'count' }
    },
    {
        id: 'mgx-priority',
        name: 'MGX Priority Analysis',
        icon: '💠',
        description: 'Analyze tickets by MGX priority and status',
        config: { rowDimension: 'mgxPriority', columnDimension: 'status', measure: 'count' }
    },
    {
        id: 'client-performance',
        name: 'Client Performance',
        icon: '🏢',
        description: 'Compare clients by tier and global status',
        config: { rowDimension: 'client', columnDimension: 'isGlobal', measure: 'count' }
    },
    {
        id: 'age-distribution',
        name: 'Age Distribution',
        icon: '⏰',
        description: 'View ticket age groups by action',
        config: { rowDimension: 'ageGroup', columnDimension: 'action', measure: 'count' }
    },
    {
        id: 'exception-analysis',
        name: 'Exception Analysis',
        icon: '⚠️',
        description: 'Analyze exception vs regular tickets',
        config: { rowDimension: 'isException', columnDimension: 'action', measure: 'avgAge' }
    }
];

const AnalyticsViewV2 = ({ tickets, clients }) => {
    // const [activeTab, setActiveTab] = useState('analysis');
    const [rowDimension, setRowDimension] = useState('action');
    const [columnDimension, setColumnDimension] = useState('tier');
    const [selectedMeasure, setSelectedMeasure] = useState('count');
    const [showPercentages, setShowPercentages] = useState(false);
    const [filters, setFilters] = useState({});
    const [viewMode, setViewMode] = useState('pivot');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Filter tickets based on active filters
    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            for (const [fieldId, filterValues] of Object.entries(filters)) {
                if (filterValues && filterValues.length > 0) {
                    const field = AVAILABLE_FIELDS.dimensions.find(f => f.id === fieldId);
                    if (field) {
                        const value = field.getValue(ticket);
                        if (!filterValues.includes(value)) {
                            return false;
                        }
                    }
                }
            }
            return true;
        });
    }, [tickets, filters]);

    // Calculate pivot table data
    const pivotData = useMemo(() => {
        const rowField = AVAILABLE_FIELDS.dimensions.find(f => f.id === rowDimension);
        const colField = AVAILABLE_FIELDS.dimensions.find(f => f.id === columnDimension);
        const measure = AVAILABLE_FIELDS.measures.find(m => m.id === selectedMeasure);

        if (!rowField || !colField || !measure) return null;

        // Group tickets by row and column dimensions
        const grouped = {};
        const rowValues = new Set();
        const colValues = new Set();

        filteredTickets.forEach(ticket => {
            const rowValue = rowField.getValue(ticket);
            const colValue = colField.getValue(ticket);
            
            rowValues.add(rowValue);
            colValues.add(colValue);

            if (!grouped[rowValue]) grouped[rowValue] = {};
            if (!grouped[rowValue][colValue]) grouped[rowValue][colValue] = [];
            grouped[rowValue][colValue].push(ticket);
        });

        // Calculate aggregates
        const data = {};
        const rowTotals = {};
        const colTotals = {};
        let grandTotal = 0;

        Array.from(rowValues).sort().forEach(rowValue => {
            data[rowValue] = {};
            rowTotals[rowValue] = 0;
            
            Array.from(colValues).sort().forEach(colValue => {
                const tickets = grouped[rowValue]?.[colValue] || [];
                let value = measure.aggregate(tickets);
                // Ensure value is a valid number
                if (isNaN(value) || !isFinite(value)) {
                    value = 0;
                }
                data[rowValue][colValue] = value;
                rowTotals[rowValue] += value;
                
                if (!colTotals[colValue]) colTotals[colValue] = 0;
                colTotals[colValue] += value;
                grandTotal += value;
            });
        });

        return {
            data,
            rowValues: Array.from(rowValues).sort(),
            colValues: Array.from(colValues).sort(),
            rowTotals,
            colTotals,
            grandTotal
        };
    }, [filteredTickets, rowDimension, columnDimension, selectedMeasure]);

    // Get unique values for filter dropdowns
    const getUniqueValues = (fieldId) => {
        const field = AVAILABLE_FIELDS.dimensions.find(f => f.id === fieldId);
        if (!field) return [];
        
        const values = new Set();
        tickets.forEach(ticket => {
            values.add(field.getValue(ticket));
        });
        return Array.from(values).sort();
    };

    // Calculate summary statistics
    const summaryStats = useMemo(() => {
        return {
            totalTickets: filteredTickets.length,
            openTickets: filteredTickets.filter(t => ['Open', 'New', 'In Progress'].includes(t.status)).length,
            caActions: filteredTickets.filter(t => t.assignedAction === 'CA').length,
            exceptions: filteredTickets.filter(t => t.client?.isException).length,
            globalClients: filteredTickets.filter(t => t.client?.isGlobal).length,
            mgxPrio1: filteredTickets.filter(t => t.mgxPriority === 'Prio 1').length,
            avgAge: filteredTickets.length > 0 ? 
                Math.round(filteredTickets.reduce((sum, t) => {
                    const age = Math.floor((Date.now() - new Date(t.created)) / (1000 * 60 * 60 * 24));
                    return sum + age;
                }, 0) / filteredTickets.length) : 0
        };
    }, [filteredTickets]);

    // Export to CSV
    const exportToCSV = () => {
        if (!pivotData) return;

        let csv = `"${rowDimension}"`;
        pivotData.colValues.forEach(col => {
            csv += `,"${col}"`;
        });
        csv += ',"Total"\n';

        pivotData.rowValues.forEach(row => {
            csv += `"${row}"`;
            pivotData.colValues.forEach(col => {
                const value = pivotData.data[row][col] || 0;
                csv += `,${value}`;
            });
            csv += `,${pivotData.rowTotals[row]}\n`;
        });

        csv += '"Total"';
        pivotData.colValues.forEach(col => {
            csv += `,${pivotData.colTotals[col]}`;
        });
        csv += `,${pivotData.grandTotal}`;

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_${rowDimension}_by_${columnDimension}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics & Insights</h2>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Analyze ticket patterns and performance metrics
                        </p>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Summary Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Total Tickets</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summaryStats.totalTickets}</p>
                        </div>
                        <div className="text-2xl">📊</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Open</p>
                            <p className="text-2xl font-bold text-green-600">{summaryStats.openTickets}</p>
                        </div>
                        <div className="text-2xl">🟢</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">CA Actions</p>
                            <p className="text-2xl font-bold text-purple-600">{summaryStats.caActions}</p>
                        </div>
                        <div className="text-2xl">⚡</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Exceptions</p>
                            <p className="text-2xl font-bold text-red-600">{summaryStats.exceptions}</p>
                        </div>
                        <div className="text-2xl">⚠️</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Global</p>
                            <p className="text-2xl font-bold text-blue-600">{summaryStats.globalClients}</p>
                        </div>
                        <div className="text-2xl">🌍</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">MGX Prio 1</p>
                            <p className="text-2xl font-bold text-indigo-600">{summaryStats.mgxPrio1}</p>
                        </div>
                        <div className="text-2xl">💠</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Avg Age</p>
                            <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{summaryStats.avgAge}d</p>
                        </div>
                        <div className="text-2xl">⏰</div>
                    </div>
                </div>
            </div>

            {/* Analysis Configuration */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden mb-6">
                {/* Quick Presets */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Analysis Templates</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {ANALYSIS_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    setRowDimension(preset.config.rowDimension);
                                    setColumnDimension(preset.config.columnDimension);
                                    setSelectedMeasure(preset.config.measure);
                                }}
                                className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
                            >
                                <div className="text-2xl mb-2">{preset.icon}</div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                    {preset.name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {preset.description}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dimension Configuration */}
                <div className="p-6 bg-gray-50 dark:bg-gray-900">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Row Dimension
                            </label>
                            <select
                                value={rowDimension}
                                onChange={(e) => setRowDimension(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {AVAILABLE_FIELDS.dimensions.map(field => (
                                    <option key={field.id} value={field.id} disabled={field.id === columnDimension}>
                                        {field.icon} {field.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Column Dimension
                            </label>
                            <select
                                value={columnDimension}
                                onChange={(e) => setColumnDimension(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {AVAILABLE_FIELDS.dimensions.map(field => (
                                    <option key={field.id} value={field.id} disabled={field.id === rowDimension}>
                                        {field.icon} {field.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Measure
                            </label>
                            <select
                                value={selectedMeasure}
                                onChange={(e) => setSelectedMeasure(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {AVAILABLE_FIELDS.measures.map(measure => (
                                    <option key={measure.id} value={measure.id}>
                                        {measure.icon} {measure.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* View Options */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={showPercentages}
                                    onChange={(e) => setShowPercentages(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Show percentages</span>
                            </label>
                            
                            <button
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                {showAdvancedFilters ? 'Hide' : 'Show'} Filters
                                {Object.keys(filters).length > 0 && (
                                    <span className="ml-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                                        {Object.keys(filters).length}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('pivot')}
                                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                    viewMode === 'pivot'
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                Pivot Table
                            </button>
                            <button
                                onClick={() => setViewMode('chart')}
                                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                    viewMode === 'chart'
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                Chart View
                            </button>
                        </div>
                    </div>
                </div>

                {/* Advanced Filters */}
                {showAdvancedFilters && (
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Advanced Filters</h4>
                            {Object.keys(filters).length > 0 && (
                                <button
                                    onClick={() => setFilters({})}
                                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {['action', 'tier', 'mgxPriority', 'status', 'client', 'isCA', 'isException', 'isGlobal'].map(fieldId => {
                                const field = AVAILABLE_FIELDS.dimensions.find(f => f.id === fieldId);
                                return (
                                    <div key={field.id}>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            {field.icon} {field.label}
                                        </label>
                                        <select
                                            multiple
                                            value={filters[field.id] || []}
                                            onChange={(e) => {
                                                const values = Array.from(e.target.selectedOptions, option => option.value);
                                                setFilters(prev => ({
                                                    ...prev,
                                                    [field.id]: values.length > 0 ? values : undefined
                                                }));
                                            }}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm p-1 bg-white dark:bg-gray-700"
                                            size="3"
                                        >
                                            {getUniqueValues(field.id).map(value => (
                                                <option key={value} value={value}>{value}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Results */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                {pivotData && viewMode === 'pivot' && (
                    <div className="overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead>
                                <tr>
                                    <th className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 z-10">
                                        {rowDimension} / {columnDimension}
                                    </th>
                                    {pivotData.colValues.map(col => (
                                        <th key={col} className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            {col}
                                        </th>
                                    ))}
                                    <th className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {pivotData.rowValues.map((row, rowIdx) => (
                                    <tr key={row} className={rowIdx % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-900/50'}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 sticky left-0">
                                            {row}
                                        </td>
                                        {pivotData.colValues.map(col => {
                                            const value = pivotData.data[row][col] || 0;
                                            const percentage = pivotData.grandTotal > 0 
                                                ? ((value / pivotData.grandTotal) * 100).toFixed(1)
                                                : 0;
                                            return (
                                                <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                                                    <div className="font-medium">{value}</div>
                                                    {showPercentages && value > 0 && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {percentage}%
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 text-center bg-gray-50 dark:bg-gray-900">
                                            <div>{pivotData.rowTotals[row]}</div>
                                            {showPercentages && pivotData.grandTotal > 0 && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {((pivotData.rowTotals[row] / pivotData.grandTotal) * 100).toFixed(1)}%
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 sticky left-0">
                                        Total
                                    </td>
                                    {pivotData.colValues.map(col => (
                                        <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                                            <div>{pivotData.colTotals[col]}</div>
                                            {showPercentages && pivotData.grandTotal > 0 && (
                                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                                    {((pivotData.colTotals[col] / pivotData.grandTotal) * 100).toFixed(1)}%
                                                </div>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                                        {pivotData.grandTotal}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {pivotData && viewMode === 'chart' && (
                    <div className="p-6">
                        <div className="space-y-6">
                            {/* Bar Chart */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Distribution by {rowDimension}</h3>
                                <div className="space-y-3">
                                    {pivotData.rowValues.map(row => {
                                        const total = pivotData.rowTotals[row];
                                        const maxValue = Math.max(...Object.values(pivotData.rowTotals));
                                        const percentage = maxValue > 0 ? (total / maxValue) * 100 : 0;
                                        
                                        return (
                                            <div key={row} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">{row}</span>
                                                    <span className="text-gray-500 dark:text-gray-400">{total}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-8">
                                                    <div
                                                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-8 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                                                        style={{ width: `${percentage}%` }}
                                                    >
                                                        {percentage > 10 && (
                                                            <span className="text-xs text-white font-medium">
                                                                {total}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Stacked Bar Chart */}
                            <div>
                                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                                    Breakdown by {columnDimension}
                                </h4>
                                <div className="flex items-end gap-2" style={{ height: '300px' }}>
                                    {pivotData.rowValues.map(row => {
                                        const maxRowTotal = Math.max(...Object.values(pivotData.rowTotals));
                                        
                                        return (
                                            <div
                                                key={row}
                                                className="flex-1 flex flex-col justify-end"
                                                title={row}
                                            >
                                                {pivotData.colValues.map((col, idx) => {
                                                    const value = pivotData.data[row][col] || 0;
                                                    const height = maxRowTotal > 0 
                                                        ? (value / maxRowTotal) * 280 
                                                        : 0;
                                                    
                                                    const colors = [
                                                        'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
                                                        'bg-purple-500', 'bg-pink-500', 'bg-indigo-500',
                                                        'bg-red-500', 'bg-orange-500', 'bg-teal-500'
                                                    ];
                                                    const color = colors[idx % colors.length];
                                                    
                                                    return value > 0 ? (
                                                        <div
                                                            key={col}
                                                            className={`${color} opacity-80 hover:opacity-100 transition-opacity`}
                                                            style={{ height: `${height}px` }}
                                                            title={`${col}: ${value}`}
                                                        />
                                                    ) : null;
                                                }).reverse()}
                                                <div className="text-xs text-center mt-2 truncate text-gray-700 dark:text-gray-300">
                                                    {row}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* Legend */}
                                <div className="flex flex-wrap gap-3 mt-6 justify-center">
                                    {pivotData.colValues.map((col, idx) => {
                                        const colors = [
                                            'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
                                            'bg-purple-500', 'bg-pink-500', 'bg-indigo-500',
                                            'bg-red-500', 'bg-orange-500', 'bg-teal-500'
                                        ];
                                        const color = colors[idx % colors.length];
                                        
                                        return (
                                            <div key={col} className="flex items-center gap-2">
                                                <div className={`w-4 h-4 ${color} opacity-80 rounded`} />
                                                <span className="text-sm text-gray-600 dark:text-gray-400">{col}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {(!pivotData || filteredTickets.length === 0) && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400">No data to display. Try adjusting your filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsViewV2;