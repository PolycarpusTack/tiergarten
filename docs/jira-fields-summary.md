# JIRA Fields Summary for Tiergarten Configuration

This document summarizes the relevant JIRA fields discovered in our instance that could be used for Tiergarten configuration.

## Priority Fields

### Standard JIRA Priority
- **Field**: priority
- **Type**: Standard field
- **Values**: (Standard JIRA priorities - Highest, High, Medium, Low, Lowest)

### Custom Priority Fields

#### MGX Prio (customfield_10112)
- **Field ID**: customfield_10112
- **Type**: option
- **Description**: MGX-specific priority field
- **Usage**: Already integrated in Tiergarten for CA client prioritization

#### Customer Prio (customfield_10142)
- **Field ID**: customfield_10142
- **Type**: option
- **Description**: Customer-specific priority field
- **Usage**: Could be used for non-CA client prioritization

#### Prio (customfield_10507)
- **Field ID**: customfield_10507
- **Type**: option
- **Description**: Another priority field available

## Client/Customer Fields

### MGX Customers (customfield_10513)
- **Field ID**: customfield_10513
- **Type**: array
- **Description**: List of MGX customers associated with a ticket

### Customer (migrated) (customfield_10622)
- **Field ID**: customfield_10622
- **Type**: option
- **Description**: Migrated customer field

### Interested customers (customfield_10565)
- **Field ID**: customfield_10565
- **Type**: array
- **Description**: List of customers interested in this issue

## Service/Category Fields

### MGX Service (customfield_10104)
- **Field ID**: customfield_10104
- **Type**: array
- **Description**: MGX services affected

### Category (customfield_10200)
- **Field ID**: customfield_10200
- **Type**: option
- **Description**: General category field

### BUSU Category (customfield_10399)
- **Field ID**: customfield_10399
- **Type**: option
- **Description**: Business/Support category

## Time/SLA Related Fields

### Claro SLA (customfield_10645)
- **Field ID**: customfield_10645
- **Type**: sd-servicelevelagreement
- **Description**: Service Desk SLA field

### Time to resolution (customfield_10041)
- **Field ID**: customfield_10041
- **Type**: sd-servicelevelagreement
- **Description**: SLA for resolution time

### Time to first response (customfield_10042)
- **Field ID**: customfield_10042
- **Type**: sd-servicelevelagreement
- **Description**: SLA for first response

## Status/Workflow Fields

### Standard Fields
- **status**: Standard JIRA status field
- **issuetype**: Standard JIRA issue type
- **assignee**: Standard assignee field
- **reporter**: Standard reporter field

### Custom Status Fields
- **Legacy Status** (customfield_10520): String field for legacy status tracking

## Categorization Fields

### Type of work (customfield_10320)
- **Field ID**: customfield_10320
- **Type**: option
- **Description**: Categorizes the type of work

### Development Type (customfield_10616)
- **Field ID**: customfield_10616
- **Type**: option
- **Description**: Type of development work

### Work category (customfield_10067)
- **Field ID**: customfield_10067
- **Type**: string
- **Description**: General work category

## Team/Squad Fields

### Squad (customfield_10611)
- **Field ID**: customfield_10611
- **Type**: array
- **Description**: Current squad assignment

### Team (customfield_10511)
- **Field ID**: customfield_10511
- **Type**: array
- **Description**: Team assignment

## Environment Fields

### Environment (customfield_10108)
- **Field ID**: customfield_10108
- **Type**: option
- **Description**: Environment affected

### Environment (MOD) (customfield_10393)
- **Field ID**: customfield_10393
- **Type**: array
- **Description**: Modified environment field

## Recommended Fields for Tiergarten Integration

Based on the analysis, here are the recommended fields to integrate:

### 1. Priority Configuration
- **MGX Prio** (customfield_10112) - Already integrated
- **Customer Prio** (customfield_10142) - For non-CA clients
- **Standard Priority** - As fallback

### 2. Client Identification
- **MGX Customers** (customfield_10513) - Primary client field
- **Interested customers** (customfield_10565) - Secondary clients

### 3. SLA Tracking
- **Time to resolution** (customfield_10041)
- **Time to first response** (customfield_10042)
- **Claro SLA** (customfield_10645)

### 4. Categorization
- **Category** (customfield_10200)
- **Type of work** (customfield_10320)
- **MGX Service** (customfield_10104)

### 5. Team Assignment (for Workforce Management)
- **Squad** (customfield_10611)
- **Team** (customfield_10511)
- **Assignee** (standard field)

## Configuration Recommendations

### For Global Rules
```javascript
// Enhanced rule configuration with custom fields
{
  conditions: {
    mgxPriority: 'customfield_10112',      // MGX Prio
    customerPriority: 'customfield_10142',  // Customer Prio
    category: 'customfield_10200',          // Category
    typeOfWork: 'customfield_10320',        // Type of work
    mgxService: 'customfield_10104'         // MGX Service
  },
  actions: ['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR']
}
```

### For Workload Management
```javascript
// Team capacity tracking
{
  teamFields: {
    squad: 'customfield_10611',
    team: 'customfield_10511',
    assignee: 'assignee'
  },
  slaFields: {
    timeToResolution: 'customfield_10041',
    timeToFirstResponse: 'customfield_10042'
  }
}
```

### For Client Configuration
```javascript
// Client identification
{
  primaryClient: 'customfield_10513',     // MGX Customers
  interestedClients: 'customfield_10565', // Interested customers
  categories: {
    busu: 'customfield_10399',           // BUSU Category
    general: 'customfield_10200'         // Category
  }
}
```

## Next Steps

1. **Update API Integration**: Modify the JIRA API calls to fetch these custom fields
2. **Enhance Data Model**: Add support for additional priority and category fields
3. **Update Rules Engine**: Allow rules based on custom fields like category and type of work
4. **Implement SLA Tracking**: Use the SLA fields for better time-based analytics
5. **Team Integration**: Use squad/team fields for workforce management features

## Notes

- Many fields are legacy or migration-related and should be ignored
- Some fields like "Legacy LT IN/OUT" appear to be from a previous system migration
- The MS365_* fields suggest integration with Microsoft 365 services
- Multiple "External issue ID" fields exist, likely for integrations with other systems