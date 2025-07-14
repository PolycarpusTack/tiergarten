# Soma Integration Plan for Tiergarten

## Executive Summary

This document outlines a practical approach to integrate lightweight workforce/workload management capabilities from Soma into Tiergarten. The goal is to enhance Tiergarten's JIRA tier management system with capacity tracking and workload visualization without the complexity of Soma_v2's enterprise features.

## Core Concept: Capacity-Aware Ticket Management

The integration aims to answer three fundamental questions:
1. **Who has capacity?** - Track team member availability and current workload
2. **What needs attention?** - Prioritize tickets based on tier, age, and available capacity
3. **Are we overloaded?** - Visualize and alert when demand exceeds capacity

## Features to Integrate from Soma

### 1. Basic Capacity Management

#### Team Member Profiles
```javascript
// Simple team member model
{
  id: string,
  name: string,
  email: string,
  weeklyCapacity: number, // hours per week
  specializations: ['CA', 'PLAN', 'TECHNICAL'], // which actions they handle
  clientExpertise: ['client1', 'client2'], // preferred clients
  currentLoad: number // calculated from assigned tickets
}
```

#### Capacity Pools by Action
- Each action (CA, PLAN, DELEGATE, LATER, MONITOR) has a capacity pool
- Team members contribute hours to pools based on their specializations
- Visual indicators show pool utilization

### 2. Workload Visualization Components

#### Action View Enhancement
```
┌─────────────────────────────────┐
│ CA (Customer Advocate)          │
│ 15 tickets | 45/60 hrs (75%)   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 🟡        │
│                                 │
│ Team: John (20h), Sara (25h)   │
│ ⚠️ 3 tickets over 5 days old    │
└─────────────────────────────────┘
```

#### Dashboard Capacity Widget
```
Weekly Capacity Overview
├─ Total: 200 hours available
├─ Allocated: 165 hours (82.5%)
├─ By Action:
│  ├─ CA: 45/60 hrs ▓▓▓▓▓▓▓▓░░
│  ├─ PLAN: 80/80 hrs ▓▓▓▓▓▓▓▓▓▓ 🔴
│  └─ DELEGATE: 40/60 hrs ▓▓▓▓▓▓░░░░
└─ Critical: PLAN at capacity!
```

### 3. Smart Ticket Assignment

#### Assignment Algorithm
```javascript
function suggestAssignment(ticket) {
  // 1. Check client expertise match
  const expertTeamMembers = getTeamMembersForClient(ticket.client);
  
  // 2. Filter by action specialization
  const qualified = expertTeamMembers.filter(tm => 
    tm.specializations.includes(ticket.assignedAction)
  );
  
  // 3. Sort by available capacity
  const sorted = qualified.sort((a, b) => 
    (a.weeklyCapacity - a.currentLoad) - (b.weeklyCapacity - b.currentLoad)
  );
  
  // 4. Return top suggestions with capacity info
  return sorted.slice(0, 3).map(tm => ({
    name: tm.name,
    availableHours: tm.weeklyCapacity - tm.currentLoad,
    loadPercentage: (tm.currentLoad / tm.weeklyCapacity) * 100,
    isOverloaded: tm.currentLoad > tm.weeklyCapacity * 0.9
  }));
}
```

### 4. Capacity-Based Alerts

#### Alert Types
1. **Action Overload**: When an action pool exceeds 90% capacity
2. **Individual Overload**: When a team member exceeds their weekly capacity
3. **Aging Tickets**: When tickets in a pool are aging due to capacity constraints
4. **Imbalance Alert**: When one action is overloaded while others have capacity

#### Alert Display
```
⚠️ Capacity Alerts (3)
├─ PLAN action at 100% capacity - consider reassigning
├─ John Smith at 110% load this week
└─ 5 CA tickets aging due to capacity constraints
```

## Implementation Approach

### Phase 1: Data Model Extension (Week 1-2)

