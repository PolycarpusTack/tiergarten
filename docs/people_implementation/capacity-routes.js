const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // Get capacity pools by action
    router.get('/capacity/pools', async (req, res) => {
        try {
            const actions = ['CA', 'PLAN', 'DELEGATE', 'LATER', 'MONITOR'];
            
            // Get people with their specializations and current load
            const people = await db.all(`
                SELECT 
                    p.id,
                    p.first_name,
                    p.last_name,
                    p.weekly_capacity,
                    p.is_active,
                    COALESCE(
                        (SELECT array_agg(ps.action ORDER BY ps.action)
                         FROM people_specializations ps
                         WHERE ps.person_id = p.id),
                        ARRAY[]::VARCHAR[]
                    ) as specializations,
                    COALESCE(
                        (SELECT SUM(ta.assigned_hours)
                         FROM ticket_assignments ta
                         WHERE ta.person_id = p.id
                         AND ta.completed_at IS NULL),
                        0
                    ) as currentLoad
                FROM people p
                WHERE p.is_active = 1
            `);
            
            // Get tickets with assigned actions and estimated hours
            const tickets = await db.all(`
                SELECT 
                    t.key,
                    t.assignedAction,
                    t.estimatedHours,
                    ta.person_id,
                    ta.assigned_hours
                FROM tickets t
                LEFT JOIN ticket_assignments ta ON ta.ticket_key = t.key AND ta.completed_at IS NULL
                WHERE t.status != 'Done' AND t.assignedAction IS NOT NULL
            `);
            
            // Calculate pools
            const pools = actions.map(action => {
                // Get specialists for this action
                const specialists = people.filter(p => 
                    p.specializations && p.specializations.includes(action)
                );
                
                // Calculate total capacity for this action
                const totalCapacity = specialists.reduce((sum, p) => sum + p.weekly_capacity, 0);
                
                // Calculate available capacity (considering current load)
                const availableCapacity = specialists.reduce((sum, p) => {
                    const available = Math.max(0, p.weekly_capacity - p.currentLoad);
                    return sum + available;
                }, 0);
                
                // Get tickets assigned to this action
                const actionTickets = tickets.filter(t => t.assignedAction === action);
                
                // Calculate assigned load for this action
                const assignedLoad = actionTickets.reduce((sum, t) => 
                    sum + (t.estimatedHours || 0), 0
                );
                
                // Get unassigned tickets for this action
                const unassignedTickets = actionTickets.filter(t => !t.person_id);
                const unassignedLoad = unassignedTickets.reduce((sum, t) => 
                    sum + (t.estimatedHours || 0), 0
                );
                
                // Calculate utilization percentage
                const utilization = totalCapacity > 0 
                    ? Math.round((assignedLoad / totalCapacity) * 100) 
                    : 0;
                
                // Get top specialists by available capacity
                const topSpecialists = specialists
                    .map(p => ({
                        id: p.id,
                        name: `${p.first_name} ${p.last_name}`,
                        weeklyCapacity: p.weekly_capacity,
                        currentLoad: p.currentLoad,
                        availableCapacity: Math.max(0, p.weekly_capacity - p.currentLoad),
                        utilization: p.weekly_capacity > 0 
                            ? Math.round((p.currentLoad / p.weekly_capacity) * 100)
                            : 0
                    }))
                    .sort((a, b) => b.availableCapacity - a.availableCapacity)
                    .slice(0, 5);
                
                return {
                    action,
                    specialists: specialists.length,
                    totalCapacity,
                    availableCapacity,
                    assignedLoad,
                    unassignedLoad,
                    utilization,
                    ticketCount: actionTickets.length,
                    unassignedTicketCount: unassignedTickets.length,
                    topSpecialists,
                    status: utilization > 100 ? 'overloaded' 
                          : utilization > 80 ? 'high' 
                          : utilization > 50 ? 'moderate' 
                          : 'low'
                };
            });
            
            res.json(pools);
        } catch (error) {
            console.error('Error fetching capacity pools:', error);
            res.status(500).json({ error: 'Failed to fetch capacity pools' });
        }
    });
    
    // Get capacity utilization metrics
    router.get('/capacity/utilization', async (req, res) => {
        try {
            // Overall team metrics
            const teamMetrics = await db.get(`
                SELECT 
                    COUNT(DISTINCT p.id) as totalPeople,
                    SUM(p.weekly_capacity) as totalCapacity,
                    COUNT(DISTINCT CASE WHEN p.is_active = 1 THEN p.id END) as activePeople,
                    SUM(CASE WHEN p.is_active = 1 THEN p.weekly_capacity ELSE 0 END) as activeCapacity,
                    COALESCE(
                        (SELECT SUM(ta.assigned_hours)
                         FROM ticket_assignments ta
                         JOIN people p2 ON p2.id = ta.person_id
                         WHERE ta.completed_at IS NULL AND p2.is_active = 1),
                        0
                    ) as totalAssignedHours
                FROM people p
            `);
            
            // Ticket metrics
            const ticketMetrics = await db.get(`
                SELECT 
                    COUNT(DISTINCT t.key) as totalTickets,
                    COUNT(DISTINCT CASE WHEN t.assignedAction IS NOT NULL THEN t.key END) as assignedTickets,
                    COUNT(DISTINCT CASE WHEN ta.person_id IS NOT NULL THEN t.key END) as ticketsWithPeople,
                    SUM(t.estimatedHours) as totalEstimatedHours,
                    SUM(CASE WHEN t.assignedAction = 'CA' THEN t.estimatedHours ELSE 0 END) as caHours,
                    SUM(CASE WHEN t.assignedAction = 'PLAN' THEN t.estimatedHours ELSE 0 END) as planHours,
                    SUM(CASE WHEN t.assignedAction = 'DELEGATE' THEN t.estimatedHours ELSE 0 END) as delegateHours,
                    SUM(CASE WHEN t.assignedAction = 'LATER' THEN t.estimatedHours ELSE 0 END) as laterHours,
                    SUM(CASE WHEN t.assignedAction = 'MONITOR' THEN t.estimatedHours ELSE 0 END) as monitorHours
                FROM tickets t
                LEFT JOIN ticket_assignments ta ON ta.ticket_key = t.key AND ta.completed_at IS NULL
                WHERE t.status != 'Done'
            `);
            
            // Calculate utilization percentages
            const overallUtilization = teamMetrics.activeCapacity > 0
                ? Math.round((teamMetrics.totalAssignedHours / teamMetrics.activeCapacity) * 100)
                : 0;
            
            // Get utilization by person
            const peopleUtilization = await db.all(`
                SELECT 
                    p.id,
                    p.first_name,
                    p.last_name,
                    p.weekly_capacity,
                    COALESCE(
                        (SELECT SUM(ta.assigned_hours)
                         FROM ticket_assignments ta
                         WHERE ta.person_id = p.id
                         AND ta.completed_at IS NULL),
                        0
                    ) as currentLoad
                FROM people p
                WHERE p.is_active = 1
                ORDER BY currentLoad DESC
            `);
            
            const utilizationBuckets = {
                overloaded: 0,  // > 100%
                high: 0,        // 80-100%
                moderate: 0,    // 50-80%
                low: 0,         // 20-50%
                idle: 0         // < 20%
            };
            
            peopleUtilization.forEach(person => {
                const util = person.weekly_capacity > 0 
                    ? (person.currentLoad / person.weekly_capacity) * 100
                    : 0;
                
                if (util > 100) utilizationBuckets.overloaded++;
                else if (util >= 80) utilizationBuckets.high++;
                else if (util >= 50) utilizationBuckets.moderate++;
                else if (util >= 20) utilizationBuckets.low++;
                else utilizationBuckets.idle++;
            });
            
            // Get historical utilization (last 4 weeks)
            const historicalUtilization = await db.all(`
                SELECT 
                    DATE_TRUNC('week', ta.assigned_at) as week,
                    SUM(ta.assigned_hours) as hours_assigned,
                    COUNT(DISTINCT ta.person_id) as people_assigned,
                    COUNT(DISTINCT ta.ticket_key) as tickets_assigned
                FROM ticket_assignments ta
                WHERE ta.assigned_at >= DATE_SUB(CURRENT_DATE, INTERVAL 4 WEEK)
                GROUP BY DATE_TRUNC('week', ta.assigned_at)
                ORDER BY week DESC
            `);
            
            res.json({
                overall: {
                    totalPeople: teamMetrics.totalPeople,
                    activePeople: teamMetrics.activePeople,
                    totalCapacity: teamMetrics.totalCapacity,
                    activeCapacity: teamMetrics.activeCapacity,
                    totalAssignedHours: teamMetrics.totalAssignedHours,
                    utilization: overallUtilization,
                    availableHours: Math.max(0, teamMetrics.activeCapacity - teamMetrics.totalAssignedHours)
                },
                tickets: {
                    total: ticketMetrics.totalTickets,
                    assigned: ticketMetrics.assignedTickets,
                    withPeople: ticketMetrics.ticketsWithPeople,
                    unassigned: ticketMetrics.totalTickets - ticketMetrics.assignedTickets,
                    totalHours: ticketMetrics.totalEstimatedHours,
                    hoursByAction: {
                        CA: ticketMetrics.caHours || 0,
                        PLAN: ticketMetrics.planHours || 0,
                        DELEGATE: ticketMetrics.delegateHours || 0,
                        LATER: ticketMetrics.laterHours || 0,
                        MONITOR: ticketMetrics.monitorHours || 0
                    }
                },
                distribution: utilizationBuckets,
                topUtilized: peopleUtilization.slice(0, 5).map(p => ({
                    id: p.id,
                    name: `${p.first_name} ${p.last_name}`,
                    currentLoad: p.currentLoad,
                    capacity: p.weekly_capacity,
                    utilization: p.weekly_capacity > 0 
                        ? Math.round((p.currentLoad / p.weekly_capacity) * 100)
                        : 0
                })),
                historical: historicalUtilization.map(h => ({
                    week: h.week,
                    hoursAssigned: h.hours_assigned,
                    peopleAssigned: h.people_assigned,
                    ticketsAssigned: h.tickets_assigned
                }))
            });
        } catch (error) {
            console.error('Error fetching utilization metrics:', error);
            res.status(500).json({ error: 'Failed to fetch utilization metrics' });
        }
    });
    
    // Get capacity recommendations
    router.get('/capacity/recommendations', async (req, res) => {
        try {
            const { action } = req.query;
            
            let whereClause = '';
            const params = [];
            
            if (action) {
                whereClause = `
                    AND EXISTS (
                        SELECT 1 FROM people_specializations ps 
                        WHERE ps.person_id = p.id AND ps.action = ?
                    )
                `;
                params.push(action);
            }
            
            // Get people with available capacity
            const availablePeople = await db.all(`
                SELECT 
                    p.id,
                    p.first_name,
                    p.last_name,
                    p.weekly_capacity,
                    COALESCE(
                        (SELECT array_agg(ps.action ORDER BY ps.action)
                         FROM people_specializations ps
                         WHERE ps.person_id = p.id),
                        ARRAY[]::VARCHAR[]
                    ) as specializations,
                    COALESCE(
                        (SELECT SUM(ta.assigned_hours)
                         FROM ticket_assignments ta
                         WHERE ta.person_id = p.id
                         AND ta.completed_at IS NULL),
                        0
                    ) as currentLoad,
                    COALESCE(
                        (SELECT array_agg(DISTINCT c.name ORDER BY c.name)
                         FROM people_client_expertise pce
                         JOIN clients c ON c.id = pce.client_id
                         WHERE pce.person_id = p.id AND pce.expertise_level IN ('Intermediate', 'Expert')),
                        ARRAY[]::VARCHAR[]
                    ) as expertClients
                FROM people p
                WHERE p.is_active = 1 ${whereClause}
                HAVING p.weekly_capacity - currentLoad > 0
                ORDER BY p.weekly_capacity - currentLoad DESC
            `, params);
            
            const recommendations = availablePeople.map(person => {
                const availableCapacity = person.weekly_capacity - person.currentLoad;
                const utilizationPercent = person.weekly_capacity > 0 
                    ? Math.round((person.currentLoad / person.weekly_capacity) * 100)
                    : 0;
                
                return {
                    id: person.id,
                    name: `${person.first_name} ${person.last_name}`,
                    availableHours: availableCapacity,
                    currentUtilization: utilizationPercent,
                    specializations: person.specializations || [],
                    expertClients: person.expertClients || [],
                    recommendationScore: calculateRecommendationScore(person, action)
                };
            }).sort((a, b) => b.recommendationScore - a.recommendationScore);
            
            res.json(recommendations);
        } catch (error) {
            console.error('Error fetching capacity recommendations:', error);
            res.status(500).json({ error: 'Failed to fetch capacity recommendations' });
        }
    });
    
    // Helper function to calculate recommendation score
    function calculateRecommendationScore(person, requestedAction) {
        let score = 0;
        
        // Base score from available capacity (0-40 points)
        const availableCapacity = person.weekly_capacity - person.currentLoad;
        score += Math.min(40, availableCapacity * 2);
        
        // Bonus for specialization match (20 points)
        if (requestedAction && person.specializations && person.specializations.includes(requestedAction)) {
            score += 20;
        }
        
        // Penalty for high utilization (0 to -20 points)
        const utilization = person.weekly_capacity > 0 
            ? (person.currentLoad / person.weekly_capacity) * 100 
            : 100;
        if (utilization > 80) {
            score -= Math.min(20, (utilization - 80));
        }
        
        // Bonus for expertise diversity (0-10 points)
        if (person.expertClients && person.expertClients.length > 0) {
            score += Math.min(10, person.expertClients.length * 2);
        }
        
        return Math.max(0, score);
    }
    
    return router;
};