import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CapacityPoolsViewV2 = ({ api }) => {
    const [pools, setPools] = useState([]);
    const [utilization, setUtilization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('pools'); // 'pools' or 'utilization'

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [poolsData, utilizationData] = await Promise.all([
                api.getCapacityPools(),
                api.getCapacityUtilization()
            ]);
            setPools(poolsData);
            setUtilization(utilizationData);
        } catch (error) {
            console.error('Error loading capacity data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            overloaded: '#ef4444', // red-500
            high: '#f59e0b',       // amber-500
            moderate: '#3b82f6',   // blue-500
            low: '#10b981'         // emerald-500
        };
        return colors[status] || '#6b7280';
    };

    const getUtilizationColor = (percent) => {
        if (percent > 100) return '#ef4444';
        if (percent > 80) return '#f59e0b';
        if (percent > 50) return '#3b82f6';
        return '#10b981';
    };

    const CapacityPoolCard = ({ pool }) => (
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {pool.action}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {pool.specialists} specialist{pool.specialists !== 1 ? 's' : ''}
                    </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium text-white`}
                      style={{ backgroundColor: getStatusColor(pool.status) }}>
                    {pool.status}
                </span>
            </div>

            {/* Capacity Bar */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Capacity</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                        {pool.utilization}%
                    </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 relative overflow-hidden">
                    <div 
                        className="h-3 rounded-full transition-all duration-500"
                        style={{ 
                            width: `${Math.min(pool.utilization, 100)}%`,
                            backgroundColor: getUtilizationColor(pool.utilization)
                        }}
                    />
                    {pool.utilization > 100 && (
                        <div 
                            className="absolute top-0 right-0 h-3 bg-red-600 animate-pulse"
                            style={{ 
                                width: `${pool.utilization - 100}%`,
                                opacity: 0.7
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Capacity</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {pool.totalCapacity}h/week
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {pool.availableCapacity}h
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Assigned</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {pool.assignedLoad}h
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Unassigned</p>
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {pool.unassignedLoad}h
                    </p>
                </div>
            </div>

            {/* Tickets */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        Tickets: {pool.ticketCount}
                    </span>
                    {pool.unassignedTicketCount > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full">
                            {pool.unassignedTicketCount} unassigned
                        </span>
                    )}
                </div>

                {/* Top Specialists */}
                {pool.topSpecialists && pool.topSpecialists.length > 0 && (
                    <div className="mt-3">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Available Specialists
                        </p>
                        <div className="space-y-1">
                            {pool.topSpecialists.slice(0, 3).map(specialist => (
                                <div key={specialist.id} className="flex justify-between items-center text-xs">
                                    <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                                        {specialist.name}
                                    </span>
                                    <span className="text-green-600 dark:text-green-400 ml-2">
                                        {specialist.availableCapacity}h
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const UtilizationDashboard = () => {
        if (!utilization) return null;

        const distributionData = Object.entries(utilization.distribution).map(([key, value]) => ({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value,
            color: key === 'overloaded' ? '#ef4444' 
                 : key === 'high' ? '#f59e0b'
                 : key === 'moderate' ? '#3b82f6'
                 : key === 'low' ? '#10b981'
                 : '#6b7280'
        }));

        const actionData = Object.entries(utilization.tickets.hoursByAction).map(([action, hours]) => ({
            action,
            hours: hours || 0
        }));

        return (
            <div className="space-y-6">
                {/* Overall Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Team Utilization
                        </h4>
                        <p className="text-3xl font-bold" style={{ color: getUtilizationColor(utilization.overall.utilization) }}>
                            {utilization.overall.utilization}%
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {utilization.overall.totalAssignedHours}h / {utilization.overall.activeCapacity}h
                        </p>
                    </div>

                    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Available Hours
                        </h4>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {utilization.overall.availableHours}h
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Across {utilization.overall.activePeople} people
                        </p>
                    </div>

                    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Total Tickets
                        </h4>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {utilization.tickets.total}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {utilization.tickets.withPeople} assigned to people
                        </p>
                    </div>

                    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Unassigned Work
                        </h4>
                        <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                            {utilization.tickets.unassigned}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Tickets need assignment
                        </p>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* People Distribution */}
                    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Team Distribution by Utilization
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={distributionData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name}: ${value}`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {distributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Hours by Action */}
                    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Workload by Action Type
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={actionData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="action" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="hours" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Utilized People */}
                <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Highest Utilized Team Members
                    </h3>
                    <div className="space-y-3">
                        {utilization.topUtilized.map(person => (
                            <div key={person.id} className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {person.name}
                                    </p>
                                    <div className="flex items-center mt-1">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                                            <div 
                                                className="h-2 rounded-full"
                                                style={{ 
                                                    width: `${Math.min(person.utilization, 100)}%`,
                                                    backgroundColor: getUtilizationColor(person.utilization)
                                                }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: getUtilizationColor(person.utilization) }}>
                                            {person.utilization}%
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right ml-4">
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {person.currentLoad}h / {person.capacity}h
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 dark:text-gray-400">Loading capacity data...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Capacity Management
                    </h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('pools')}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                viewMode === 'pools' 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            Capacity Pools
                        </button>
                        <button
                            onClick={() => setViewMode('utilization')}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                viewMode === 'utilization' 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            Utilization Dashboard
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'pools' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {pools.map(pool => (
                        <CapacityPoolCard key={pool.action} pool={pool} />
                    ))}
                </div>
            ) : (
                <UtilizationDashboard />
            )}
        </div>
    );
};

export default CapacityPoolsViewV2;