/**
 * Tests for TicketStorageService
 * 
 * Quality Gates:
 * - 90% code coverage
 * - All edge cases handled
 * - Performance benchmarks verified
 */

const TicketStorageService = require('../ticket-storage-service');

// Mock the database
const mockDb = {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
    exec: jest.fn()
};

// Mock logger
jest.mock('../../utils/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('TicketStorageService', () => {
    let service;
    
    beforeEach(() => {
        service = new TicketStorageService(mockDb);
        jest.clearAllMocks();
    });

    describe('upsertTicket', () => {
        const mockTicket = {
            key: 'TEST-123',
            fields: {
                summary: 'Test ticket',
                description: 'Test description',
                status: { name: 'Open' },
                priority: { name: 'High' },
                issuetype: { name: 'Bug' },
                assignee: { displayName: 'John Doe', emailAddress: 'john@example.com' },
                reporter: { displayName: 'Jane Doe' },
                created: '2024-01-01T00:00:00Z',
                updated: '2024-01-02T00:00:00Z',
                components: [{ name: 'Backend' }],
                labels: ['urgent', 'customer'],
                customfield_10112: 'P1',
                customfield_10142: 'Critical'
            }
        };

        it('should insert a new ticket successfully', async () => {
            const expectedResult = { id: 1, ticket_key: 'TEST-123' };
            mockDb.get.mockResolvedValue(expectedResult);

            const result = await service.upsertTicket(mockTicket, 1);

            expect(result).toEqual(expectedResult);
            expect(mockDb.get).toHaveBeenCalledTimes(1);
            
            // Verify SQL and parameters
            const [sql, ...params] = mockDb.get.mock.calls[0];
            expect(sql).toContain('INSERT INTO jira_tickets');
            expect(sql).toContain('ON CONFLICT (ticket_key) DO UPDATE');
            expect(params[0]).toBe('TEST-123'); // ticket_key
            expect(params[1]).toBe(1); // client_id
            expect(params[2]).toBe('Test ticket'); // summary
        });

        it('should handle tickets without optional fields', async () => {
            const minimalTicket = {
                key: 'TEST-124',
                fields: {
                    summary: 'Minimal ticket',
                    created: '2024-01-01T00:00:00Z',
                    updated: '2024-01-02T00:00:00Z'
                }
            };

            mockDb.get.mockResolvedValue({ id: 2 });

            await service.upsertTicket(minimalTicket, 1);

            const [, ...params] = mockDb.get.mock.calls[0];
            expect(params[3]).toBeUndefined(); // description
            expect(params[4]).toBeUndefined(); // status
            expect(params[5]).toBeUndefined(); // priority
        });

        it('should extract custom fields correctly', async () => {
            mockDb.get.mockResolvedValue({ id: 1 });

            await service.upsertTicket(mockTicket, 1);

            const customFieldsParam = mockDb.get.mock.calls[0][12];
            const customFields = JSON.parse(customFieldsParam);
            
            expect(customFields.mgxPriority).toBe('P1');
            expect(customFields.customerPriority).toBe('Critical');
            expect(customFields.customfield_10112).toBe('P1');
        });

        it('should handle database errors', async () => {
            mockDb.get.mockRejectedValue(new Error('Database error'));

            await expect(service.upsertTicket(mockTicket, 1))
                .rejects.toThrow('Database error');
        });
    });

    describe('batchUpsertTickets', () => {
        const createMockTickets = (count) => {
            return Array.from({ length: count }, (_, i) => ({
                ticket: {
                    key: `TEST-${i}`,
                    fields: {
                        summary: `Test ticket ${i}`,
                        created: '2024-01-01T00:00:00Z',
                        updated: '2024-01-02T00:00:00Z'
                    }
                },
                clientId: 1
            }));
        };

        it('should process tickets in batches', async () => {
            const tickets = createMockTickets(2500);
            mockDb.exec.mockResolvedValue({});
            mockDb.run.mockResolvedValue({});

            const result = await service.batchUpsertTickets(tickets);

            expect(result.total).toBe(2500);
            expect(result.processed).toBe(2500);
            expect(result.failed).toBe(0);
            
            // Should process in 3 batches (1000, 1000, 500)
            expect(mockDb.exec).toHaveBeenCalledTimes(6); // 3 creates + 3 drops
        });

        it('should handle batch errors gracefully', async () => {
            const tickets = createMockTickets(2000);
            
            // First batch succeeds, second fails
            mockDb.exec.mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('Batch error'))
                .mockResolvedValue({});
            mockDb.run.mockResolvedValue({});

            const result = await service.batchUpsertTickets(tickets);

            expect(result.processed).toBe(1000);
            expect(result.failed).toBe(1000);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].batchStart).toBe(1000);
        });

        it('should report performance metrics', async () => {
            const tickets = createMockTickets(100);
            mockDb.exec.mockResolvedValue({});
            mockDb.run.mockResolvedValue({});

            const result = await service.batchUpsertTickets(tickets);

            expect(result.duration).toBeGreaterThan(0);
            expect(result.ticketsPerSecond).toBeGreaterThan(0);
        });
    });

    describe('getTickets', () => {
        const mockTicketRows = [
            {
                id: 1,
                ticket_key: 'TEST-1',
                custom_fields: '{"mgxPriority": "P1"}',
                components: '["Backend"]',
                labels: '["urgent"]'
            },
            {
                id: 2,
                ticket_key: 'TEST-2',
                custom_fields: '{}',
                components: '[]',
                labels: '[]'
            }
        ];

        it('should fetch tickets with filters', async () => {
            mockDb.all.mockResolvedValue(mockTicketRows);

            const filters = {
                clientId: 1,
                status: 'Open',
                limit: 10
            };

            const result = await service.getTickets(filters);

            expect(result).toHaveLength(2);
            expect(result[0].custom_fields.mgxPriority).toBe('P1');
            expect(result[0].components).toEqual(['Backend']);
            
            const [sql, ...params] = mockDb.all.mock.calls[0];
            expect(sql).toContain('client_id = ?');
            expect(sql).toContain('status = ?');
            expect(sql).toContain('LIMIT ?');
            expect(params).toEqual([1, 'Open', 10]);
        });

        it('should handle tickets with keys filter', async () => {
            mockDb.all.mockResolvedValue([]);

            await service.getTickets({ keys: ['TEST-1', 'TEST-2', 'TEST-3'] });

            const [sql] = mockDb.all.mock.calls[0];
            expect(sql).toContain('ticket_key IN (?,?,?)');
        });

        it('should handle empty results', async () => {
            mockDb.all.mockResolvedValue([]);

            const result = await service.getTickets();

            expect(result).toEqual([]);
        });
    });

    describe('getStatistics', () => {
        it('should return comprehensive statistics', async () => {
            const mockStats = {
                total_tickets: 1000,
                total_clients: 50,
                unique_statuses: 5,
                oldest_ticket: '2023-01-01',
                latest_update: '2024-01-15',
                avg_age_days: 45.5
            };

            const mockStatusDist = [
                { status: 'Open', count: 500 },
                { status: 'In Progress', count: 300 },
                { status: 'Closed', count: 200 }
            ];

            const mockClientDist = [
                { name: 'Client A', tier: 1, ticket_count: 100 },
                { name: 'Client B', tier: 2, ticket_count: 80 }
            ];

            mockDb.get.mockResolvedValue(mockStats);
            mockDb.all.mockResolvedValueOnce(mockStatusDist)
                      .mockResolvedValueOnce(mockClientDist);

            const result = await service.getStatistics();

            expect(result.total_tickets).toBe(1000);
            expect(result.status_distribution).toEqual(mockStatusDist);
            expect(result.top_clients).toEqual(mockClientDist);
        });
    });

    describe('Performance Benchmarks', () => {
        it('should process 1000 tickets in under 100ms', async () => {
            const tickets = Array.from({ length: 1000 }, (_, i) => ({
                ticket: {
                    key: `PERF-${i}`,
                    fields: { summary: `Perf test ${i}` }
                },
                clientId: 1
            }));

            mockDb.exec.mockResolvedValue({});
            mockDb.run.mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve({}), 1))
            );

            const start = Date.now();
            await service.batchUpsertTickets(tickets);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100);
        });
    });
});

