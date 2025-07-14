# People Profiles Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing the People Profiles feature in the Tiergarten JIRA Tier Management System.

## Implementation Steps

### 1. Database Migration
First, run the database migration to add the necessary tables:

```bash
cd server/migrations
node add-people-tables.js
```

This will create all required tables:
- `people` - Core people data
- `people_specializations` - Action specializations
- `people_client_expertise` - Client expertise tracking
- `people_field_config` - Custom field configuration
- `people_field_values` - Custom field values
- `ticket_assignments` - Ticket-to-person assignments
- `people_config` - System configuration

### 2. Backend Implementation

#### 2.1 Add Route Files
Copy these files to `server/routes/`:
- `people-routes.js` - People CRUD and management endpoints
- `capacity-routes.js` - Capacity pool and utilization endpoints

#### 2.2 Update server.js
Add the route imports and uses:

```javascript
const peopleRoutes = require('./routes/people-routes');
const capacityRoutes = require('./routes/capacity-routes');

// After other route uses
app.use('/api', peopleRoutes(db));
app.use('/api', capacityRoutes(db));
```

Also add the configuration endpoints as shown in the integration guide.

#### 2.3 Update duckdb-database.js
Add the People tables schema to the `initSchema()` method (see integration guide for full schema).

### 3. Frontend Implementation

#### 3.1 Add Component Files
Copy these files to `src/components/V2/`:
- `PeopleViewV2.js` - Main people list/card view
- `PersonCardV2.js` - Individual person card
- `PersonEditModalV2.js` - Add/Edit person modal
- `PeopleConfigurationV2.js` - Configuration interface
- `CapacityPoolsViewV2.js` - Capacity visualization

#### 3.2 Update App.js
Add the People API methods to the api object (see API Updates artifact).

#### 3.3 Update AppV2.js
1. Import the new components
2. Add state variables for people and custom fields
3. Update loadData to fetch people data
4. Add render cases for people and capacity views
5. Add the configuration modal

#### 3.4 Update SidebarV2.js
1. Add navigation items for People and Capacity
2. Add quick action for People Configuration
3. Update the icons and handlers

### 4. Testing Checklist

#### Basic Functionality
- [ ] Can create new people with all required fields
- [ ] Can edit existing people
- [ ] Can delete people (only if no active assignments)
- [ ] Search and filter functionality works
- [ ] Card and list views display correctly

#### Specializations
- [ ] Can assign multiple specializations to people
- [ ] Specializations display correctly on cards
- [ ] Can filter by specialization

#### Custom Fields
- [ ] Can create custom fields of all types
- [ ] Custom fields appear in add/edit forms
- [ ] Required fields are validated
- [ ] Field values save and display correctly

#### Capacity Management
- [ ] Capacity pools show correct calculations
- [ ] Utilization percentages are accurate
- [ ] Available capacity updates in real-time
- [ ] Overloaded indicators work correctly

#### Configuration
- [ ] Expertise configuration saves correctly
- [ ] Custom field ordering works
- [ ] All configuration changes persist

### 5. Migration from Existing System

If you have existing team data to migrate:

1. Export existing data to CSV/JSON
2. Create a migration script using the People API
3. Map existing fields to the new schema
4. Run migration in batches to avoid timeouts

### 6. Performance Considerations

#### Indexes
The migration creates these indexes for performance:
- `idx_people_email` - Fast email lookups
- `idx_people_active` - Filter active people
- `idx_ticket_assignments_person` - Person load queries
- `idx_ticket_assignments_ticket` - Ticket assignment queries

#### Query Optimization
- People list uses single query with JOINs
- Capacity calculations are done in database
- Custom fields are loaded in batch

### 7. Security Considerations

#### Access Control
Consider implementing:
- Role-based access for viewing/editing people
- Audit logging for changes
- Data privacy controls for personal information

#### Data Validation
All inputs are validated:
- Email format validation
- Capacity limits (0-168 hours)
- Required field enforcement
- SQL injection prevention

### 8. Future Enhancements

Consider these additions:
- Team/department groupings
- Skills matrix visualization
- Vacation/absence tracking
- Historical utilization reports
- Automated assignment recommendations
- Integration with HR systems

## Troubleshooting

### Common Issues

#### Migration Fails
- Check database permissions
- Ensure all foreign key references exist
- Run with verbose logging

#### People Not Loading
- Check API endpoint configuration
- Verify database connection
- Check browser console for errors

#### Capacity Calculations Wrong
- Verify ticket estimatedHours values
- Check assignment completed_at status
- Review calculation logic in capacity-routes.js

### Debug Mode
Enable debug logging:
```javascript
// In server.js
const DEBUG = true;

// In components
console.log('People data:', people);
```

## Support
For issues or questions:
1. Check server logs for backend errors
2. Use browser DevTools for frontend debugging
3. Verify all migrations completed successfully
4. Test API endpoints individually

## Conclusion
The People Profiles feature provides comprehensive team management capabilities. Follow this guide carefully, test thoroughly, and customize as needed for your specific requirements.