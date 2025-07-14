import React, { useState, useMemo } from 'react';
import PersonCardV2 from './PersonCardV2';
import PersonEditModalV2 from './PersonEditModalV2';

const PeopleViewV2 = ({ people, api, onRefresh, customFields }) => {
    const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
    const [showModal, setShowModal] = useState(false);
    const [editingPerson, setEditingPerson] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [filterBy, setFilterBy] = useState('all');
    const [selectedPeople, setSelectedPeople] = useState(new Set());
    const [showBulkActions, setShowBulkActions] = useState(false);

    // Show/hide bulk actions based on selection
    React.useEffect(() => {
        setShowBulkActions(selectedPeople.size > 0);
    }, [selectedPeople]);

    // Filter and sort logic
    const processedPeople = useMemo(() => {
        let filtered = people.filter(person => {
            const searchLower = searchQuery.toLowerCase();
            const fullName = `${person.first_name} ${person.last_name}`.toLowerCase();
            return (
                fullName.includes(searchLower) ||
                person.email?.toLowerCase().includes(searchLower) ||
                person.specializations?.some(s => s.toLowerCase().includes(searchLower))
            );
        });

        // Apply filters
        if (filterBy !== 'all') {
            filtered = filtered.filter(person => {
                switch (filterBy) {
                    case 'available':
                        return person.currentLoad < person.weeklyCapacity * 0.8;
                    case 'overloaded':
                        return person.currentLoad > person.weeklyCapacity;
                    case 'ca-specialists':
                        return person.specializations?.includes('CA');
                    case 'active':
                        return person.is_active === 1;
                    case 'inactive':
                        return person.is_active === 0;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
                case 'capacity':
                    return b.weeklyCapacity - a.weeklyCapacity;
                case 'load':
                    return b.currentLoad - a.currentLoad;
                case 'utilization':
                    const aUtil = a.weeklyCapacity > 0 ? (a.currentLoad / a.weeklyCapacity) : 0;
                    const bUtil = b.weeklyCapacity > 0 ? (b.currentLoad / b.weeklyCapacity) : 0;
                    return bUtil - aUtil;
                default:
                    return 0;
            }
        });

        return filtered;
    }, [people, searchQuery, sortBy, filterBy]);

    const handleAddPerson = () => {
        setEditingPerson(null);
        setShowModal(true);
    };

    const handleEditPerson = (person) => {
        setEditingPerson(person);
        setShowModal(true);
    };

    const handleDeletePerson = async (personId) => {
        const person = people.find(p => p.id === personId);
        if (window.confirm(`Are you sure you want to delete ${person.first_name} ${person.last_name}?`)) {
            try {
                await api.deletePerson(personId);
                onRefresh();
            } catch (error) {
                console.error('Error deleting person:', error);
                alert('Failed to delete person. Please try again.');
            }
        }
    };

    const handleBulkDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${selectedPeople.size} selected people?`)) {
            try {
                await Promise.all(Array.from(selectedPeople).map(id => api.deletePerson(id)));
                setSelectedPeople(new Set());
                onRefresh();
            } catch (error) {
                console.error('Error bulk deleting people:', error);
                alert('Failed to delete some people. Please try again.');
            }
        }
    };

    const handleSelectAll = () => {
        if (selectedPeople.size === processedPeople.length) {
            setSelectedPeople(new Set());
        } else {
            setSelectedPeople(new Set(processedPeople.map(p => p.id)));
        }
    };

    const togglePersonSelection = (personId) => {
        const newSelected = new Set(selectedPeople);
        if (newSelected.has(personId)) {
            newSelected.delete(personId);
        } else {
            newSelected.add(personId);
        }
        setSelectedPeople(newSelected);
    };

    const getUtilizationColor = (utilization) => {
        if (utilization > 100) return 'text-red-600 bg-red-100';
        if (utilization > 80) return 'text-yellow-600 bg-yellow-100';
        return 'text-green-600 bg-green-100';
    };

    const PersonListView = ({ people }) => (
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-6 py-3 text-left">
                            <input
                                type="checkbox"
                                checked={selectedPeople.size === processedPeople.length && processedPeople.length > 0}
                                onChange={handleSelectAll}
                                className="rounded border-gray-300"
                            />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Specializations
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Capacity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Utilization
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-gray-700">
                    {people.map((person) => {
                        const utilization = person.weeklyCapacity > 0 
                            ? Math.round((person.currentLoad / person.weeklyCapacity) * 100) 
                            : 0;
                        
                        return (
                            <tr key={person.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        checked={selectedPeople.has(person.id)}
                                        onChange={() => togglePersonSelection(person.id)}
                                        className="rounded border-gray-300"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {person.first_name} {person.last_name}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {person.email}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-wrap gap-1">
                                        {person.specializations?.map(spec => (
                                            <span
                                                key={spec}
                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                            >
                                                {spec}
                                            </span>
                                        )) || <span className="text-gray-400">None</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {person.currentLoad}/{person.weeklyCapacity}h
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUtilizationColor(utilization)}`}>
                                        {utilization}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        person.is_active 
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                    }`}>
                                        {person.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleEditPerson(person)}
                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeletePerson(person.id)}
                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Team Members
                    </h1>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {processedPeople.length} of {people.length} people
                    </span>
                </div>
                
                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search by name, email, or specialization..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                     bg-white dark:bg-dark-surface text-gray-900 dark:text-white
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    
                    {/* View Mode Toggle */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                viewMode === 'cards' 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            <svg className="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            Cards
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                viewMode === 'list' 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            <svg className="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            List
                        </button>
                    </div>
                    
                    {/* Add Person Button */}
                    <button
                        onClick={handleAddPerson}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Person
                    </button>
                </div>
                
                {/* Filters and Sort */}
                <div className="flex gap-4 mt-4">
                    <select
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                 bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
                    >
                        <option value="all">All People</option>
                        <option value="active">Active Only</option>
                        <option value="available">Available (< 80% load)</option>
                        <option value="overloaded">Overloaded (> 100%)</option>
                        <option value="ca-specialists">CA Specialists</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                 bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
                    >
                        <option value="name">Sort by Name</option>
                        <option value="capacity">Sort by Capacity</option>
                        <option value="load">Sort by Current Load</option>
                        <option value="utilization">Sort by Utilization</option>
                    </select>
                </div>

                {/* Bulk Actions */}
                {showBulkActions && (
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {selectedPeople.size} selected
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedPeople(new Set())}
                                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                                Clear Selection
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                            >
                                Delete Selected
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            {processedPeople.length === 0 ? (
                <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No people found</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {searchQuery ? 'Try adjusting your search or filters.' : 'Get started by adding a new team member.'}
                    </p>
                    {!searchQuery && (
                        <div className="mt-6">
                            <button
                                onClick={handleAddPerson}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Add First Person
                            </button>
                        </div>
                    )}
                </div>
            ) : viewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {processedPeople.map(person => (
                        <PersonCardV2
                            key={person.id}
                            person={person}
                            isSelected={selectedPeople.has(person.id)}
                            onToggleSelect={() => togglePersonSelection(person.id)}
                            onEdit={() => handleEditPerson(person)}
                            onDelete={() => handleDeletePerson(person.id)}
                            customFields={customFields}
                        />
                    ))}
                </div>
            ) : (
                <PersonListView people={processedPeople} />
            )}

            {/* Edit Modal */}
            {showModal && (
                <PersonEditModalV2
                    person={editingPerson}
                    api={api}
                    customFields={customFields}
                    onClose={() => {
                        setShowModal(false);
                        setEditingPerson(null);
                    }}
                    onSave={() => {
                        setShowModal(false);
                        setEditingPerson(null);
                        onRefresh();
                    }}
                />
            )}
        </div>
    );
};

export default PeopleViewV2;