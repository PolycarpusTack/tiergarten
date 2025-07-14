-- Add dashboards functionality
-- Following our lightweight philosophy - just the essentials

-- Simple dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) DEFAULT 'default', -- For future user support
    is_default BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link widgets to dashboards
ALTER TABLE user_widgets ADD COLUMN dashboard_id INTEGER DEFAULT 1;

-- Create default dashboards
INSERT INTO dashboards (name, is_default, display_order) VALUES 
    ('Overview', TRUE, 1),
    ('My Active Work', FALSE, 2),
    ('Planning View', FALSE, 3);

-- Migrate existing widgets to Overview dashboard
UPDATE user_widgets SET dashboard_id = 1 WHERE dashboard_id IS NULL;