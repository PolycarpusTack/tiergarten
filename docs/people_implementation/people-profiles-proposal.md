# People Profiles Implementation Proposal for Tiergarten

## Executive Summary
This proposal outlines the implementation of a People Profiles feature for the Tiergarten JIRA Tier Management System. The feature will provide team member management with capacity tracking, specializations, and client expertise, following the existing architectural patterns and UI conventions.

## Architecture Overview

### Database Schema (DuckDB)

```sql
-- People table
CREATE SEQUENCE IF NOT EXISTS seq_people_id START 1;

CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY DEFAULT nextval('seq_people_id'),
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE,
    weekly_capacity DECIMAL DEFAULT 40.0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- People specializations (many-to-many relationship)
CREATE TABLE IF NOT EXISTS people_specializations (
    person_id INTEGER NOT NULL,
    action VARCHAR NOT NULL CHECK (action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
    proficiency_level INTEGER DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
    PRIMARY KEY (person_id, action),
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

-- People client expertise (calculated/tracked)
CREATE TABLE IF NOT EXISTS people_client_expertise (
    person_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    hours_worked DECIMAL DEFAULT 0,
    last_assignment TIMESTAMP,
    expertise_level VARCHAR CHECK (expertise_level IN ('Novice', 'Intermediate', 'Expert')),
    PRIMARY KEY (person_id, client_id),
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- People custom fields configuration
CREATE TABLE IF NOT EXISTS people_field_config (
    id INTEGER PRIMARY KEY,
    field_name VARCHAR NOT NULL UNIQUE,
    field_type VARCHAR NOT NULL CHECK (field_type IN ('string', 'number', 'date', 'formula')),
    field_config VARCHAR DEFAULT '{}', -- JSON configuration
    display_order INTEGER DEFAULT 0,
    is_required INTEGER DEFAULT 0 CHECK (is_required IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- People custom field values
CREATE TABLE IF NOT EXISTS people_field_values (
    person_id INTEGER NOT NULL,
    field_id INTEGER NOT NULL,
    value VARCHAR,
    PRIMARY KEY (person_id, field_id),
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
    FOREIGN KEY (field_id) REFERENCES people_field_config(id) ON DELETE CASCADE
);

-- Ticket assignments (for tracking current load)
CREATE TABLE IF NOT EXISTS ticket_assignments (
    id INTEGER PRIMARY KEY DEFAULT nextval('seq_ticket_assignments_id'),
    ticket_key VARCHAR NOT NULL,
    person_id INTEGER NOT NULL,
    assigned_hours DECIMAL DEFAULT 0,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people(id),
    UNIQUE(ticket_key, person_id)
);
```

## File Structure

### Frontend Components (src/components/V2/)
- `PeopleViewV2.js` - Main people list/card view
- `PersonCardV2.js` - Individual person card component
- `PersonEditModalV2.js` - Add/Edit person modal
- `PeopleConfigurationV2.js` - Configuration component for custom fields
- `CapacityPoolsViewV2.js` - Visual capacity pools by action

### Backend Routes (server/routes/)
- `people-routes.js` - CRUD operations for people
- `capacity-routes.js` - Capacity calculations and pool data

### API Endpoints

```javascript
// People endpoints
GET    /api/people              // List all people with filters
POST   /api/people              // Create new person
PUT    /api/people/:id          // Update person
DELETE /api/people/:id          // Delete person
GET    /api/people/:id/load     // Get current load for a person

// Configuration endpoints
GET    /api/people/fields       // Get custom field configuration
POST   /api/people/fields       // Create custom field
PUT    /api/people/fields/:id   // Update custom field
DELETE /api/people/fields/:id   // Delete custom field

// Capacity endpoints
GET    /api/capacity/pools      // Get capacity pools by action
GET    /api/capacity/utilization // Get utilization metrics
```

## Implementation Details

### 1. Database Updates (server/duckdb-database.js)

Add the schema creation to the `initSchema()` method:

```javascript
// Add after existing table creation
await this.exec(`
    -- People tables schema (as defined above)
`);
```

### 2. People View Component (PeopleViewV2.js)

