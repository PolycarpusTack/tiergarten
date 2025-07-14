const Database = require('./duckdb-database');
const db = new Database();

async function addBacklogGroomingDashboard() {
    try {
        await db.init();
        
        // Check if Backlog Grooming dashboard exists
        const existing = await db.get(
            "SELECT * FROM dashboards WHERE name = 'Backlog Grooming' AND user_id = 'default'"
        );
        
        if (existing) {
            console.log('Backlog Grooming dashboard already exists!');
            return;
        }
        
        // Get max display order
        const maxOrder = await db.get('SELECT MAX(display_order) as max_order FROM dashboards');
        const display_order = (maxOrder?.max_order || 0) + 1;
        
        // Insert Backlog Grooming dashboard
        await db.run(
            'INSERT INTO dashboards (name, user_id, is_default, display_order) VALUES (?, ?, ?, ?)',
            'Backlog Grooming', 'default', 0, display_order
        );
        
        console.log('Backlog Grooming dashboard created successfully!');
        
        // Get the dashboard ID
        const dashboard = await db.get(
            "SELECT id FROM dashboards WHERE name = 'Backlog Grooming' AND user_id = 'default'"
        );
        
        if (dashboard) {
            // Insert default widgets for Backlog Grooming
            const backlogWidgets = [
                {
                    title: 'Aging LATER Items (30+ days)',
                    type: 'ticket-list',
                    filters: JSON.stringify({
                        assignedAction: ['LATER'],
                        ageGreaterThan: 30,
                        sortBy: 'age',
                        sortOrder: 'desc'
                    }),
                    position: 1,
                    cardConfig: JSON.stringify({
                        displayFields: ['key', 'summary', 'client', 'age', 'priority', 'status'],
                        timeSensitivity: {
                            enabled: true,
                            rules: [{
                                thresholds: { warning: 30, critical: 45, overdue: 60 },
                                indicators: { warning: '⚠️', critical: '🔥', overdue: '💀' }
                            }]
                        }
                    })
                },
                {
                    title: 'Stale DELEGATE Items (14+ days)',
                    type: 'ticket-list',
                    filters: JSON.stringify({
                        assignedAction: ['DELEGATE'],
                        ageGreaterThan: 14,
                        sortBy: 'age',
                        sortOrder: 'desc'
                    }),
                    position: 2,
                    cardConfig: JSON.stringify({
                        displayFields: ['key', 'summary', 'client', 'age', 'priority', 'assignee'],
                        timeSensitivity: {
                            enabled: true,
                            rules: [{
                                thresholds: { warning: 14, critical: 21, overdue: 30 },
                                indicators: { warning: '⏰', critical: '🚨', overdue: '☠️' }
                            }]
                        }
                    })
                },
                {
                    title: 'Low Priority CA Actions',
                    type: 'ticket-list',
                    filters: JSON.stringify({
                        assignedAction: ['CA'],
                        priority: ['Low', 'Lowest'],
                        sortBy: 'created',
                        sortOrder: 'asc'
                    }),
                    position: 3,
                    cardConfig: JSON.stringify({
                        displayFields: ['key', 'summary', 'client', 'priority', 'created', 'age'],
                        timeSensitivity: {
                            enabled: true,
                            rules: [{
                                condition: { priority: 'Low' },
                                thresholds: { warning: 7, critical: 14, overdue: 21 },
                                indicators: { warning: '📌', critical: '📍', overdue: '❗' }
                            }]
                        }
                    })
                }
            ];
            
            for (const widget of backlogWidgets) {
                await db.run(
                    'INSERT INTO user_widgets (user_id, dashboard_id, title, type, filters, position, cardConfig) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    'default',
                    dashboard.id,
                    widget.title,
                    widget.type,
                    widget.filters,
                    widget.position,
                    widget.cardConfig
                );
            }
            
            console.log('Default widgets added to Backlog Grooming dashboard!');
        }
        
    } catch (error) {
        console.error('Error adding Backlog Grooming dashboard:', error);
    } finally {
        process.exit();
    }
}

addBacklogGroomingDashboard();