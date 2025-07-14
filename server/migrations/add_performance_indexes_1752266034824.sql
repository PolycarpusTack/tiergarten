-- Technical debt fix: Add missing performance indexes
-- Generated: 2025-07-11T20:33:54.823Z

-- Performance critical indexes for ticket queries
CREATE INDEX IF NOT EXISTS idx_jira_tickets_client_status ON jira_tickets(client_id, status);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_updated_status ON jira_tickets(jira_updated, status);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_assignee ON jira_tickets(assignee);
CREATE INDEX IF NOT EXISTS idx_sync_history_started ON sync_history(started_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_jira_tickets_client_priority ON jira_tickets(client_id, priority);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_status_updated ON jira_tickets(status, jira_updated);

-- Add updated_at trigger simulation for DuckDB
-- Note: DuckDB doesn't support triggers, so this must be handled in application code