#### Database Changes
```sql
-- Add team_members table
CREATE TABLE team_members (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  weekly_capacity INTEGER DEFAULT 40,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add team_member_specializations
CREATE TABLE team_member_specializations (
  team_member_id INTEGER,
  action TEXT CHECK(action IN ('CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR')),
  FOREIGN KEY (team_member_id) REFERENCES team_members(id)
);

-- Add ticket_assignments
CREATE TABLE ticket_assignments (
  ticket_key TEXT PRIMARY KEY,
  team_member_id INTEGER,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estimated_hours INTEGER DEFAULT 2,
  FOREIGN KEY (team_member_id) REFERENCES team_members(id)
);

-- Add capacity_snapshots for historical tracking
CREATE TABLE capacity_snapshots (
  id INTEGER PRIMARY KEY,
  snapshot_date DATE,
  team_member_id INTEGER,
  action TEXT,
  allocated_hours INTEGER,
  used_hours INTEGER,
  FOREIGN KEY (team_member_id) REFERENCES team_members(id)
);
```

### Phase 2: API Endpoints (Week 2-3)

#### New Endpoints
```javascript
// Team member management
GET    /api/team-members
POST   /api/team-members
PUT    /api/team-members/:id
DELETE /api/team-members/:id

// Capacity tracking
GET    /api/capacity/current     // Current capacity by action
GET    /api/capacity/forecast    // Next week forecast
POST   /api/capacity/snapshot    // Save capacity snapshot

// Assignment suggestions
GET    /api/tickets/:key/suggest-assignment
POST   /api/tickets/:key/assign

// Workload analytics
GET    /api/analytics/workload   // Workload distribution
GET    /api/analytics/trends     // Historical trends
```

### Phase 3: UI Components (Week 3-4)

#### New Components
1. **TeamMemberManager**: CRUD interface for team members
2. **CapacityIndicator**: Visual capacity bar component
3. **AssignmentSuggester**: Dropdown with capacity-aware suggestions
4. **WorkloadDashboard**: New tab showing comprehensive workload view
5. **CapacityAlerts**: Alert banner for capacity issues

#### Enhanced Components
1. **ActionView**: Add capacity bars and team member list
2. **TicketCard**: Add assignment info and quick-assign button
3. **Dashboard**: Add capacity overview widget
4. **Analytics**: Add workload analysis charts

### Phase 4: Basic Forecasting (Week 4-5)

#### Simple Forecasting Logic
```javascript
function forecastNextWeek() {
  // 1. Calculate 4-week rolling average
  const historicalData = getLastFourWeeksData();
  const avgTicketsPerAction = calculateAverages(historicalData);
  
  // 2. Apply simple growth factor
  const growthFactor = calculateGrowthTrend(historicalData);
  
  // 3. Project next week
  const projection = {};
  for (const action of ACTIONS) {
    projection[action] = {
      expectedTickets: Math.round(avgTicketsPerAction[action] * growthFactor),
      requiredHours: Math.round(avgTicketsPerAction[action] * growthFactor * AVG_HOURS_PER_TICKET),
      availableHours: getAvailableHours(action),
      gap: null
    };
    projection[action].gap = projection[action].requiredHours - projection[action].availableHours;
  }
  
  return projection;
}
```

## User Experience Flow

### Scenario 1: Morning Capacity Check
```
1. User opens Tiergarten dashboard
2. Sees capacity widget showing:
   - PLAN is at 95% capacity (red)
   - CA has 30% spare capacity (green)
3. Clicks on PLAN to see:
   - 3 team members assigned
   - John is at 110% capacity
   - 5 tickets unassigned
4. System suggests reassigning some PLAN tickets to DELEGATE
```

### Scenario 2: Assigning a New Ticket
```
1. New ticket arrives, rules assign it to CA
2. User clicks "Assign to Team Member"
3. Dropdown shows:
   - Sara (CA specialist, 15h available) ✅
   - Mike (CA specialist, 5h available) 🟡
   - John (CA capable, -5h available) 🔴
4. User selects Sara, ticket is assigned
5. Capacity indicators update in real-time
```

### Scenario 3: Weekly Planning
```
1. User opens Workload tab on Monday
2. Sees forecast for the week:
   - Expected: 45 CA, 80 PLAN, 60 DELEGATE tickets
   - Capacity: Can handle 40 CA, 80 PLAN, 80 DELEGATE
   - Alert: CA will be over capacity by ~5 tickets
3. User adjusts team assignments:
   - Moves Mike from DELEGATE to CA for the week
   - System recalculates and shows green across the board
```