```javascript
import React, { useState, useMemo } from 'react';
import PersonCardV2 from './PersonCardV2';
import PersonEditModalV2 from './PersonEditModalV2';

const PeopleViewV2 = ({ people, api, onRefresh }) => {
    const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
    const [showModal, setShowModal] = useState(false);
    const [editingPerson, setEditingPerson] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [filterBy, setFilterBy] = useState('all');

    // Filter and sort logic
    const processedPeople = useMemo(() => {
        let filtered = people.filter(person => {
            const searchLower = searchQuery.toLowerCase();
            return (
                person.first_name.toLowerCase().includes(searchLower) ||
                person.last_name.toLowerCase().includes(searchLower) ||
                person.email?.toLowerCase().includes(searchLower)
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
                    return (b.currentLoad / b.weeklyCapacity) - (a.currentLoad / a.weeklyCapacity);
                default:
                    return 0;
            }
        });

        return filtered;
    }, [people, searchQuery, sortBy, filterBy]);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Team Members
                </h1>
                
                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                    
                    {/* View Mode Toggle */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-4 py-2 rounded-lg ${viewMode === 'cards' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            Cards
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            List
                        </button>
                    </div>
                    
                    {/* Add Person Button */}
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        Add Person
                    </button>
                </div>
                
                {/* Filters and Sort */}
                <div className="flex gap-4 mt-4">
                    <select
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value)}
                        className="px-4 py-2 border rounded-lg"
                    >
                        <option value="all">All People</option>
                        <option value="available">Available</option>
                        <option value="overloaded">Overloaded</option>
                        <option value="ca-specialists">CA Specialists</option>
                    </select>
                    
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-4 py-2 border rounded-lg"
                    >
                        <option value="name">Sort by Name</option>
                        <option value="capacity">Sort by Capacity</option>
                        <option value="load">Sort by Current Load</option>
                        <option value="utilization">Sort by Utilization</option>
                    </select>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {processedPeople.map(person => (
                        <PersonCardV2
                            key={person.id}
                            person={person}
                            onEdit={() => {
                                setEditingPerson(person);
                                setShowModal(true);
                            }}
                            onDelete={async () => {
                                if (window.confirm(`Delete ${person.first_name} ${person.last_name}?`)) {
                                    await api.deletePerson(person.id);
                                    onRefresh();
                                }
                            }}
                        />
                    ))}
                </div>
            ) : (
                <PersonListView people={processedPeople} onEdit={handleEdit} onDelete={handleDelete} />
            )}

            {/* Edit Modal */}
            {showModal && (
                <PersonEditModalV2
                    person={editingPerson}
                    api={api}
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
```

### 3. Integration with Sidebar

Update `SidebarV2.js` to add People menu item:

```javascript
const navigationItems = [
    // ... existing items
    { 
        id: 'people', 
        label: 'People', 
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
    },
    // ... rest of items
];
```

### 4. Configuration Integration

Add a 'People' tab to the Configuration menu that allows:
- Setting expertise calculation period (Days/Months/Years)
- Managing custom fields
- Setting default capacity values
- Configuring specialization options

### 5. Capacity Pools Visualization

Create a new component to show capacity pools:

```javascript
const CapacityPoolsViewV2 = ({ people, tickets }) => {
    const pools = useMemo(() => {
        const actions = ['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR'];
        
        return actions.map(action => {
            const specialists = people.filter(p => p.specializations?.includes(action));
            const totalCapacity = specialists.reduce((sum, p) => sum + p.weeklyCapacity, 0);
            const assignedLoad = tickets
                .filter(t => t.assignedAction === action)
                .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
            
            return {
                action,
                specialists: specialists.length,
                totalCapacity,
                assignedLoad,
                utilization: totalCapacity > 0 ? (assignedLoad / totalCapacity) * 100 : 0
            };
        });
    }, [people, tickets]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {pools.map(pool => (
                <CapacityPoolCard key={pool.action} pool={pool} />
            ))}
        </div>
    );
};
```

## Implementation Recommendations

### Phase 1: Core Features (Week 1-2)
1. Database schema implementation
2. Basic CRUD operations for people
3. Simple card and list views
4. Integration with existing navigation

### Phase 2: Advanced Features (Week 3-4)
1. Custom fields configuration
2. Capacity calculations and current load tracking
3. Client expertise tracking
4. Capacity pools visualization

### Phase 3: Integration & Polish (Week 5)
1. Integration with ticket assignment workflow
2. Performance optimizations
3. Testing and bug fixes
4. Documentation

## Code Quality Improvements

### 1. Create Shared Components
- Extract common modal patterns into a base modal component
- Create reusable form input components
- Standardize card layouts across views

### 2. API Service Refactoring
- Create a dedicated API service class instead of inline object
- Add proper error handling and retry logic
- Implement request caching where appropriate

### 3. State Management
- Consider implementing React Context for global state
- Reduce prop drilling in deeply nested components
- Implement proper loading and error states

### 4. Performance Optimizations
- Implement virtual scrolling for large lists
- Add debouncing to search inputs
- Optimize re-renders with React.memo

## Testing Strategy
1. Unit tests for utility functions
2. Integration tests for API endpoints
3. Component tests for critical UI flows
4. End-to-end tests for main user journeys

## Migration Considerations
- No existing data migration required
- Feature can be deployed incrementally
- Backward compatible with existing functionality

## Security Considerations
- Implement proper access control for people data
- Sanitize custom field formulas to prevent injection
- Add audit logging for sensitive operations

## Conclusion
This implementation follows the existing patterns in the Tiergarten codebase while introducing the People Profiles feature in a clean, maintainable way. The phased approach allows for incremental delivery and testing.