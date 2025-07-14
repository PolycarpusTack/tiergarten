// Filter utility functions for enhanced filtering

export const FILTER_OPERATORS = {
  // Basic operators
  is: { label: 'is', validate: (value, filterValue) => value === filterValue },
  is_not: { label: 'is not', validate: (value, filterValue) => value !== filterValue },
  
  // Multiple value operators
  in: { label: 'is one of', validate: (value, filterValue) => {
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];
    return values.includes(value);
  }},
  not_in: { label: 'is not one of', validate: (value, filterValue) => {
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];
    return !values.includes(value);
  }},
  
  // Text operators
  contains: { label: 'contains', validate: (value, filterValue) => 
    value && value.toString().toLowerCase().includes(filterValue.toLowerCase())
  },
  not_contains: { label: 'does not contain', validate: (value, filterValue) => 
    !value || !value.toString().toLowerCase().includes(filterValue.toLowerCase())
  },
  
  // Null/empty operators
  is_empty: { label: 'is empty', validate: (value) => !value || value.length === 0 },
  is_not_empty: { label: 'is not empty', validate: (value) => value && value.length > 0 },
  
  // Date operators
  before: { label: 'is before', validate: (value, filterValue) => {
    if (!value) return false;
    const date = new Date(value);
    const filterDate = parseRelativeDate(filterValue) || new Date(filterValue);
    return date < filterDate;
  }},
  after: { label: 'is after', validate: (value, filterValue) => {
    if (!value) return false;
    const date = new Date(value);
    const filterDate = parseRelativeDate(filterValue) || new Date(filterValue);
    return date > filterDate;
  }},
  between: { label: 'is between', validate: (value, filterValue) => {
    if (!value || !Array.isArray(filterValue) || filterValue.length !== 2) return false;
    const date = new Date(value);
    const startDate = parseRelativeDate(filterValue[0]) || new Date(filterValue[0]);
    const endDate = parseRelativeDate(filterValue[1]) || new Date(filterValue[1]);
    return date >= startDate && date <= endDate;
  }},
  
  // Numeric operators
  greater_than: { label: 'is greater than', validate: (value, filterValue) => 
    Number(value) > Number(filterValue)
  },
  greater_than_or_equal: { label: '>=', validate: (value, filterValue) => 
    Number(value) >= Number(filterValue)
  },
  less_than: { label: 'is less than', validate: (value, filterValue) => 
    Number(value) < Number(filterValue)
  },
  less_than_or_equal: { label: '<=', validate: (value, filterValue) => 
    Number(value) <= Number(filterValue)
  },
  equals: { label: 'equals', validate: (value, filterValue) => 
    Number(value) === Number(filterValue)
  }
};

// Parse relative dates like "-3d", "@today", etc.
function parseRelativeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (dateStr === '@today') return today;
  
  if (dateStr === '@yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  
  if (dateStr === '@tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  // Parse relative dates like "-3d", "+1w", "-1m"
  const match = dateStr.match(/^([+-])(\d+)([dwmy])$/);
  if (match) {
    const [, sign, amount, unit] = match;
    const num = parseInt(amount) * (sign === '-' ? -1 : 1);
    const result = new Date(today);
    
    switch (unit) {
      case 'd': result.setDate(result.getDate() + num); break;
      case 'w': result.setDate(result.getDate() + (num * 7)); break;
      case 'm': result.setMonth(result.getMonth() + num); break;
      case 'y': result.setFullYear(result.getFullYear() + num); break;
      default: return null;
    }
    
    return result;
  }
  
  return null;
}

// Get value from nested object path like "client.tier"
export function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Apply a single filter to a ticket
export function applyFilter(ticket, filter) {
  const ticketValue = getNestedValue(ticket, filter.field);
  const operator = FILTER_OPERATORS[filter.operator];
  
  if (!operator) {
    console.warn(`Unknown operator: ${filter.operator}`);
    return true;
  }
  
  // Special handling for @me
  let filterValue = filter.value;
  if (filterValue === '@me') {
    // In a real app, this would come from user context
    filterValue = 'current-user@example.com';
  }
  
  return operator.validate(ticketValue, filterValue);
}

// Apply all filters to tickets with AND/OR logic
export function applyFilters(tickets, filters) {
  if (!filters || filters.length === 0) return tickets;
  
  return tickets.filter(ticket => {
    // Process each filter/group
    return filters.every(filterItem => {
      // If it's a group of filters
      if (filterItem.group) {
        const logic = filterItem.logic || 'AND';
        if (logic === 'AND') {
          return filterItem.group.every(f => applyFilter(ticket, f));
        } else {
          return filterItem.group.some(f => applyFilter(ticket, f));
        }
      }
      // Single filter
      return applyFilter(ticket, filterItem);
    });
  });
}

// Get available filter fields based on ticket structure
export const FILTER_FIELDS = [
  // Basic fields
  { value: 'priority', label: 'Priority', type: 'select', 
    options: ['Highest', 'High', 'Medium', 'Low', 'Lowest'] },
  { value: 'customerPriority', label: 'Customer Priority', type: 'select',
    options: ['Prio 1', 'Prio 2', 'Prio 3', 'Prio 4', 'Trivial'] },
  { value: 'status', label: 'Status', type: 'select',
    options: ['Open', 'In Progress', 'Resolved', 'Closed'] },
  { value: 'assignedAction', label: 'Assigned Action', type: 'select',
    options: ['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR'] },
  { value: 'action_status', label: 'Action Status', type: 'select',
    options: ['Active', 'Backlog', 'Needs Assignment', 'Completed'] },
  
  // Client fields
  { value: 'client.tier', label: 'Client Tier', type: 'select',
    options: [1, 2, 3] },
  { value: 'client.isCA', label: 'Is CA Client', type: 'boolean' },
  { value: 'client.isException', label: 'Is Exception', type: 'boolean' },
  { value: 'client.name', label: 'Client Name', type: 'text' },
  
  // Assignment fields
  { value: 'assignee', label: 'Assignee', type: 'text' },
  
  // Date fields
  { value: 'created', label: 'Created Date', type: 'date' },
  { value: 'updated', label: 'Updated Date', type: 'date' },
  { value: 'duedate', label: 'Due Date', type: 'date' },
  
  // Other fields
  { value: 'summary', label: 'Summary', type: 'text' },
  { value: 'labels', label: 'Labels', type: 'array' },
  { value: 'components', label: 'Components', type: 'array' },
  { value: 'resolution', label: 'Resolution', type: 'text' },
  { value: 'age', label: 'Age (days)', type: 'number' }
];

// Get operators available for a field type
export function getOperatorsForFieldType(type) {
  switch (type) {
    case 'text':
      return ['is', 'is_not', 'contains', 'not_contains', 'is_empty', 'is_not_empty'];
    case 'select':
      return ['is', 'is_not', 'in', 'not_in'];
    case 'boolean':
      return ['is'];
    case 'date':
      return ['before', 'after', 'between', 'is_empty', 'is_not_empty'];
    case 'array':
      return ['contains', 'not_contains', 'is_empty', 'is_not_empty'];
    case 'number':
      return ['equals', 'is_not', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'];
    default:
      return ['is', 'is_not'];
  }
}