## Benefits of This Approach

### For Managers
- **Visibility**: See team workload at a glance
- **Proactive**: Address capacity issues before they become problems
- **Fair Distribution**: Ensure work is evenly distributed
- **Data-Driven**: Make assignment decisions based on capacity data

### For Team Members
- **Transparency**: See their current workload clearly
- **Protection**: Avoid being overloaded
- **Specialization**: Work on tickets that match their expertise
- **Planning**: Better personal time management

### For the Organization
- **Efficiency**: Tickets routed to available specialists
- **SLA Compliance**: Better chance of meeting SLAs with capacity awareness
- **Scalability**: Easy to see when to add team members
- **Metrics**: Track utilization and productivity

## Configuration Options

### System Settings
```javascript
{
  workload: {
    defaultHoursPerTicket: 2,
    weeklyHoursPerPerson: 40,
    capacityWarningThreshold: 0.8, // 80%
    capacityCriticalThreshold: 0.95, // 95%
    includeWeekends: false,
    businessHours: { start: 9, end: 17 },
    enableForecasting: true,
    forecastingWeeks: 4 // weeks of history to use
  }
}
```

### Per-Action Settings
```javascript
{
  CA: {
    avgHoursPerTicket: 3,
    maxTicketsPerPerson: 15,
    skillRequired: 'customer-service'
  },
  PLAN: {
    avgHoursPerTicket: 5,
    maxTicketsPerPerson: 8,
    skillRequired: 'technical-planning'
  }
  // ... other actions
}
```

## Migration Path

### Step 1: Soft Launch
- Add team member profiles without enforcement
- Show capacity indicators as "informational only"
- Collect feedback and refine calculations

### Step 2: Gradual Adoption
- Enable assignment suggestions
- Start tracking actual vs estimated hours
- Refine the hours-per-ticket estimates

### Step 3: Full Integration
- Enable capacity-based alerts
- Implement workload balancing rules
- Add forecasting and planning tools

## Future Enhancements (Post-MVP)

### Medium-Term (3-6 months)
- **Skill Matching**: Match ticket tags/components to team skills
- **Time Tracking**: Actual hours vs estimates
- **Leave Calendar**: Integration with PTO/vacation schedules
- **Delegation Workflows**: Automatic escalation when overloaded

### Long-Term (6-12 months)
- **ML-Based Estimation**: Learn actual hours per ticket type
- **Automated Balancing**: Auto-reassign based on capacity
- **Performance Analytics**: Team member productivity metrics
- **Client Preferences**: Some clients prefer specific team members

## Success Metrics

### Quantitative
- Reduction in tickets aging > 7 days: Target 30% reduction
- Even distribution of workload: Standard deviation < 10%
- SLA compliance rate: Target 95%+
- Capacity utilization: Target 80-85% (not 100%!)

### Qualitative
- Team satisfaction with workload distribution
- Manager confidence in capacity planning
- Reduction in emergency reassignments
- Improved work-life balance indicators

## Risks and Mitigations

### Risk 1: Adoption Resistance
**Mitigation**: Start with informational displays only, no enforcement

### Risk 2: Inaccurate Estimates
**Mitigation**: Continuously refine based on actual data, allow manual overrides

### Risk 3: Over-Optimization
**Mitigation**: Keep some capacity buffer (85% target), focus on trends not precision

### Risk 4: Privacy Concerns
**Mitigation**: Show aggregated data by default, detailed view requires permission

## Conclusion

By integrating Soma's core workload management concepts into Tiergarten, we can create a capacity-aware ticket management system that helps teams work more efficiently without adding complexity. The key is to start simple, prove value, and gradually enhance based on real usage patterns.

This approach takes the best ideas from Soma - capacity tracking and workload visualization - without the enterprise complexity of Soma_v2. The result should be a practical tool that helps manage daily workload while maintaining Tiergarten's simplicity and focus on JIRA tier management.