const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // Get all people with optional filters
    router.get('/people', async (req, res) => {
        try {
            const { active, specialization, search } = req.query;
            
            let query = `
                SELECT 
                    p.*,
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
                WHERE 1=1
            `;
            
            const params = [];
            
            if (active !== undefined) {
                query += ` AND p.is_active = ?`;
                params.push(active === 'true' ? 1 : 0);
            }
            
            if (specialization) {
                query += ` AND EXISTS (
                    SELECT 1 FROM people_specializations ps 
                    WHERE ps.person_id = p.id AND ps.action = ?
                )`;
                params.push(specialization);
            }
            
            if (search) {
                query += ` AND (
                    LOWER(p.first_name) LIKE LOWER(?) OR 
                    LOWER(p.last_name) LIKE LOWER(?) OR 
                    LOWER(p.email) LIKE LOWER(?)
                )`;
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }
            
            query += ` ORDER BY p.first_name, p.last_name`;
            
            const people = await db.all(query, params);
            
            // Fetch custom field values for all people
            const peopleIds = people.map(p => p.id);
            if (peopleIds.length > 0) {
                const customFieldValues = await db.all(`
                    SELECT person_id, field_id, value
                    FROM people_field_values
                    WHERE person_id IN (${peopleIds.map(() => '?').join(',')})
                `, peopleIds);
                
                // Group custom field values by person
                const valuesByPerson = {};
                customFieldValues.forEach(cfv => {
                    if (!valuesByPerson[cfv.person_id]) {
                        valuesByPerson[cfv.person_id] = {};
                    }
                    valuesByPerson[cfv.person_id][cfv.field_id] = cfv.value;
                });
                
                // Add custom field values to people
                people.forEach(person => {
                    person.customFieldValues = valuesByPerson[person.id] || {};
                });
                
                // Fetch client expertise
                const clientExpertise = await db.all(`
                    SELECT 
                        pce.*,
                        c.name as clientName
                    FROM people_client_expertise pce
                    JOIN clients c ON c.id = pce.client_id
                    WHERE pce.person_id IN (${peopleIds.map(() => '?').join(',')})
                    ORDER BY pce.hours_worked DESC
                `, peopleIds);
                
                // Group expertise by person
                const expertiseByPerson = {};
                clientExpertise.forEach(exp => {
                    if (!expertiseByPerson[exp.person_id]) {
                        expertiseByPerson[exp.person_id] = [];
                    }
                    expertiseByPerson[exp.person_id].push({
                        clientId: exp.client_id,
                        clientName: exp.clientName,
                        hoursWorked: exp.hours_worked,
                        level: exp.expertise_level,
                        lastAssignment: exp.last_assignment
                    });
                });
                
                // Add expertise to people
                people.forEach(person => {
                    person.clientExpertise = expertiseByPerson[person.id] || [];
                });
            }
            
            res.json(people);
        } catch (error) {
            console.error('Error fetching people:', error);
            res.status(500).json({ error: 'Failed to fetch people' });
        }
    });
    
    // Get single person by ID
    router.get('/people/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const person = await db.get(`
                SELECT 
                    p.*,
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
                WHERE p.id = ?
            `, [id]);
            
            if (!person) {
                return res.status(404).json({ error: 'Person not found' });
            }
            
            // Fetch custom field values
            const customFieldValues = await db.all(`
                SELECT field_id, value
                FROM people_field_values
                WHERE person_id = ?
            `, [id]);
            
            person.customFieldValues = {};
            customFieldValues.forEach(cfv => {
                person.customFieldValues[cfv.field_id] = cfv.value;
            });
            
            // Fetch client expertise
            const clientExpertise = await db.all(`
                SELECT 
                    pce.*,
                    c.name as clientName
                FROM people_client_expertise pce
                JOIN clients c ON c.id = pce.client_id
                WHERE pce.person_id = ?
                ORDER BY pce.hours_worked DESC
            `, [id]);
            
            person.clientExpertise = clientExpertise.map(exp => ({
                clientId: exp.client_id,
                clientName: exp.clientName,
                hoursWorked: exp.hours_worked,
                level: exp.expertise_level,
                lastAssignment: exp.last_assignment
            }));
            
            res.json(person);
        } catch (error) {
            console.error('Error fetching person:', error);
            res.status(500).json({ error: 'Failed to fetch person' });
        }
    });
    
    // Create new person
    router.post('/people', async (req, res) => {
        try {
            const {
                first_name,
                last_name,
                email,
                weeklyCapacity = 40,
                is_active = 1,
                specializations = [],
                customFieldValues = {}
            } = req.body;
            
            // Validate required fields
            if (!first_name || !last_name) {
                return res.status(400).json({ error: 'First name and last name are required' });
            }
            
            // Check for duplicate email
            if (email) {
                const existing = await db.get(
                    'SELECT id FROM people WHERE email = ?',
                    [email]
                );
                if (existing) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
            }
            
            // Insert person
            const result = await db.run(`
                INSERT INTO people (first_name, last_name, email, weekly_capacity, is_active)
                VALUES (?, ?, ?, ?, ?)
            `, [first_name, last_name, email, weeklyCapacity, is_active]);
            
            const personId = result.id;
            
            // Insert specializations
            if (specializations.length > 0) {
                const specializationValues = specializations.map(action => 
                    `(${personId}, '${action}', 3)`
                ).join(',');
                
                await db.exec(`
                    INSERT INTO people_specializations (person_id, action, proficiency_level)
                    VALUES ${specializationValues}
                `);
            }
            
            // Insert custom field values
            const customFieldIds = Object.keys(customFieldValues);
            if (customFieldIds.length > 0) {
                const valueInserts = customFieldIds.map(fieldId => 
                    `(${personId}, ${fieldId}, '${customFieldValues[fieldId]}')`
                ).join(',');
                
                await db.exec(`
                    INSERT INTO people_field_values (person_id, field_id, value)
                    VALUES ${valueInserts}
                `);
            }
            
            // Return the created person
            const newPerson = await db.get(
                'SELECT * FROM people WHERE id = ?',
                [personId]
            );
            
            newPerson.specializations = specializations;
            newPerson.customFieldValues = customFieldValues;
            newPerson.currentLoad = 0;
            
            res.status(201).json(newPerson);
        } catch (error) {
            console.error('Error creating person:', error);
            res.status(500).json({ error: 'Failed to create person' });
        }
    });
    
    // Update person
    router.put('/people/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const {
                first_name,
                last_name,
                email,
                weeklyCapacity,
                is_active,
                specializations = [],
                customFieldValues = {}
            } = req.body;
            
            // Check if person exists
            const existing = await db.get('SELECT id FROM people WHERE id = ?', [id]);
            if (!existing) {
                return res.status(404).json({ error: 'Person not found' });
            }
            
            // Check for duplicate email
            if (email) {
                const duplicate = await db.get(
                    'SELECT id FROM people WHERE email = ? AND id != ?',
                    [email, id]
                );
                if (duplicate) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
            }
            
            // Update person
            await db.run(`
                UPDATE people 
                SET first_name = ?, last_name = ?, email = ?, 
                    weekly_capacity = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [first_name, last_name, email, weeklyCapacity, is_active, id]);
            
            // Update specializations
            await db.run('DELETE FROM people_specializations WHERE person_id = ?', [id]);
            
            if (specializations.length > 0) {
                const specializationValues = specializations.map(action => 
                    `(${id}, '${action}', 3)`
                ).join(',');
                
                await db.exec(`
                    INSERT INTO people_specializations (person_id, action, proficiency_level)
                    VALUES ${specializationValues}
                `);
            }
            
            // Update custom field values
            await db.run('DELETE FROM people_field_values WHERE person_id = ?', [id]);
            
            const customFieldIds = Object.keys(customFieldValues);
            if (customFieldIds.length > 0) {
                const valueInserts = customFieldIds.map(fieldId => 
                    `(${id}, ${fieldId}, '${customFieldValues[fieldId]}')`
                ).join(',');
                
                await db.exec(`
                    INSERT INTO people_field_values (person_id, field_id, value)
                    VALUES ${valueInserts}
                `);
            }
            
            // Return updated person
            const updatedPerson = await db.get(
                'SELECT * FROM people WHERE id = ?',
                [id]
            );
            
            updatedPerson.specializations = specializations;
            updatedPerson.customFieldValues = customFieldValues;
            
            res.json(updatedPerson);
        } catch (error) {
            console.error('Error updating person:', error);
            res.status(500).json({ error: 'Failed to update person' });
        }
    });
    
    // Delete person
    router.delete('/people/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Check if person exists
            const existing = await db.get('SELECT id FROM people WHERE id = ?', [id]);
            if (!existing) {
                return res.status(404).json({ error: 'Person not found' });
            }
            
            // Check if person has active assignments
            const activeAssignments = await db.get(`
                SELECT COUNT(*) as count 
                FROM ticket_assignments 
                WHERE person_id = ? AND completed_at IS NULL
            `, [id]);
            
            if (activeAssignments.count > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete person with active ticket assignments' 
                });
            }
            
            // Delete person (cascade will handle related records)
            await db.run('DELETE FROM people WHERE id = ?', [id]);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting person:', error);
            res.status(500).json({ error: 'Failed to delete person' });
        }
    });
    
    // Get person's current load
    router.get('/people/:id/load', async (req, res) => {
        try {
            const { id } = req.params;
            
            const assignments = await db.all(`
                SELECT 
                    ta.*,
                    t.key as ticket_key,
                    t.summary as ticket_summary,
                    t.priority,
                    c.name as client_name
                FROM ticket_assignments ta
                JOIN tickets t ON t.key = ta.ticket_key
                LEFT JOIN clients c ON c.jiraProjectKey = t.project
                WHERE ta.person_id = ? AND ta.completed_at IS NULL
                ORDER BY ta.assigned_at DESC
            `, [id]);
            
            const totalLoad = assignments.reduce((sum, a) => sum + a.assigned_hours, 0);
            
            res.json({
                totalLoad,
                assignments: assignments.map(a => ({
                    ticketKey: a.ticket_key,
                    ticketSummary: a.ticket_summary,
                    priority: a.priority,
                    clientName: a.client_name,
                    assignedHours: a.assigned_hours,
                    assignedAt: a.assigned_at
                }))
            });
        } catch (error) {
            console.error('Error fetching person load:', error);
            res.status(500).json({ error: 'Failed to fetch person load' });
        }
    });
    
    // Custom fields configuration endpoints
    router.get('/people/fields', async (req, res) => {
        try {
            const fields = await db.all(`
                SELECT * FROM people_field_config 
                ORDER BY display_order, field_name
            `);
            res.json(fields);
        } catch (error) {
            console.error('Error fetching custom fields:', error);
            res.status(500).json({ error: 'Failed to fetch custom fields' });
        }
    });
    
    router.post('/people/fields', async (req, res) => {
        try {
            const { field_name, field_type, field_config = '{}', is_required = 0 } = req.body;
            
            if (!field_name || !field_type) {
                return res.status(400).json({ error: 'Field name and type are required' });
            }
            
            // Check for duplicate field name
            const existing = await db.get(
                'SELECT id FROM people_field_config WHERE field_name = ?',
                [field_name]
            );
            if (existing) {
                return res.status(400).json({ error: 'Field name already exists' });
            }
            
            // Get max display order
            const maxOrder = await db.get(
                'SELECT MAX(display_order) as max_order FROM people_field_config'
            );
            const display_order = (maxOrder.max_order || 0) + 1;
            
            const result = await db.run(`
                INSERT INTO people_field_config 
                (field_name, field_type, field_config, display_order, is_required)
                VALUES (?, ?, ?, ?, ?)
            `, [field_name, field_type, field_config, display_order, is_required]);
            
            const newField = await db.get(
                'SELECT * FROM people_field_config WHERE id = ?',
                [result.id]
            );
            
            res.status(201).json(newField);
        } catch (error) {
            console.error('Error creating custom field:', error);
            res.status(500).json({ error: 'Failed to create custom field' });
        }
    });
    
    router.put('/people/fields/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { field_name, field_type, field_config, display_order, is_required } = req.body;
            
            await db.run(`
                UPDATE people_field_config 
                SET field_name = ?, field_type = ?, field_config = ?, 
                    display_order = ?, is_required = ?
                WHERE id = ?
            `, [field_name, field_type, field_config, display_order, is_required, id]);
            
            const updatedField = await db.get(
                'SELECT * FROM people_field_config WHERE id = ?',
                [id]
            );
            
            res.json(updatedField);
        } catch (error) {
            console.error('Error updating custom field:', error);
            res.status(500).json({ error: 'Failed to update custom field' });
        }
    });
    
    router.delete('/people/fields/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Delete field values first
            await db.run('DELETE FROM people_field_values WHERE field_id = ?', [id]);
            
            // Delete field config
            await db.run('DELETE FROM people_field_config WHERE id = ?', [id]);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting custom field:', error);
            res.status(500).json({ error: 'Failed to delete custom field' });
        }
    });
    
    return router;
};