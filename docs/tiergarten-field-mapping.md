# Tiergarten Field Mapping Document

This document provides a comprehensive inventory of all fields currently used in Tiergarten, their sources, and how they map to JIRA fields. Use this document to identify which fields need to be mapped to your JIRA instance's custom fields.

## Field Categories

### 1. Core Ticket Fields (JIRA Standard Fields)

| Tiergarten Field | Data Type | JIRA Field | JIRA Field Type | Usage in Tiergarten |
|------------------|-----------|------------|-----------------|---------------------|
| `key` | String | `key` | Standard | Display, filters, unique identifier, ticket actions |
| `summary` | String | `summary` | Standard | Display, filters, search |
| `priority` | String | `priority` | Standard | Display, filters, rules, card color coding |
| `status` | String | `status` | Standard | Display, filters, analytics |
| `created` | DateTime | `created` | Standard | Display, filters, age calculation |
| `updated` | DateTime | `updated` | Standard | Display, filters |
| `assignee` | String | `assignee.displayName` | Standard | Display, filters |
| `assigneeEmail` | String | `assignee.emailAddress` | Standard | Backend only |
| `reporter` | String | `reporter.displayName` | Standard | Display, filters |
| `labels` | Array[String] | `labels` | Standard | Display, filters |
| `components` | Array[String] | `components[].name` | Standard | Display, filters |
| `duedate` | DateTime | `duedate` | Standard | Display, filters |
| `resolution` | String | `resolution.name` | Standard | Display, filters |

### 2. Custom Priority Fields (JIRA Custom Fields)

| Tiergarten Field | Data Type | Current JIRA Mapping | Your JIRA Field | Usage in Tiergarten |
|------------------|-----------|---------------------|-----------------|---------------------|
| `mgxPriority` | String | `customfield_10112` | _______________ | Display, filters, CA client rules |
| `customerPriority` | String | `customfield_10142` | _______________ | Display, filters, non-CA client rules |

### 3. Client-Related Fields (Tiergarten-Generated)

These fields are **unique to Tiergarten** and are generated based on the client configuration stored in the local database:

| Tiergarten Field | Data Type | Source | Usage |
|------------------|-----------|---------|-------|
| `client` | Object | Tiergarten DB | Container object |
| `client.id` | Integer | Tiergarten DB | Internal reference |
| `client.name` | String | Tiergarten DB | Display, filters, analytics |
| `client.tier` | Integer (1-3) | Tiergarten DB | Display, filters, rules, analytics |
| `client.isCA` | Boolean | Tiergarten DB | Display, filters, rules, special handling |
| `client.isException` | Boolean | Tiergarten DB | Display, filters, exception alerts |
| `client.isGlobal` | Boolean | Tiergarten DB | Display, filters, analytics |
| `client.jiraProjectKey` | String | Tiergarten DB | Maps to JIRA project |

**Note**: Client mapping is done via JIRA project key. Each ticket's project is matched to a client in Tiergarten's database.

### 4. Action Management Fields (Tiergarten-Generated)

These fields are **unique to Tiergarten** and represent the core tier management functionality:

| Tiergarten Field | Data Type | Source | Usage |
|------------------|-----------|---------|-------|
| `assignedAction` | Enum | Tiergarten rules engine | Primary grouping, display, filters |
| | | Values: `CA`, `PLAN`, `DELEGATE`, `LATER`, `MONITOR` | |
| `isManualOverride` | Boolean | Tiergarten DB | Shows override icon when action was manually set |
| `action_status` | String | Virtual field | Filter-only field for combined action/status filtering |

### 5. Calculated Fields (Tiergarten-Generated)

These fields are **calculated at runtime** and not stored:

| Tiergarten Field | Data Type | Calculation | Usage |
|------------------|-----------|-------------|-------|
| `age` | Integer (days) | `now() - created` | Display, filters, time sensitivity indicators |
| `timeInStatus` | Integer (days) | Based on status changes | Planned feature |

### 6. Potential JIRA Custom Field Mappings

Based on the JIRA field analysis, here are potential mappings for enhanced functionality:

| Feature | Tiergarten Concept | Suggested JIRA Field | JIRA Field ID |
|---------|-------------------|---------------------|---------------|
| Team Assignment | (not implemented) | `Squad` | `customfield_10611` |
| Team Assignment | (not implemented) | `Team` | `customfield_10511` |
| Service Category | (not implemented) | `MGX Service` | `customfield_10104` |
| Work Type | (not implemented) | `Type of work` | `customfield_10320` |
| General Category | (not implemented) | `Category` | `customfield_10200` |
| SLA Tracking | (not implemented) | `Time to resolution` | `customfield_10041` |
| SLA Tracking | (not implemented) | `Time to first response` | `customfield_10042` |
| Multi-Client | (not implemented) | `MGX Customers` | `customfield_10513` |
| Multi-Client | (not implemented) | `Interested customers` | `customfield_10565` |

## Field Usage Matrix

### Display Fields
Fields that can be shown on ticket cards:
- ✅ `key` (mandatory)
- ✅ `summary` (mandatory)
- ✅ `client` (mandatory)
- ✅ `tier` (mandatory)
- ✅ `action` (mandatory)
- ✅ `priority`
- ✅ `status`
- ✅ `age`
- ✅ `assignee`
- ✅ `created`
- ✅ `updated`
- ✅ `duedate`
- ✅ `mgxPriority`
- ✅ `customerPriority`

### Filter Fields
Fields available in widget filters:
- All display fields above
- `client.name`
- `client.tier`
- `client.isCA`
- `client.isException`
- `client.isGlobal`
- `assignedAction`
- `labels`
- `components`
- `resolution`

### Rule Condition Fields
Fields that can trigger global rules:
- `client.isCA` (boolean)
- `client.tier` (1, 2, or 3)
- `mgxPriority` (for CA clients)
- `customerPriority` (for non-CA clients)

### Analytics Dimensions
Fields available as analytics dimensions:
- All fields listed above
- Additional calculated dimensions like `ageGroup`, `month`, `week`

## Database Schema Reference

### Tables and Their Purpose

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `clients` | Store client configurations | name, jiraProjectKey, tier, isCA, isException, isGlobal |
| `global_rules` | Action assignment rules | isCA, tier, mgxPriority, customerPriority, action |
| `ticket_actions` | Manual action overrides | ticket_key, action |
| `dashboards` | User dashboards | name, user_id, is_default |
| `user_widgets` | Dashboard widgets | title, type, filters, position |
| `import_config` | JIRA import settings | excluded_projects, date_offset_days |

## Mapping Instructions

1. **Review Current Mappings**: Check if the current custom field mappings match your JIRA instance
2. **Identify Missing Fields**: Look for fields in your JIRA that could enhance Tiergarten
3. **Map Custom Fields**: Fill in the "Your JIRA Field" column in section 2
4. **Consider New Features**: Review section 6 for potential new field integrations
5. **Document Changes**: Update this document with your final mappings

## Notes

- **Tiergarten-Unique Concepts**: Client tiers, assigned actions, and manual overrides are unique to Tiergarten
- **Project-Based Client Mapping**: Tiergarten maps JIRA projects to clients, not individual tickets
- **Extensibility**: The system can easily incorporate additional JIRA custom fields
- **Real-time Sync**: Field values are fetched from JIRA in real-time (except Tiergarten-generated fields)