// Integration test with real DuckDB (if needed)
describe('TicketStorageService Integration', () => {
    // Skip in CI environment
    if (process.env.CI) {
        it.skip('Integration tests skipped in CI', () => {});
        return;
    }

    let service;
    let db;

    beforeAll(async () => {
        // Setup test database
        const DuckDBDatabase = require('../../duckdb-database');
        db = new DuckDBDatabase();
        await db.init();
        service = new TicketStorageService(db);
    });

    afterAll(async () => {
        await db.close();
    });

    it('should perform real database operations', async () => {
        const ticket = {
            key: 'INT-TEST-1',
            fields: {
                summary: 'Integration test ticket',
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            }
        };

        // Ensure client exists
        await db.run(
            'INSERT INTO clients (name, jiraProjectKey, tier) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            'Test Client', 'INT', 1
        );
        const client = await db.get('SELECT id FROM clients WHERE jiraProjectKey = ?', 'INT');

        // Test upsert
        const result = await service.upsertTicket(ticket, client.id);
        expect(result.ticket_key).toBe('INT-TEST-1');

        // Test retrieval
        const retrieved = await service.getTicket('INT-TEST-1');
        expect(retrieved.summary).toBe('Integration test ticket');

        // Cleanup
        await db.run('DELETE FROM jira_tickets WHERE ticket_key = ?', 'INT-TEST-1');
    });
});